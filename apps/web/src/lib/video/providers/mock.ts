/**
 * MockProvider — development/demo stand-in when no Gemini key is configured
 * (VIDEO_PROVIDER=mock or NODE_ENV=development). Produces a deterministic
 * synthetic clip result so the full pipeline (queue → assemble → captions)
 * can run end-to-end without spend. Never active in production unless
 * VIDEO_PROVIDER=mock is set explicitly.
 */
import type { ClipRequest, ClipResult, VideoProvider } from "./types";

export class MockProvider implements VideoProvider {
  readonly id = "mock";

  async generateClip(req: ClipRequest): Promise<ClipResult> {
    return {
      provider: this.id,
      costUsd: 0,
      metadata: {
        mock: true,
        prompt: req.prompt,
        durationSec: req.durationSec,
        aspect: req.aspect,
        note: "Synthetic clip — configure GEMINI_API_KEY (platform pool) or a BYOK Gemini key for real Veo renders.",
      },
    };
  }
}
