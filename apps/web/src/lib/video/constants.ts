/**
 * Phase 4 — Video Engine constants (plan.md §14 pricing, §18 cost model).
 * Single source of truth for quotas, caps, and cost estimates.
 */

export type PlanKey = "free" | "starter" | "pro" | "agency";

/** Monthly platform-pool video quota per plan (plan.md §14: 0(2 trial)|8|30|120). */
export const PLAN_VIDEO_QUOTA_MONTHLY: Record<PlanKey, number> = {
  free: 2, // trial only — free plan has no ongoing video allowance
  starter: 8,
  pro: 30,
  agency: 120,
};

/** Hard daily render-count cap per plan (cost protection — plan.md §14 row "Video cost protection"). */
export const PLAN_DAILY_RENDER_CAP: Record<PlanKey, number> = {
  free: 1,
  starter: 3,
  pro: 10,
  agency: 40, // priority render
};

/**
 * Daily platform-pool spend circuit breaker per workspace (USD).
 * BYOK renders cost us nothing → they are NOT counted against this cap.
 */
export const PLAN_DAILY_SPEND_CAP_USD: Record<PlanKey, number> = {
  free: 2, // trial only — enough for ~1 reel/day while the 2 trial videos last
  starter: 6,
  pro: 25,
  agency: 100,
};

/** Video credits top-up pack (plan.md §14: $19 / 10 extra videos). */
export const TOPUP_PACK = {
  videos: 10,
  priceUsd: 19,
} as const;

/** BYOK subscription discount (plan.md §14). */
export const BYOK_DISCOUNT_PCT = 30;

/**
 * Estimated unit costs (plan.md §18 — target ~$1.5–3 per 30s reel).
 * Used until live provider billing exports are wired.
 */
export const EST_COST_USD = {
  /** Veo Fast clip ~$/second (8s ≈ $0.40) */
  veoClipPerSec: 0.05,
  /** Cheap fallback clip (Kling/Pika) */
  fallbackClip: 0.15,
  /** ElevenLabs voiceover per reel */
  voiceoverReel: 0.2,
  /** FFmpeg render compute per reel */
  ffmpegRender: 0.03,
  /** Script generation per reel */
  script: 0.03,
} as const;

/** Render queue failure handling (plan.md §14 / ROADMAP P4). */
export const RENDER_MAX_RETRIES = 3;

/** Scene splitter targets (plan.md P3: 5–8 scenes, each ≤8s → ROADMAP says 5–6). */
export const SCENE_COUNT = { min: 5, max: 6 } as const;
export const SCENE_MAX_DURATION_SEC = 8;

/** Planned reel shape for MVP modes. */
export const REEL_DEFAULT = {
  aspect: "9:16",
  durationSec: 30,
  scenes: 6,
} as const;
