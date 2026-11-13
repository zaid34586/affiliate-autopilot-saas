/**
 * Phase 4 — VideoProvider abstraction (plan.md §10):
 *   VideoProvider interface: generate(prompt, duration, aspect) -> clip
 *   Providers: VeoProvider (primary), Kling/Pika/Runway (fallbacks) — swap-able.
 */

export interface ClipRequest {
  prompt: string;
  durationSec: number;
  aspect: "9:16" | "1:1" | "16:9";
  /** BYOK key when the workspace renders on its own Gemini key; undefined = platform pool. */
  apiKey?: string;
  negativePrompt?: string;
}

export interface ClipResult {
  /** Provider id that produced the clip: veo|kling|pika|runway|mock */
  provider: string;
  /** Estimated generation cost in USD (attribution to platform vs BYOK is decided by the caller). */
  costUsd: number;
  /** Remote URL (provider-hosted) OR raw bytes — exactly one of the two is set. */
  videoUrl?: string;
  videoBytes?: Buffer;
  metadata?: Record<string, unknown>;
}

export interface VideoProvider {
  readonly id: string;
  generateClip(req: ClipRequest): Promise<ClipResult>;
}

export class VideoProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = "VideoProviderError";
  }
}

/** Thrown when neither a BYOK key nor a platform-pool key is configured. */
export class ProviderNotConfiguredError extends Error {
  constructor() {
    super(
      "Video generation is not configured. Add the platform video key (GEMINI_API_KEY) or connect your own Gemini API key in Settings → AI keys."
    );
    this.name = "ProviderNotConfiguredError";
  }
}
