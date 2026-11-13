/**
 * Phase 4 S2 — Visual prompt templates per video mode (plan.md §10:
 * "prompt template library per video mode"). Each scene's narration gets a
 * cinematic, aspect-correct prompt for the clip provider (Veo etc.).
 *
 * Safety: prompts never request real celebrities, misleading claims, or
 * text overlays (captions are composited later by FFmpeg, not by the model).
 */
import type { VideoMode } from "./scripts";

export type SceneRole = "hook" | "point" | "cta";

interface RoleHint {
  showcase: string;
  listicle: string;
}

const ROLE_HINTS: Record<SceneRole, RoleHint> = {
  hook: {
    showcase: "dramatic reveal of the product on a clean gradient backdrop, slow push-in camera",
    listicle: "energetic snap-zoom onto the product, bright daylight, upbeat social-reel framing",
  },
  point: {
    showcase: "close-up detail shot rotating on a pedestal, shallow depth of field, studio lighting",
    listicle: "quick handheld b-roll of the product in use, punchy fast cuts, natural lighting",
  },
  cta: {
    showcase: "product centered with a soft glow and empty space at the bottom for captions",
    listicle: "final beauty shot of the product with clear space at the bottom for captions",
  },
};

const STYLE_SUFFIX: Record<VideoMode, string> = {
  showcase:
    "premium e-commerce commercial style, smooth slow-motion, high detail, vertical 9:16, no text, no watermark",
  listicle:
    "authentic UGC-style social reel, crisp motion, vibrant color, vertical 9:16, no text, no watermark",
};

export function buildScenePrompt(opts: {
  mode: VideoMode;
  role: SceneRole;
  productTitle: string;
  aspect?: string;
}): string {
  const hint = ROLE_HINTS[opts.role][opts.mode];
  const aspect = opts.aspect ?? "9:16";
  return (
    `Cinematic ${aspect} shot of the product "${opts.productTitle.trim()}", ${hint}, ` +
    `${STYLE_SUFFIX[opts.mode]}`
  );
}

/** Optional negative prompt for providers that support it. */
export const NEGATIVE_PROMPT =
  "text overlays, captions, logos, watermark, distorted product, blurry, low quality, celebrities, fake claims";
