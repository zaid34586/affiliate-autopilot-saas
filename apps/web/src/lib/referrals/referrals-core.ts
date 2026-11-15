/**
 * Phase 7 — Referral Program Core (pure logic).
 *
 * Commission math (20% recurring), credit bonuses, code generation,
 * payout eligibility, funnel stats.
 */

// ───────────────────────── CODE GENERATION ─────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars (0/O, 1/I)

/**
 * Generate a shareable referral code, e.g. "K7XQ2M".
 * Uses crypto.getRandomValues when available (browser/node 19+).
 */
export function generateReferralCode(length = 6): string {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Validate a referral code format. */
export function isValidReferralCode(code: string): boolean {
  return /^[A-Z2-9]{4,12}$/.test(code);
}

// ───────────────────────── COMMISSION MATH ─────────────────────────

export interface CommissionSettings {
  commissionPct: number; // default 20
  creditBonusCents: number; // referrer bonus on first conversion
  referredCreditCents: number; // bonus for the referred user
  minPayoutCents: number;
}

export const DEFAULT_COMMISSION_SETTINGS: CommissionSettings = {
  commissionPct: 20,
  creditBonusCents: 1000, // $10
  referredCreditCents: 500, // $5
  minPayoutCents: 5000, // $50
};

/**
 * Recurring commission on a payment: payment × pct.
 * Rounds down to whole cents.
 */
export function computeCommission(paymentCents: number, commissionPct: number): number {
  if (paymentCents <= 0 || commissionPct <= 0) return 0;
  return Math.floor((paymentCents * commissionPct) / 100);
}

/** Total earned by a referrer across all commissions. */
export function totalEarned(commissions: Array<{ amountCents: number; status: string }>): number {
  return commissions
    .filter((c) => c.status !== "reversed")
    .reduce((sum, c) => sum + c.amountCents, 0);
}

/** Amount available for payout (credited commissions ≥ min payout). */
export function payoutEligibleCents(
  commissions: Array<{ amountCents: number; status: string }>,
  settings: CommissionSettings = DEFAULT_COMMISSION_SETTINGS,
): { eligibleCents: number; blockedCents: number; canPayout: boolean } {
  const credited = commissions
    .filter((c) => c.status === "credited")
    .reduce((s, c) => s + c.amountCents, 0);

  const canPayout = credited >= settings.minPayoutCents;
  return {
    eligibleCents: canPayout ? credited : 0,
    blockedCents: canPayout ? 0 : credited,
    canPayout,
  };
}

// ───────────────────────── ATTRIBUTION FUNNEL ─────────────────────────

export interface ReferralFunnel {
  clicks: number;
  signups: number;
  conversions: number;
  clickToSignupPct: number;
  signupToPaidPct: number;
  overallPct: number;
}

export function computeReferralFunnel(input: {
  clicks: number;
  signups: number;
  conversions: number;
}): ReferralFunnel {
  const { clicks, signups, conversions } = input;
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10000) / 100 : 0);

  return {
    clicks,
    signups,
    conversions,
    clickToSignupPct: pct(signups, clicks),
    signupToPaidPct: pct(conversions, signups),
    overallPct: pct(conversions, clicks),
  };
}

// ───────────────────────── ATTRIBUTION ─────────────────────────

export type AttributionStatus = "clicked" | "signed_up" | "paid";

const STATUS_RANK: Record<AttributionStatus, number> = { clicked: 0, signed_up: 1, paid: 2 };

/**
 * Merge attribution statuses — never downgrade (clicked → signed_up is forward,
 * paid → signed_up would be a downgrade and is ignored).
 */
export function mergeAttributionStatus(
  current: AttributionStatus,
  next: AttributionStatus,
): AttributionStatus {
  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current;
}

/** Whether a referral qualifies for the first-conversion credit bonus. */
export function qualifiesForCreditBonus(
  currentStatus: AttributionStatus,
  nextStatus: AttributionStatus,
): boolean {
  return currentStatus !== "paid" && nextStatus === "paid";
}
