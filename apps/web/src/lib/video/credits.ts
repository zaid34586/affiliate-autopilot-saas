/**
 * Render quota & top-up credit persistence (DB side of ./quota.ts).
 * - Usage = count of non-failed videos this month / today + platform-pool spend today.
 * - Top-up credits (workspaces.credits_balance) are consumed atomically only when
 *   the monthly plan quota is exhausted, and refunded if the render fails terminally.
 */
import { db } from "@/lib/db";
import { creditsLedger, videos, workspaces } from "@aa/db";
import { and, count, eq, gt, gte, ne, sql, sum } from "drizzle-orm";
import { RENDER_MAX_RETRIES } from "./constants";
import { dayStart, evaluateQuota, monthStart, type QuotaDecision, type RenderProvider } from "./quota";

export interface RenderUsage {
  usedThisMonth: number;
  rendersToday: number;
  platformSpendTodayUsd: number;
}

export async function getRenderUsage(workspaceId: string, now: Date = new Date()): Promise<RenderUsage> {
  const [monthRow] = await db
    .select({ value: count() })
    .from(videos)
    .where(
      and(
        eq(videos.workspaceId, workspaceId),
        gte(videos.createdAt, monthStart(now)),
        ne(videos.renderStatus, "failed")
      )
    );

  const [todayRow] = await db
    .select({ value: count() })
    .from(videos)
    .where(
      and(
        eq(videos.workspaceId, workspaceId),
        gte(videos.createdAt, dayStart(now)),
        ne(videos.renderStatus, "failed")
      )
    );

  // Failed renders still cost us real money → include them in today's spend.
  const [spendRow] = await db
    .select({ value: sum(videos.costUsd) })
    .from(videos)
    .where(
      and(
        eq(videos.workspaceId, workspaceId),
        eq(videos.provider, "platform_pool"),
        gte(videos.createdAt, dayStart(now))
      )
    );

  return {
    usedThisMonth: Number(monthRow?.value ?? 0),
    rendersToday: Number(todayRow?.value ?? 0),
    platformSpendTodayUsd: Number(spendRow?.value ?? 0),
  };
}

export interface QuotaCheck {
  decision: QuotaDecision;
  usage: RenderUsage;
  plan: string;
  creditsBalance: number;
  /** true when this render must consume one top-up credit */
  chargeCredit: boolean;
}

/** Full quota check for queuing one more render. */
export async function checkRenderQuota(
  workspaceId: string,
  provider: RenderProvider,
  now: Date = new Date()
): Promise<QuotaCheck> {
  const [ws] = await db
    .select({ plan: workspaces.plan, creditsBalance: workspaces.creditsBalance })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!ws) throw new Error("Workspace not found");

  const usage = await getRenderUsage(workspaceId, now);
  const decision = evaluateQuota({
    plan: ws.plan,
    usedThisMonth: usage.usedThisMonth,
    rendersToday: usage.rendersToday,
    platformSpendTodayUsd: usage.platformSpendTodayUsd,
    creditsBalance: ws.creditsBalance,
    provider,
  });

  return {
    decision,
    usage,
    plan: ws.plan,
    creditsBalance: ws.creditsBalance,
    chargeCredit: decision.allowed && decision.source === "topup",
  };
}

/** Atomically consume one top-up credit + write the ledger entry. Returns false if none left. */
export async function consumeTopupCredit(workspaceId: string, videoId: string): Promise<boolean> {
  const updated = await db
    .update(workspaces)
    .set({ creditsBalance: sql`${workspaces.creditsBalance} - 1` })
    .where(and(eq(workspaces.id, workspaceId), gt(workspaces.creditsBalance, 0)))
    .returning({ id: workspaces.id });

  if (updated.length === 0) return false;

  await db.insert(creditsLedger).values({
    workspaceId,
    delta: -1,
    reason: "video_render",
    refId: videoId,
    note: "Top-up credit consumed for video render",
  });
  return true;
}

/** Refund a top-up credit when a render fails terminally (after retries). */
export async function refundTopupCredit(workspaceId: string, videoId: string): Promise<void> {
  await db
    .update(workspaces)
    .set({ creditsBalance: sql`${workspaces.creditsBalance} + 1` })
    .where(eq(workspaces.id, workspaceId));

  await db.insert(creditsLedger).values({
    workspaceId,
    delta: 1,
    reason: "refund",
    refId: videoId,
    note: "Render failed — top-up credit refunded",
  });
}

/** Mark a video failed; refunds the top-up credit if it consumed one. */
export async function failVideo(
  workspaceId: string,
  videoId: string,
  reason: string,
  chargedCredit: boolean
): Promise<void> {
  await db
    .update(videos)
    .set({
      renderStatus: "failed",
      failureReason: reason.slice(0, 500),
      finishedAt: new Date(),
    })
    .where(eq(videos.id, videoId));

  if (chargedCredit) await refundTopupCredit(workspaceId, videoId);
}

/** True once a failed video has exhausted its retries (re-render still allowed manually). */
export function retriesExhausted(retryCount: number): boolean {
  return retryCount >= RENDER_MAX_RETRIES;
}
