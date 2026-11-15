/**
 * Phase 7 — Referral Program DB Orchestration.
 *
 * Code creation, click/signup/paid attribution, commission crediting,
 * stats + settings.
 */

import { db } from "@/lib/db";
import {
  referrals,
  referralAttributions,
  referralCommissions,
  referralSettings,
  creditsLedger,
} from "@aa/db";
import { eq, and, desc, sql, count, sum, isNull } from "drizzle-orm";
import {
  generateReferralCode,
  computeCommission,
  computeReferralFunnel,
  mergeAttributionStatus,
  qualifiesForCreditBonus,
  payoutEligibleCents,
  DEFAULT_COMMISSION_SETTINGS,
  CommissionSettings,
} from "./referrals-core";

// ───────────────────────── SETTINGS ─────────────────────────

export async function getReferralSettings(): Promise<CommissionSettings & { enabled: boolean }> {
  const [row] = await db.select().from(referralSettings).limit(1);
  if (!row) return { ...DEFAULT_COMMISSION_SETTINGS, enabled: true };
  return {
    enabled: row.enabled,
    commissionPct: row.commissionPct,
    creditBonusCents: row.creditBonusCents,
    referredCreditCents: row.referredCreditCents,
    minPayoutCents: row.minPayoutCents,
  };
}

export async function updateReferralSettings(input: Partial<CommissionSettings & { enabled: boolean }>) {
  const existing = await getReferralSettings();
  const merged = { ...existing, ...input };

  const [row] = await db.select().from(referralSettings).limit(1);
  if (row) {
    const [updated] = await db
      .update(referralSettings)
      .set({
        enabled: merged.enabled,
        commissionPct: merged.commissionPct,
        creditBonusCents: merged.creditBonusCents,
        referredCreditCents: merged.referredCreditCents,
        minPayoutCents: merged.minPayoutCents,
        updatedAt: new Date(),
      })
      .where(eq(referralSettings.id, row.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(referralSettings).values(merged).returning();
  return created;
}

// ───────────────────────── REFERRAL CODES ─────────────────────────

/** Get or create the referral code for a user. */
export async function getOrCreateReferralCode(userId: string, workspaceId: string) {
  const [existing] = await db
    .select()
    .from(referrals)
    .where(eq(referrals.referrerUserId, userId))
    .limit(1);

  if (existing) return existing;

  // Generate unique code (retry on collision)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      const [created] = await db
        .insert(referrals)
        .values({ code, referrerUserId: userId, referrerWorkspaceId: workspaceId })
        .returning();
      return created;
    } catch {
      continue; // collision → retry
    }
  }
  throw new Error("Failed to generate unique referral code");
}

/** Look up a referral by code (for click attribution). */
export async function getReferralByCode(code: string) {
  const [row] = await db.select().from(referrals).where(eq(referrals.code, code)).limit(1);
  return row || null;
}

/** Record a click on a referral link. */
export async function recordReferralClick(code: string) {
  const ref = await getReferralByCode(code);
  if (!ref) return null;

  await db
    .update(referrals)
    .set({ clicks: sql`${referrals.clicks} + 1` })
    .where(eq(referrals.id, ref.id));

  return ref;
}

/**
 * Attribute a referred user (called at signup with ?ref=CODE).
 * Idempotent: one attribution per referred user.
 */
export async function attributeSignup(code: string, userId: string, workspaceId: string) {
  const ref = await getReferralByCode(code);
  if (!ref) return null;

  // Idempotent: check existing
  const [existing] = await db
    .select()
    .from(referralAttributions)
    .where(eq(referralAttributions.referredUserId, userId))
    .limit(1);
  if (existing) return existing;

  const [attr] = await db
    .insert(referralAttributions)
    .values({
      referralId: ref.id,
      referredUserId: userId,
      referredWorkspaceId: workspaceId,
      signedUpAt: new Date(),
      status: "signed_up",
    })
    .returning();

  await db
    .update(referrals)
    .set({ signups: sql`${referrals.signups} + 1` })
    .where(eq(referrals.id, ref.id));

  return attr;
}

// ───────────────────────── COMMISSIONS ─────────────────────────

/**
 * Credit a commission when a referred workspace pays.
 * Idempotent per (referral, payment, periodEnd) via unique index.
 * Also handles first-payment credit bonus for both sides.
 */
export async function creditCommission(input: {
  referredWorkspaceId: string;
  paymentCents: number;
  periodEnd?: string; // YYYY-MM-DD for idempotency
}) {
  const settings = await getReferralSettings();
  if (!settings.enabled || input.paymentCents <= 0) return null;

  // Find attribution for this workspace
  const [attr] = await db
    .select()
    .from(referralAttributions)
    .where(eq(referralAttributions.referredWorkspaceId, input.referredWorkspaceId))
    .limit(1);
  if (!attr) return null;

  const amountCents = computeCommission(input.paymentCents, settings.commissionPct);
  if (amountCents <= 0) return null;

  // Idempotent insert
  const [commission] = await db
    .insert(referralCommissions)
    .values({
      referralId: attr.referralId,
      referredWorkspaceId: input.referredWorkspaceId,
      amountCents,
      sourcePaymentCents: input.paymentCents,
      kind: "recurring",
      status: "pending",
      periodEnd: input.periodEnd || new Date().toISOString().slice(0, 10),
    })
    .onConflictDoNothing()
    .returning();

  if (!commission) return null; // already credited for this period

  // First payment? → forward attribution + credit bonuses
  const isFirstPayment = attr.status !== "paid";
  if (isFirstPayment) {
    const newStatus = mergeAttributionStatus(attr.status as any, "paid");
    await db
      .update(referralAttributions)
      .set({ status: newStatus, firstPaidAt: new Date() })
      .where(eq(referralAttributions.id, attr.id));

    await db
      .update(referrals)
      .set({ conversions: sql`${referrals.conversions} + 1` })
      .where(eq(referrals.id, attr.referralId));
  }

  // Update referrer earnings
  await db
    .update(referrals)
    .set({ totalEarnedCents: sql`${referrals.totalEarnedCents} + ${amountCents}` })
    .where(eq(referrals.id, attr.referralId));

  // Mark commission credited
  await db
    .update(referralCommissions)
    .set({ status: "credited", creditedAt: new Date() })
    .where(eq(referralCommissions.id, commission.id));

  // First-payment credit bonuses (referrer + referred), one-time
  if (isFirstPayment && qualifiesForCreditBonus(attr.status as any, "paid")) {
    if (settings.creditBonusCents > 0) {
      const [refRow] = await db
        .select({ workspaceId: referrals.referrerWorkspaceId })
        .from(referrals)
        .where(eq(referrals.id, attr.referralId))
        .limit(1);

      if (refRow) {
        await db.insert(creditsLedger).values({
          workspaceId: refRow.workspaceId,
          delta: settings.creditBonusCents,
          reason: "bonus",
          note: "Referral first-conversion bonus",
        });
      }
    }
  }

  return { commission, amountCents, isFirstPayment };
}

// ───────────────────────── STATS ─────────────────────────

/** Referral dashboard stats for a user. */
export async function getReferralStats(userId: string) {
  const ref = await getReferralByUser(userId);
  if (!ref) return null;

  const [attrAgg] = await db
    .select({
      clicked: count(),
      signups: sql<number>`count(*) filter (where ${referralAttributions.status} >= 'signed_up')::int`,
      paid: sql<number>`count(*) filter (where ${referralAttributions.status} = 'paid')::int`,
    })
    .from(referralAttributions)
    .where(eq(referralAttributions.referralId, ref.id))
    .limit(1);

  const commissions = await db
    .select()
    .from(referralCommissions)
    .where(eq(referralCommissions.referralId, ref.id));

  const settings = await getReferralSettings();
  const payout = payoutEligibleCents(
    commissions.map((c) => ({ amountCents: c.amountCents, status: c.status })),
    settings,
  );

  const funnel = computeReferralFunnel({
    clicks: ref.clicks,
    signups: Number(attrAgg?.signups || 0),
    conversions: Number(attrAgg?.paid || 0),
  });

  return {
    code: ref.code,
    funnel,
    totalEarnedCents: ref.totalEarnedCents,
    pendingCents: commissions
      .filter((c) => c.status === "pending")
      .reduce((s, c) => s + c.amountCents, 0),
    creditedCents: commissions
      .filter((c) => c.status === "credited")
      .reduce((s, c) => s + c.amountCents, 0),
    payout,
    settings,
  };
}

async function getReferralByUser(userId: string) {
  const [row] = await db.select().from(referrals).where(eq(referrals.referrerUserId, userId)).limit(1);
  return row || null;
}

/** Top referrers (admin). */
export async function getTopReferrers(limit = 20) {
  return db
    .select({
      id: referrals.id,
      code: referrals.code,
      referrerUserId: referrals.referrerUserId,
      clicks: referrals.clicks,
      signups: referrals.signups,
      conversions: referrals.conversions,
      totalEarnedCents: referrals.totalEarnedCents,
    })
    .from(referrals)
    .orderBy(desc(referrals.totalEarnedCents), desc(referrals.conversions))
    .limit(limit);
}
