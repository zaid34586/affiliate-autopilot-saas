/**
 * Phase 4 S3 — Render pipeline (plan.md P3):
 *   claimed job → scenes → clips (parallel + clip cache) → voiceover (ElevenLabs, optional)
 *   → word captions (ASS) → FFmpeg assemble 9:16 → thumbnail → cost + completion.
 *
 * Works with zero keys via MockProvider + FFmpeg budget clips (honest "mock" label);
 * add GEMINI_API_KEY / ELEVENLABS_API_KEY and the same pipeline renders with Veo + voice.
 */
import { db } from "@/lib/db";
import { contents, products, videoClips } from "@aa/db";
import { and, eq } from "drizzle-orm";
import { EST_COST_USD } from "./constants";
import { buildAss, computeWordTimings } from "./captions";
import { finishVideoAudit } from "./enqueue";
import { assembleReel, extractThumbnail, mapLimit, synthSceneClip } from "./ffmpeg";
import { getVideoProvider } from "./providers";
import { clipPromptHash } from "./clip-cache";
import { completeVideo, failOrRetry, logEvent, setProgress, type VideoRow } from "./queue";
import { autoPostAfterRender } from "@/lib/publisher";
import type { ScriptDoc } from "./scripts";
import type { Scene } from "./scenes";
import {
  absolutePath,
  artifactExists,
  joinKey,
  saveBuffer,
} from "./storage";
import { synthesizeVoiceover } from "./tts";

export class NonRetryableError extends Error {
  readonly retryable = false;
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}

export interface RenderStats {
  clipsGenerated: number;
  cacheHits: number;
  voiceover: "synthesized" | "skipped_no_key" | "failed";
  durationSec: number;
  costUsd: number;
  mode: "mock" | "live";
}

export type RenderOutcome =
  | { outcome: "done"; stats: RenderStats }
  | { outcome: "retrying" | "failed"; error: string };

interface ClipArtifact {
  absPath: string;
  costUsd: number;
  cached: boolean;
}

const CLIP_PARALLELISM = 3;

async function fetchProductImage(
  imageUrl: string | null | undefined,
  videoId: string
): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    if (!["png", "jpg", "webp"].includes(ext)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const rel = joinKey(videoId, `product-image.${ext}`);
    await saveBuffer(rel, bytes);
    return absolutePath(rel);
  } catch {
    return null; // image is best-effort — never block a render on it
  }
}

async function produceSceneClip(opts: {
  video: VideoRow;
  scene: Scene;
  sceneIndex: number;
  providerId: string;
  providerMode: "mock" | "live";
  generateClip: (scene: Scene) => Promise<{ bytes?: Buffer; costUsd: number }>;
  imageLocalPath: string | null;
}): Promise<ClipArtifact> {
  const { video, scene, sceneIndex } = opts;
  const relKey = joinKey(video.id, `scene-${sceneIndex + 1}.mp4`);

  if (opts.providerMode === "live") {
    // Clip cache: identical prompt+duration+aspect reuses stored clip (plan.md §18).
    const hash = clipPromptHash({
      provider: opts.providerId,
      prompt: scene.visualPrompt,
      durationSec: scene.durationSec,
      aspect: video.aspect ?? "9:16",
    });
    const cached = await db
      .select({ storageKey: videoClips.storageKey })
      .from(videoClips)
      .where(and(eq(videoClips.promptHash, hash), eq(videoClips.provider, opts.providerId)))
      .limit(1);

    if (cached.length > 0 && (await artifactExists(cached[0].storageKey))) {
      return { absPath: absolutePath(cached[0].storageKey), costUsd: 0, cached: true };
    }

    const generated = await opts.generateClip(scene);
    if (!generated.bytes) {
      throw new NonRetryableError(`Video provider returned no clip for scene ${sceneIndex + 1}.`);
    }
    await saveBuffer(relKey, generated.bytes);
    await db
      .insert(videoClips)
      .values({
        promptHash: hash,
        provider: opts.providerId,
        prompt: scene.visualPrompt,
        durationSec: scene.durationSec,
        aspect: video.aspect ?? "9:16",
        storageKey: relKey,
        costUsd: String(generated.costUsd.toFixed(4)),
      })
      .onConflictDoNothing({ target: videoClips.promptHash });
    return { absPath: absolutePath(relKey), costUsd: generated.costUsd, cached: false };
  }

  // Mock / budget path: FFmpeg motion-graphics clip (deterministic per scene).
  const seed = parseInt(hashSeed(scene.visualPrompt), 16) % 999983;
  await synthSceneClip({
    durationSec: scene.durationSec,
    outPath: absolutePath(relKey),
    seed,
    localImagePath: opts.imageLocalPath,
  });
  return { absPath: absolutePath(relKey), costUsd: 0, cached: false };
}

function hashSeed(text: string): string {
  // cheap stable 32-bit hex from the prompt (crypto not needed — only a seed)
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Run one claimed (rendering) video job end-to-end. */
export async function renderVideoJob(video: VideoRow): Promise<RenderOutcome> {
  let stats: RenderStats | null = null;
  try {
    const contentRows = await db
      .select()
      .from(contents)
      .where(eq(contents.id, video.contentId))
      .limit(1);
    if (contentRows.length === 0) throw new NonRetryableError("Script content missing for this video.");

    const body = contentRows[0].body as unknown as { script?: ScriptDoc; scenes?: Scene[] };
    const scenes = body?.scenes;
    if (!scenes || scenes.length === 0) {
      throw new NonRetryableError("No scenes found — re-generate the video from the product page.");
    }
    const script = body.script;

    const productRows = contentRows[0].productId
      ? await db.select().from(products).where(eq(products.id, contentRows[0].productId!)).limit(1)
      : [];
    const product = productRows[0] ?? null;

    await setProgress(video.id, 8);
    const { provider, choice } = await getVideoProvider(video.workspaceId);
    const providerMode: "mock" | "live" = choice.mode === "mock" ? "mock" : "live";

    const imageLocalPath = await fetchProductImage(product?.imageUrl, video.id);
    await logEvent(video.id, { provider: choice.mode, providerId: choice.providerId });

    let clipsDone = 0;
    const clips = await mapLimit(scenes, CLIP_PARALLELISM, async (scene, i) => {
      const artifact = await produceSceneClip({
        video,
        scene,
        sceneIndex: i,
        providerId: choice.providerId,
        providerMode,
        imageLocalPath,
        generateClip: async (s) => {
          const res = await provider.generateClip({
            prompt: s.visualPrompt,
            negativePrompt: s.negativePrompt,
            durationSec: s.durationSec,
            aspect: (video.aspect ?? "9:16") as "9:16" | "1:1" | "16:9",
            apiKey: choice.apiKey,
          });
          return { bytes: res.videoBytes, costUsd: res.costUsd };
        },
      });
      clipsDone++;
      await setProgress(video.id, 10 + Math.round((clipsDone / scenes.length) * 35));
      return artifact;
    });

    const clipAbsPaths = clips.map((c) => c.absPath);
    const sceneDurations = scenes.map((s) => s.durationSec);
    const totalDurationSec = sceneDurations.reduce((a, b) => a + b, 0);

    // Voiceover (optional — skip honestly when no ELEVENLABS_API_KEY).
    let voiceoverPath: string | null = null;
    let voiceCostUsd = 0;
    let voiceStatus: RenderStats["voiceover"] = "skipped_no_key";
    const narration = script?.fullText ?? scenes.map((s) => s.narration).join(" ");
    try {
      const voice = await synthesizeVoiceover(narration);
      if (voice) {
        const rel = joinKey(video.id, "voiceover.mp3");
        await saveBuffer(rel, voice.bytes);
        voiceoverPath = absolutePath(rel);
        voiceCostUsd = voice.costUsd;
        voiceStatus = "synthesized";
      }
    } catch (e) {
      voiceStatus = "failed"; // degrade honestly: reel renders without voice
      console.error("Voiceover failed, rendering without it:", e);
    }
    await setProgress(video.id, 58);

    // Word-level captions → ASS → burned during assembly.
    const timings = computeWordTimings(scenes);
    const assRel = joinKey(video.id, "captions.ass");
    await saveBuffer(assRel, Buffer.from(buildAss(timings), "utf8"));

    const finalRel = joinKey(video.id, "final.mp4");
    await assembleReel({
      clipPaths: clipAbsPaths,
      sceneDurationsSec: sceneDurations,
      assPath: absolutePath(assRel),
      voiceoverPath,
      outPath: absolutePath(finalRel),
    });
    await setProgress(video.id, 88);

    const thumbRel = joinKey(video.id, "thumb.jpg");
    await extractThumbnail(
      absolutePath(finalRel),
      absolutePath(thumbRel),
      Math.min(1.2, totalDurationSec * 0.2)
    );

    // Cost attribution: BYOK clips cost the user (our platform cost = 0);
    // voiceover + FFmpeg compute are ours regardless.
    const clipCostUsd = clips.reduce((sum, c) => sum + c.costUsd, 0);
    const platformClipCostUsd = choice.mode === "byok" ? 0 : clipCostUsd;
    const costUsd = Number(
      (platformClipCostUsd + voiceCostUsd + EST_COST_USD.ffmpegRender).toFixed(4)
    );

    stats = {
      clipsGenerated: clips.filter((c) => !c.cached).length,
      cacheHits: clips.filter((c) => c.cached).length,
      voiceover: voiceStatus,
      durationSec: totalDurationSec,
      costUsd,
      mode: providerMode,
    };

    await completeVideo(video.id, {
      storageKey: finalRel,
      thumbnailKey: thumbRel,
      durationSec: totalDurationSec,
      costUsd,
      provider: choice.mode,
      stats: stats as unknown as Record<string, unknown>,
    });
    await finishVideoAudit(video.id, {
      status: "success",
      costUsd,
      output: { ...stats, storageKey: finalRel },
    });

    // Auto-post (non-blocking — best effort, never fails the render).
    if (video.autoPostPlatform) {
      try {
        await autoPostAfterRender({
          workspaceId: video.workspaceId,
          videoId: video.id,
          platform: video.autoPostPlatform,
        });
      } catch (e) {
        console.error("Auto-post after render failed:", e);
      }
    }

    return { outcome: "done", stats };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    const outcome = await failOrRetry(video, error);
    // Auto-retry keeps the audit row "running" (job continues); terminal failure closes it.
    if (outcome === "failed") {
      await finishVideoAudit(video.id, {
        status: "failed",
        costUsd: stats?.costUsd ?? 0,
        error: error.message,
      }).catch(() => undefined);
    }
    return { outcome, error: error.message };
  }
}
