/**
 * VeoProvider — Google Veo via the Gemini API (plan.md §10: "Google Flow OAuth rejected,
 * use the Veo API"). REST calls to generativelanguage.googleapis.com:
 *   1. POST  .../models/{model}:predictLongRunning  → operation name
 *   2. GET   .../{operation}                        → poll until done
 *   3. GET   video uri (with API key)               → bytes
 *
 * NOTE: response field names are parsed defensively across API revisions
 * (generatedSamples / generatedVideos / video.uri / videoUri). Verify against
 * live traffic once GEMINI_API_KEY is available.
 */
import { EST_COST_USD } from "../constants";
import { VideoProviderError, type ClipRequest, type ClipResult, type VideoProvider } from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "veo-3.0-fast-generate-preview";
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 240_000; // long-running video ops can take a few minutes

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Defensive walk of the operation response to find the video URL. */
export function extractVideoUrl(operation: Record<string, unknown>): string | undefined {
  const response = operation.response as Record<string, unknown> | undefined;
  if (!response) return undefined;

  const samples = (response.generatedSamples ?? response.generatedVideos) as
    | Array<Record<string, unknown>>
    | undefined;
  const first = samples?.[0];
  if (!first) return undefined;

  const video = first.video as Record<string, unknown> | undefined;
  const uri = (video?.uri ?? first.videoUri ?? first.uri) as string | undefined;
  return uri || undefined;
}

export class VeoProvider implements VideoProvider {
  readonly id = "veo";

  constructor(private readonly model: string = process.env.VEO_MODEL || DEFAULT_MODEL) {}

  async generateClip(req: ClipRequest): Promise<ClipResult> {
    const key = req.apiKey?.trim();
    if (!key) {
      throw new VideoProviderError("Missing API key for Veo generation.", this.id, false);
    }

    const startRes = await fetch(`${API_BASE}/models/${this.model}:predictLongRunning`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: req.prompt }],
        parameters: {
          aspectRatio: req.aspect,
          ...(req.negativePrompt ? { negativePrompt: req.negativePrompt } : {}),
        },
      }),
    });

    if (!startRes.ok) {
      const body = await startRes.text().catch(() => "");
      const retryable = startRes.status === 429 || startRes.status >= 500;
      throw new VideoProviderError(
        `Veo request failed (HTTP ${startRes.status}): ${body.slice(0, 300)}`,
        this.id,
        retryable
      );
    }

    const operation = (await startRes.json()) as { name?: string };
    if (!operation.name) {
      throw new VideoProviderError("Veo operation did not return an operation name.", this.id, false);
    }

    const done = await this.pollOperation(operation.name, key);
    const videoUrl = extractVideoUrl(done);
    if (!videoUrl) {
      const summary = JSON.stringify(done).slice(0, 300);
      throw new VideoProviderError(`Veo operation finished without a video: ${summary}`, this.id, false);
    }

    const dl = await fetch(videoUrl, { headers: { "x-goog-api-key": key } });
    if (!dl.ok) {
      throw new VideoProviderError(`Veo clip download failed (HTTP ${dl.status}).`, this.id, true);
    }
    const videoBytes = Buffer.from(await dl.arrayBuffer());

    return {
      provider: this.id,
      costUsd: Number((req.durationSec * EST_COST_USD.veoClipPerSec).toFixed(4)),
      videoBytes,
      metadata: { model: this.model, operation: operation.name },
    };
  }

  private async pollOperation(name: string, key: string): Promise<Record<string, unknown>> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const res = await fetch(`${API_BASE}/${name}`, { headers: { "x-goog-api-key": key } });
      if (!res.ok) {
        throw new VideoProviderError(`Veo operation poll failed (HTTP ${res.status}).`, this.id, res.status >= 500);
      }
      const op = (await res.json()) as Record<string, unknown>;
      if (op.done) return op;
      await sleep(POLL_INTERVAL_MS);
    }
    throw new VideoProviderError("Veo generation timed out.", this.id, true);
  }
}
