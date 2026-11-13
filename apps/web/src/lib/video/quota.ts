/**
 * Phase 4 — Render quota / cost-control decisions (pure logic, fully testable).
 * Rules per plan.md §14 (quotas, caps, BYOK) and §18 (daily $ circuit breaker).
 */
import {
  PLAN_DAILY_RENDER_CAP,
  PLAN_DAILY_SPEND_CAP_USD,
  PLAN_VIDEO_QUOTA_MONTHLY,
  TOPUP_PACK,
  type PlanKey,
} from "./constants";

export type RenderProvider = "platform_pool" | "byok";
export type QuotaSource = "plan" | "topup";

export interface QuotaInput {
  plan: PlanKey;
  /** Non-failed videos (queued|rendering|done) created this calendar month. */
  usedThisMonth: number;
  /** Renders queued today (any provider). */
  rendersToday: number;
  /** Sum of cost_usd for platform-pool videos created today. */
  platformSpendTodayUsd: number;
  /** Purchased top-up video credits remaining. */
  creditsBalance: number;
  provider: RenderProvider;
}

export type QuotaDenialReason =
  | "monthly_quota_exceeded"
  | "daily_render_cap"
  | "daily_spend_circuit_breaker";

export interface QuotaUpsell {
  topupPack: typeof TOPUP_PACK;
  /** Next plan that lifts this limit, if any. */
  upgradeHint: string | null;
}

export type QuotaDecision =
  | { allowed: true; source: QuotaSource; reason?: undefined; message?: undefined }
  | { allowed: false; source?: undefined; reason: QuotaDenialReason; message: string; upsell: QuotaUpsell };

const UPSSELL_BASE: QuotaUpsell = {
  topupPack: TOPUP_PACK,
  upgradeHint: null,
};

/**
 * Decide whether one more video render may be queued.
 * Order: daily count cap → daily $ circuit breaker (platform pool only)
 *        → monthly plan quota → top-up credits → deny (with upsell).
 */
export function evaluateQuota(input: QuotaInput): QuotaDecision {
  const dailyCap = PLAN_DAILY_RENDER_CAP[input.plan];
  if (input.rendersToday >= dailyCap) {
    return {
      allowed: false,
      reason: "daily_render_cap",
      message: `Daily render limit reached for the ${input.plan} plan (${dailyCap} per day). Queued renders resume tomorrow, or upgrade for a higher cap.`,
      upsell: { ...UPSSELL_BASE, upgradeHint: input.plan === "agency" ? null : "Upgrade your plan for a higher daily render cap." },
    };
  }

  if (input.provider === "platform_pool") {
    const spendCap = PLAN_DAILY_SPEND_CAP_USD[input.plan];
    if (input.platformSpendTodayUsd >= spendCap) {
      return {
        allowed: false,
        reason: "daily_spend_circuit_breaker",
        message: `Daily video cost limit reached for the ${input.plan} plan ($${spendCap}/day). Rendering resumes tomorrow — connect your own Gemini API key in Settings to render on your own credits.`,
        upsell: { ...UPSSELL_BASE, upgradeHint: "Connect a BYOK Gemini key (30% plan discount) or upgrade your plan." },
      };
    }
  }

  const monthlyLimit = PLAN_VIDEO_QUOTA_MONTHLY[input.plan];
  if (input.usedThisMonth < monthlyLimit) {
    return { allowed: true, source: "plan" };
  }

  if (input.creditsBalance > 0) {
    return { allowed: true, source: "topup" };
  }

  return {
    allowed: false,
    reason: "monthly_quota_exceeded",
    message: `Monthly video quota used (${monthlyLimit} of ${monthlyLimit}). Buy the ${TOPUP_PACK.videos}-video top-up pack ($${TOPUP_PACK.priceUsd}) or upgrade your plan to keep rendering.`,
    upsell: {
      ...UPSSELL_BASE,
      upgradeHint: input.plan === "agency" ? "Top-up packs are available on every plan." : "Upgrade your plan for a larger monthly allowance.",
    },
  };
}

/** Calendar-month start (UTC) for "used this month" counting. */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Start of UTC day (for daily caps / circuit breaker windows). */
export function dayStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
