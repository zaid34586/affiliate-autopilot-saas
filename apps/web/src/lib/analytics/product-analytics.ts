/**
 * Phase 7 — Product Analytics DB Orchestration.
 *
 * - Funnel computation (signup → activation → trial → paid)
 * - Feature usage tracking + daily rollup
 * - Retention cohorts (weekly)
 * - Churn signal detection
 * - MRR/ARR snapshots + AI cost per user (admin)
 */

import { db } from "@/lib/db";
import {
  productEvents,
  mrrSnapshots,
  featureUsageDaily,
  churnSignals,
  users,
  workspaces,
  subscriptions,
  jobsAudit,
} from "@aa/db";
import { eq, and, desc, asc, sql, gte, lte, inArray, count, sum, ne } from "drizzle-orm";
import {
  buildFunnel,
  computeRevenue,
  computeLtv,
  computeCac,
  ltvToCacRatio,
  computeAiCostPerUser,
  computeCohortRetention,
  assessChurnRisk,
  cohortKeyForWeek,
  CHURN_SIGNAL_WEIGHTS,
  FunnelResult,
  RevenueMetrics,
  CohortRow,
  ChurnAssessment,
} from "./product-analytics-core";

// ───────────────────────── EVENT TRACKING ─────────────────────────

export interface TrackEventInput {
  workspaceId?: string;
  userId?: string;
  event: string;
  properties?: Record<string, unknown>;
}

export async function trackProductEvent(input: TrackEventInput) {
  const [row] = await db
    .insert(productEvents)
    .values({
      workspaceId: input.workspaceId || null,
      userId: input.userId || null,
      event: input.event,
      properties: input.properties || {},
    })
    .returning({ id: productEvents.id });

  return row;
}

/** Count events per stage for a date range, keyed by canonical funnel event names. */
export async function getFunnelCounts(from: Date, to: Date): Promise<Record<string, number>> {
  const rows = await db
    .select({ event: productEvents.event, n: count() })
    .from(productEvents)
    .where(and(gte(productEvents.ts, from), lte(productEvents.ts, to)))
    .groupBy(productEvents.event);

  const byEvent: Record<string, number> = {};
  for (const r of rows) byEvent[r.event] = Number(r.n);
  return byEvent;
}

/**
 * Build the signup → activation → trial → paid funnel.
 * Uses product_events when available, falling back to source tables
 * (users.onboardingDone, subscriptions) for the cumulative view.
 */
export async function getSignupFunnel(options: { from?: Date; to?: Date } = {}): Promise<FunnelResult> {
  const from = options.from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const to = options.to ?? new Date();

  // Cumulative counts from source tables (always accurate)
  const [signupRow] = await db
    .select({ n: count() })
    .from(users)
    .where(and(gte(users.createdAt, from), lte(users.createdAt, to)))
    .limit(1);

  const [activationRow] = await db
    .select({ n: count() })
    .from(users)
    .where(and(gte(users.createdAt, from), lte(users.createdAt, to), eq(users.onboardingDone, true)))
    .limit(1);

  const [trialRow] = await db
    .select({ n: count() })
    .from(subscriptions)
    .where(
      and(
        ne(subscriptions.plan, "free"),
        gte(subscriptions.currentPeriodEnd, new Date()),
      ),
    )
    .limit(1);

  const [paidRow] = await db
    .select({ n: count() })
    .from(subscriptions)
    .where(and(ne(subscriptions.plan, "free"), eq(subscriptions.status, "active")))
    .limit(1);

  return buildFunnel({
    signup: Number(signupRow?.n || 0),
    activation: Number(activationRow?.n || 0),
    trial: Number(trialRow?.n || 0),
    paid: Number(paidRow?.n || 0),
  });
}

// ───────────────────────── FEATURE USAGE ─────────────────────────

/**
 * Record a feature usage event (convenience wrapper).
 * Events like "video_render", "dm_funnel_created", etc.
 */
export async function recordFeatureUsage(
  workspaceId: string,
  userId: string | null,
  feature: string,
  properties: Record<string, unknown> = {},
) {
  await trackProductEvent({ workspaceId, userId: userId ?? undefined, event: `feature:${feature}`, properties });
}

/** Roll up raw product_events into feature_usage_daily for a given day. */
export async function rollupFeatureUsage(day: Date): Promise<number> {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const dayStr = dayStart.toISOString().slice(0, 10);

  const rows = await db
    .select({
      workspaceId: productEvents.workspaceId,
      feature: productEvents.event,
      usageCount: count(),
      uniqueUsers: sql<number>`count(distinct ${productEvents.userId})::int`,
    })
    .from(productEvents)
    .where(
      and(
        gte(productEvents.ts, dayStart),
        lte(productEvents.ts, dayEnd),
        sql`${productEvents.event} LIKE 'feature:%'`,
      ),
    )
    .groupBy(productEvents.workspaceId, productEvents.event);

  let upserted = 0;
  for (const r of rows) {
    const feature = r.feature.replace(/^feature:/, "");
    if (!r.workspaceId) continue;

    await db
      .insert(featureUsageDaily)
      .values({
        day: dayStr,
        workspaceId: r.workspaceId,
        feature,
        usageCount: Number(r.usageCount),
        uniqueUsers: Number(r.uniqueUsers),
      })
      .onConflictDoUpdate({
        target: [featureUsageDaily.day, featureUsageDaily.workspaceId, featureUsageDaily.feature],
        set: {
          usageCount: r.usageCount,
          uniqueUsers: r.uniqueUsers,
        },
      });
    upserted++;
  }

  return upserted;
}

/** Get feature usage aggregated across workspaces for a date range (admin view). */
export async function getFeatureUsageSummary(from: Date, to: Date) {
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const rows = await db
    .select({
      feature: featureUsageDaily.feature,
      totalUsage: sum(featureUsageDaily.usageCount),
      activeWorkspaces: sql<number>`count(distinct ${featureUsageDaily.workspaceId})::int`,
    })
    .from(featureUsageDaily)
    .where(and(gte(featureUsageDaily.day, fromStr), lte(featureUsageDaily.day, toStr)))
    .groupBy(featureUsageDaily.feature)
    .orderBy(desc(sql`sum(${featureUsageDaily.usageCount})`));

  return rows.map((r) => ({
    feature: r.feature,
    totalUsage: Number(r.totalUsage || 0),
    activeWorkspaces: Number(r.activeWorkspaces || 0),
  }));
}

/** Per-workspace feature usage for the current user's dashboard. */
export async function getWorkspaceFeatureUsage(workspaceId: string, days = 30) {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fromStr = from.toISOString().slice(0, 10);

  const rows = await db
    .select({
      feature: featureUsageDaily.feature,
      totalUsage: sum(featureUsageDaily.usageCount),
      days: sql<number>`count(distinct ${featureUsageDaily.day})::int`,
    })
    .from(featureUsageDaily)
    .where(and(eq(featureUsageDaily.workspaceId, workspaceId), gte(featureUsageDaily.day, fromStr)))
    .groupBy(featureUsageDaily.feature)
    .orderBy(desc(sql`sum(${featureUsageDaily.usageCount})`));

  return rows.map((r) => ({
    feature: r.feature,
    totalUsage: Number(r.totalUsage || 0),
    activeDays: Number(r.days || 0),
  }));
}

// ───────────────────────── RETENTION COHORTS ─────────────────────────

/**
 * Weekly retention cohorts: for each signup week, how many were active in subsequent weeks.
 * Activity = any product_event in that week.
 */
export async function getRetentionCohorts(weeks = 12): Promise<CohortRow[]> {
  const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

  // 1) Cohort assignment: signup week per workspace (via owner user created_at)
  const signupRows = await db
    .select({
      workspaceId: workspaces.id,
      createdAt: users.createdAt,
    })
    .from(workspaces)
    .innerJoin(users, eq(users.id, workspaces.ownerUserId))
    .where(gte(users.createdAt, since));

  const cohortByWs = new Map<string, string>();
  for (const r of signupRows) {
    cohortByWs.set(r.workspaceId, cohortKeyForWeek(r.createdAt));
  }

  if (cohortByWs.size === 0) return [];

  // 2) Active workspaces per week
  const activityRows = await db
    .select({
      workspaceId: productEvents.workspaceId,
      ts: productEvents.ts,
    })
    .from(productEvents)
    .where(
      and(
        gte(productEvents.ts, since),
        inArray(productEvents.workspaceId, Array.from(cohortByWs.keys())),
      ),
    );

  // 3) Build cohort × period activity
  const cohortSizes = new Map<string, Set<string>>();
  const activeByCohortPeriod = new Map<string, Set<string>>();

  for (const [wsId, cohort] of cohortByWs) {
    if (!cohortSizes.has(cohort)) cohortSizes.set(cohort, new Set());
    cohortSizes.get(cohort)!.add(wsId);
  }

  const cohortWeeks = Array.from(cohortSizes.keys()).sort();
  const weekIndex = new Map(cohortWeeks.map((w, i) => [w, i]));

  for (const a of activityRows) {
    if (!a.workspaceId) continue;
    const signupCohort = cohortByWs.get(a.workspaceId);
    if (!signupCohort) continue;
    const activityWeek = cohortKeyForWeek(a.ts);
    const si = weekIndex.get(signupCohort);
    const ai = weekIndex.get(activityWeek);
    if (si === undefined || ai === undefined || ai < si) continue;

    const key = `${signupCohort}|${ai - si}`;
    if (!activeByCohortPeriod.has(key)) activeByCohortPeriod.set(key, new Set());
    activeByCohortPeriod.get(key)!.add(a.workspaceId);
  }

  const activities = [];
  for (const [cohort, sizeSet] of cohortSizes) {
    for (let p = 0; p < cohortWeeks.length - (weekIndex.get(cohort) ?? 0); p++) {
      const active = activeByCohortPeriod.get(`${cohort}|${p}`);
      activities.push({
        cohort,
        periodIndex: p,
        cohortSize: sizeSet.size,
        activeCount: active ? active.size : 0,
      });
    }
  }

  return computeCohortRetention(activities);
}

// ───────────────────────── CHURN SIGNALS ─────────────────────────

/**
 * Detect churn signals for all workspaces (cron-friendly).
 * Returns the assessments written to churn_signals.
 */
export async function detectChurnSignals(): Promise<{ workspaceId: string; assessment: ChurnAssessment }[]> {
  const now = new Date();
  const inactive7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const inactive14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const inactive30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Workspaces with any activity in last 30d (event-based)
  const activeRows = await db
    .select({
      workspaceId: productEvents.workspaceId,
      lastTs: sql<Date>`max(${productEvents.ts})`,
    })
    .from(productEvents)
    .where(and(gte(productEvents.ts, inactive30), sql`${productEvents.workspaceId} IS NOT NULL`))
    .groupBy(productEvents.workspaceId);

  const lastActivity = new Map<string, Date>();
  for (const r of activeRows) {
    if (r.workspaceId) lastActivity.set(r.workspaceId, new Date(r.lastTs));
  }

  // All workspaces
  const wsRows = await db.select({ id: workspaces.id, plan: workspaces.plan }).from(workspaces);
  if (wsRows.length === 0) return [];

  const results: { workspaceId: string; assessment: ChurnAssessment }[] = [];

  for (const ws of wsRows) {
    const signals: string[] = [];
    const last = lastActivity.get(ws.id);

    if (!last || last < inactive30) signals.push("inactive_30d");
    else if (last < inactive14) signals.push("inactive_14d");
    else if (last < inactive7) signals.push("inactive_7d");

    // Low usage: fewer than 5 events in last 30d
    const [evtRow] = await db
      .select({ n: count() })
      .from(productEvents)
      .where(
        and(
          eq(productEvents.workspaceId, ws.id),
          gte(productEvents.ts, inactive30),
        ),
      )
      .limit(1);
    if (Number(evtRow?.n || 0) < 5) signals.push("low_usage");

    // Payment failed / past due
    const [subRow] = await db
      .select({ status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, ws.id))
      .limit(1);
    if (subRow?.status === "past_due") signals.push("payment_failed");

    if (signals.length === 0) continue;

    const assessment = assessChurnRisk(signals);

    // Upsert signal rows (one per workspace per signal type — keep only aggregate row)
    // We store the aggregate assessment under signal = "aggregate" plus individual rows.
    await db
      .insert(churnSignals)
      .values({
        workspaceId: ws.id,
        signal: "aggregate",
        severity: assessment.severity,
        score: assessment.score,
        details: { signals: assessment.signals },
        detectedAt: now,
      })
      .onConflictDoUpdate({
        target: [churnSignals.workspaceId, churnSignals.signal],
        set: {
          severity: assessment.severity,
          score: assessment.score,
          details: { signals: assessment.signals },
          detectedAt: now,
          resolvedAt: null,
        },
      });

    results.push({ workspaceId: ws.id, assessment });
  }

  return results;
}

/** Get open churn signals for a workspace (or all, for admin). */
export async function getChurnSignals(workspaceId?: string, minScore = 0) {
  const conditions = [gte(churnSignals.score, minScore), sql`${churnSignals.resolvedAt} IS NULL`];
  if (workspaceId) conditions.push(eq(churnSignals.workspaceId, workspaceId));

  const rows = await db
    .select()
    .from(churnSignals)
    .where(and(...conditions))
    .orderBy(desc(churnSignals.score))
    .limit(200);

  return rows;
}

// ───────────────────────── MRR / AI COST (ADMIN) ─────────────────────────

/**
 * Take a daily MRR + AI cost snapshot. Idempotent per day (upsert).
 */
export async function takeMrrSnapshot(day = new Date()): Promise<void> {
  const dayStr = day.toISOString().slice(0, 10);

  // Plan distribution (active, non-trial-expired)
  const planRows = await db
    .select({ plan: subscriptions.plan, n: count() })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"))
    .groupBy(subscriptions.plan);

  const planCounts: Record<string, number> = {};
  for (const r of planRows) planCounts[r.plan] = Number(r.n);

  // Free workspaces without a subscription row
  const [subbedWs] = await db
    .select({ n: sql<number>`count(distinct ${subscriptions.workspaceId})::int` })
    .from(subscriptions)
    .limit(1);
  const [totalWs] = await db.select({ n: count() }).from(workspaces).limit(1);
  planCounts.free = Math.max(0, Number(totalWs?.n || 0) - Number(subbedWs?.n || 0));

  const revenue = computeRevenue(planCounts);

  // New paid this day
  const dayStart = new Date(`${dayStr}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const [newPaidRow] = await db
    .select({ n: count() })
    .from(subscriptions)
    .where(
      and(
        ne(subscriptions.plan, "free"),
        eq(subscriptions.status, "active"),
        gte(subscriptions.currentPeriodEnd, dayEnd),
      ),
    )
    .limit(1);

  // Churned: subscriptions with currentPeriodEnd before day end (lapsed)
  const [churnedRow] = await db
    .select({ n: count() })
    .from(subscriptions)
    .where(and(ne(subscriptions.plan, "free"), lte(subscriptions.currentPeriodEnd, dayEnd)))
    .limit(1);

  // AI cost that day (from jobs audit)
  const [aiRow] = await db
    .select({ cost: sum(jobsAudit.costUsd) })
    .from(jobsAudit)
    .where(and(gte(jobsAudit.startedAt, dayStart), lte(jobsAudit.startedAt, dayEnd)))
    .limit(1);

  await db
    .insert(mrrSnapshots)
    .values({
      day: dayStr,
      mrrCents: revenue.mrrCents,
      arrCents: revenue.arrCents,
      paidWorkspaces: revenue.paidWorkspaces,
      trialWorkspaces: Number(newPaidRow?.n || 0),
      newPaid: Number(newPaidRow?.n || 0),
      churnedPaid: Number(churnedRow?.n || 0),
      freeWorkspaces: revenue.freeWorkspaces,
      aiCostUsd: String(Number(aiRow?.cost || 0)),
      arpuCents: revenue.arpuCents,
    })
    .onConflictDoUpdate({
      target: [mrrSnapshots.day],
      set: {
        mrrCents: revenue.mrrCents,
        arrCents: revenue.arrCents,
        paidWorkspaces: revenue.paidWorkspaces,
        trialWorkspaces: Number(newPaidRow?.n || 0),
        newPaid: Number(newPaidRow?.n || 0),
        churnedPaid: Number(churnedRow?.n || 0),
        freeWorkspaces: revenue.freeWorkspaces,
        aiCostUsd: String(Number(aiRow?.cost || 0)),
        arpuCents: revenue.arpuCents,
      },
    });
}

/** Get MRR snapshot history. */
export async function getMrrHistory(days = 90) {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fromStr = from.toISOString().slice(0, 10);

  return db
    .select()
    .from(mrrSnapshots)
    .where(gte(mrrSnapshots.day, fromStr))
    .orderBy(asc(mrrSnapshots.day));
}

/**
 * Full admin metrics: revenue, LTV/CAC, AI cost per user, funnel.
 */
export async function getAdminMetrics(options: {
  from?: Date;
  to?: Date;
  /** Monthly sales & marketing spend in cents for CAC */
  cacSpendCents?: number;
  monthlyChurnRate?: number;
} = {}) {
  const {
    from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    to = new Date(),
    cacSpendCents = 0,
    monthlyChurnRate = 0.05,
  } = options;

  const planRows = await db
    .select({ plan: subscriptions.plan, n: count() })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"))
    .groupBy(subscriptions.plan);

  const planCounts: Record<string, number> = {};
  for (const r of planRows) planCounts[r.plan] = Number(r.n);

  const [subbedWs] = await db
    .select({ n: sql<number>`count(distinct ${subscriptions.workspaceId})::int` })
    .from(subscriptions)
    .limit(1);
  const [totalWs] = await db.select({ n: count() }).from(workspaces).limit(1);
  planCounts.free = Math.max(0, Number(totalWs?.n || 0) - Number(subbedWs?.n || 0));

  const revenue = computeRevenue(planCounts);

  // New paid in range (approximation: subscriptions whose period end is in the future and were created... we don't have created_at on subscriptions)
  // Fallback: use mrr_snapshots newPaid sum if present, else 0.
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  const [newPaidAgg] = await db
    .select({ n: sql<number>`coalesce(sum(${mrrSnapshots.newPaid}), 0)::int` })
    .from(mrrSnapshots)
    .where(and(gte(mrrSnapshots.day, fromStr), lte(mrrSnapshots.day, toStr)))
    .limit(1);

  const newPaid = Number(newPaidAgg?.n || 0);
  const cacCents = computeCac(cacSpendCents, newPaid);
  const ltvCents = computeLtv(revenue.arpuCents, monthlyChurnRate);
  const ratio = ltvToCacRatio(ltvCents, cacCents);

  // AI cost in range
  const [aiAgg] = await db
    .select({ cost: sum(jobsAudit.costUsd) })
    .from(jobsAudit)
    .where(and(gte(jobsAudit.startedAt, from), lte(jobsAudit.startedAt, to)))
    .limit(1);

  const [activeWsAgg] = await db
    .select({ n: sql<number>`count(distinct ${productEvents.workspaceId})::int` })
    .from(productEvents)
    .where(and(gte(productEvents.ts, from), lte(productEvents.ts, to)))
    .limit(1);

  const aiCost = computeAiCostPerUser(
    Number(aiAgg?.cost || 0),
    Number(activeWsAgg?.n || 0),
  );

  const funnel = await getSignupFunnel({ from, to });

  return {
    revenue,
    funnel,
    cac: { spendCents: cacSpendCents, newPaid, cacCents },
    ltv: { arpuCents: revenue.arpuCents, monthlyChurnRate, ltvCents, ltvToCac: ratio },
    aiCost,
    churn: { count: (await getChurnSignals(undefined, 30)).length },
  };
}
