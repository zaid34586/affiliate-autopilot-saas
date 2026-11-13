/**
 * Phase 4 S3 — FFmpeg helpers (render worker: clips → assemble → captions → thumb).
 * Binary comes from ffmpeg-static (works locally and on Vercel Linux builds).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

export const FFMPEG: string | null = ffmpegPath;

export const REEL_SIZE = { width: 1080, height: 1920 } as const; // 9:16

export async function runFFmpeg(args: string[]): Promise<void> {
  if (!FFMPEG) throw new Error("FFmpeg binary is not available on this platform.");
  try {
    await execFileAsync(FFMPEG, args, {
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
      timeout: 180_000,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const stderr = (e as { stderr?: string }).stderr;
    throw new Error(`ffmpeg failed: ${(stderr || raw).slice(0, 600)}`);
  }
}

/**
 * Escape a filesystem path for use inside a filtergraph option
 * (e.g. subtitles=filename='...'). Forward slashes + escaped ':' and ','.
 */
export function escapeFilterPath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/'/g, "\\'");
}

export interface SynthClipOptions {
  durationSec: number;
  outPath: string;
  /** Deterministic seed → distinct look per scene/product. */
  seed: number;
  /** Optional product image (already downloaded to a local path) centered on the background. */
  localImagePath?: string | null;
}

/**
 * Budget-mode scene clip (plan.md P3: "budget mode uses motion-graphics
 * template instead of Veo") and the MockProvider visual path:
 * animated gradient background + optional centered product image → 9:16 H.264.
 */
export async function synthSceneClip(opts: SynthClipOptions): Promise<void> {
  const dur = Math.max(1, opts.durationSec);
  const source = `gradients=s=${REEL_SIZE.width}x${REEL_SIZE.height}:d=${dur}:speed=0.06:nb_colors=2:seed=${opts.seed}:c0=0x141210:c1=0x243018`;

  const args: string[] = ["-y", "-f", "lavfi", "-i", source];
  if (opts.localImagePath) args.push("-i", opts.localImagePath);

  if (opts.localImagePath) {
    args.push(
      "-filter_complex",
      `[1:v]scale=${Math.round(REEL_SIZE.width * 0.72)}:-1:force_original_aspect_ratio=decrease[img];` +
        `[0:v][img]overlay=(W-w)/2:(H-h)/2:format=auto,fps=30,setsar=1,format=yuv420p[v]`,
      "-map",
      "[v]"
    );
  } else {
    args.push("-vf", "fps=30,setsar=1,format=yuv420p");
  }

  args.push(
    "-t",
    String(dur),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "26",
    "-movflags",
    "+faststart",
    "-an",
    opts.outPath
  );

  await runFFmpeg(args);
}

export interface AssembleOptions {
  /** Ordered scene clip file paths. */
  clipPaths: string[];
  /** Planned per-scene durations (trim real clips to narration timing). */
  sceneDurationsSec: number[];
  /** ASS subtitle file burned onto the reel (word captions). */
  assPath: string;
  /** Optional voiceover audio file (wav/mp3) — padded/trimmed to reel length. */
  voiceoverPath?: string | null;
  outPath: string;
}

/** Concatenate scene clips (trim → uniform 9:16/30fps) + burn captions + optional voiceover. */
export async function assembleReel(opts: AssembleOptions): Promise<void> {
  const n = opts.clipPaths.length;
  if (n === 0) throw new Error("assembleReel: no clips provided.");

  const args: string[] = ["-y"];
  for (const p of opts.clipPaths) args.push("-i", p);
  const hasVoice = Boolean(opts.voiceoverPath);
  if (hasVoice) args.push("-i", opts.voiceoverPath as string);

  const filters: string[] = [];
  const labels: string[] = [];
  for (let i = 0; i < n; i++) {
    const dur = Math.max(1, opts.sceneDurationsSec[i] ?? 6);
    filters.push(
      `[${i}:v]trim=0:${dur},setpts=PTS-STARTPTS,scale=${REEL_SIZE.width}:${REEL_SIZE.height}:force_original_aspect_ratio=increase,crop=${REEL_SIZE.width}:${REEL_SIZE.height},fps=30,setsar=1,format=yuv420p[v${i}]`
    );
    labels.push(`[v${i}]`);
  }
  filters.push(`${labels.join("")}concat=n=${n}:v=1:a=0[vc]`);
  filters.push(`[vc]subtitles=filename='${escapeFilterPath(opts.assPath)}'[vout]`);

  args.push("-filter_complex", filters.join(";"), "-map", "[vout]");

  if (hasVoice) {
    const audioIdx = n; // voiceover is the last input
    args.push(
      "-map",
      `${audioIdx}:a`,
      "-af",
      "apad",
      "-shortest",
      "-c:a",
      "aac",
      "-b:a",
      "128k"
    );
  } else {
    args.push("-an");
  }

  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-movflags",
    "+faststart",
    opts.outPath
  );

  await runFFmpeg(args);
}

/** Extract a poster frame (JPEG) for the media library / thumbnail picker. */
export async function extractThumbnail(
  videoPath: string,
  outPath: string,
  atSec: number
): Promise<void> {
  await runFFmpeg([
    "-y",
    "-ss",
    String(Math.max(0, atSec)),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    outPath,
  ]);
}

/** Concurrency limiter — clip generation runs in parallel with a cap (queue DoD: 10 concurrent renders). */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.max(1, Math.min(limit, items.length))).fill(null).map(async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
