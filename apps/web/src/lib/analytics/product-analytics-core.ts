/**
 * Phase 7 — Product Analytics Core (pure logic).
 *
 * Funnels: signup → activation → trial → paid
 * Metrics: MRR/ARR, LTV, CAC, churn rate, AI cost per user
 * Retention: weekly/monthly cohorts
 * Churn: risk scoring from signals
 */

// ───────────────────────── FUNNELS ─────────────────────────

export type FunnelStage = "signup" | "activation" | "trial" | "paid";

export const FUNNEL_STAGES: FunnelStage[] = ["signup", "activation", "trial", "paid"];

export interface FunnelStep {
  stage: FunnelStage;
  count: number;
  /** % of previous step */
  conversionFromPrev: number;
  /** % of first step (signup) */
  conversionFromStart: number;
  /** Absolute drop from previous step */
  dropOff: number;
}

export interface FunnelResult {
  steps: FunnelStep[];
  overallConversion: number; // signup → paid
}

/**
 * Build a funnel from stage counts. Counts must be non-increasing;
 * if a later stage exceeds an earlier one we clamp it (data anomaly guard).
 */
export function buildFunnel(counts: Record<FunnelStage, number>): FunnelResult {
  const steps: FunnelStep[] = [];
  let prev = counts.signup;

  for (const stage of FUNNEL_STAGES) {
    const raw = counts[stage];
    const count = stage === "signup" ? raw : Math.min(raw, prev);
    const conversionFromPrev = prev > 0 ? (count / prev) * 100 : 0;
    const conversionFromStart = counts.signup > 0 ? (count / counts.signup) * 100 : 0;

    steps.push({
      stage,
      count,
      conversionFromPrev: round2(conversionFromPrev),
      conversionFromStart: round2(conversionFromStart),
      dropOff: prev - count,
    });
    prev = count;
  }

  return {
    steps,
    overallConversion: counts.signup > 0 ? round2((steps[3].count / counts.signup) * 100) : 0,
  };
}

// ───────────────────────── REVENUE METRICS ─────────────────────────

/** Monthly plan prices in cents (matches pricing page: Starter $29 / Pro $79 / Agency $249). */
export const PLAN_MONTHLY_CENTS: Record<string, number> = {
  free: 0,
  starter: 2900,
  pro: 7900,
  agency: 24900,
};

export interface RevenueMetrics {
  mrrCents: number;
  arrCents: number;
  paidWorkspaces: number;
  arpuCents: number; // MRR / paid workspaces
  freeWorkspaces: number;
}

export function computeRevenue(
  planCounts: Record<string, number>,
): RevenueMetrics {
  let mrrCents = 0;
  let paidWorkspaces = 0;
  let freeWorkspaces = 0;

  for (const [plan, count] of Object.entries(planCounts)) {
    const price = PLAN_MONTHLY_CENTS[plan] ?? 0;
    mrrCents += price * count;
    if (plan === "free" || price === 0) freeWorkspaces += count;
    else paidWorkspaces += count;
  }

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    paidWorkspaces,
    arpuCents: paidWorkspaces > 0 ? Math.round(mrrCents / paidWorkspaces) : 0,
    freeWorkspaces,
  };
}

/**
 * LTV = ARPU × gross margin ÷ monthly churn rate.
 * Churn rate is monthly (0.05 = 5%). Guard against 0 churn → cap at 60 months.
 */
export function computeLtv(arpuCents: number, monthlyChurnRate: number, grossMargin = 0.8): number {
  if (arpuCents <= 0) return 0;
  if (monthlyChurnRate <= 0) return Math.round(arpuCents * grossMargin * 60); // cap
  const ltv = (arpuCents * grossMargin) / monthlyChurnRate;
  return Math.round(ltv);
}

/** CAC = sales & marketing spend ÷ new paid customers in period. */
export function computeCac(spendCents: number, newPaidCustomers: number): number {
  if (newPaidCustomers <= 0) return 0;
  return Math.round(spendCents / newPaidCustomers);
}

/** LTV : CAC ratio. Healthy SaaS = ≥ 3. */
export function ltvToCacRatio(ltvCents: number, cacCents: number): number {
  if (cacCents <= 0) return 0;
  return round2(ltvCents / cacCents);
}

export interface AiCostMetrics {
  totalCostUsd: number;
  activeWorkspaces: number;
  costPerWorkspaceUsd: number;
  costPerEventUsd: number;
}

export function computeAiCostPerUser(
  totalCostUsd: number,
  activeWorkspaces: number,
  aiEvents = 0,
): AiCostMetrics {
  return {
    totalCostUsd: round4(totalCostUsd),
    activeWorkspaces,
    costPerWorkspaceUsd: activeWorkspaces > 0 ? round4(totalCostUsd / activeWorkspaces) : 0,
    costPerEventUsd: aiEvents > 0 ? round4(totalCostUsd / aiEvents) : 0,
  };
}

// ───────────────────────── RETENTION COHORTS ─────────────────────────

export interface CohortActivity {
  /** ISO week (YYYY-Www) or month (YYYY-MM) of the cohort */
  cohort: string;
  /** period index: 0 = signup period, 1 = next period, ... */
  periodIndex: number;
  cohortSize: number;
  activeCount: number;
}

export interface CohortRow {
  cohort: string;
  periodIndex: number;
  cohortSize: number;
  activeCount: number;
  retentionPct: number;
}

export function computeCohortRetention(activities: CohortActivity[]): CohortRow[] {
  const byCohort = new Map<string, { size: number; periods: Map<number, number> }>();

  for (const a of activities) {
    let entry = byCohort.get(a.cohort);
    if (!entry) {
      entry = { size: 0, periods: new Map() };
      byCohort.set(a.cohort, entry);
    }
    entry.size = Math.max(entry.size, a.cohortSize);
    entry.periods.set(a.periodIndex, Math.max(entry.periods.get(a.periodIndex) ?? 0, a.activeCount));
  }

  const rows: CohortRow[] = [];
  for (const [cohort, { size, periods }] of byCohort) {
    for (const [periodIndex, activeCount] of periods) {
      rows.push({
        cohort,
        periodIndex,
        cohortSize: size,
        activeCount,
        retentionPct: size > 0 ? round2((activeCount / size) * 100) : 0,
      });
    }
  }

  return rows.sort((a, b) => a.cohort.localeCompare(b.cohort) || a.periodIndex - b.periodIndex);
}

/** Build ISO-week key for a date, e.g. "2026-W46". */
export function cohortKeyForWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Build month key for a date, e.g. "2026-11". */
export function cohortKeyForMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ───────────────────────── CHURN SCORING ─────────────────────────

export type ChurnSeverity = "low" | "medium" | "high";

export interface ChurnSignalDef {
  signal: string;
  score: number;
  severity: ChurnSeverity;
}

/** Base churn signal weights (0-100 risk contribution). */
export const CHURN_SIGNAL_WEIGHTS: Record<string, { score: number; severity: ChurnSeverity }> = {
  inactive_7d: { score: 25, severity: "low" },
  inactive_14d: { score: 45, severity: "medium" },
  inactive_30d: { score: 70, severity: "high" },
  low_usage: { score: 20, severity: "low" },
  no_video_14d: { score: 15, severity: "low" },
  plan_downgrade: { score: 50, severity: "medium" },
  payment_failed: { score: 65, severity: "high" },
  trial_expired: { score: 60, severity: "high" },
  support_ticket_open: { score: 10, severity: "low" },
};

export interface ChurnAssessment {
  score: number; // 0-100 aggregate risk
  severity: ChurnSeverity;
  signals: Array<{ signal: string; score: number; severity: ChurnSeverity }>;
}

/**
 * Aggregate multiple churn signals into an overall risk score.
 * Score is capped at 100; severity thresholds: ≥60 high, ≥30 medium, else low.
 */
export function assessChurnRisk(signals: string[]): ChurnAssessment {
  const matched: Array<{ signal: string; score: number; severity: ChurnSeverity }> = [];
  let total = 0;

  for (const s of signals) {
    const w = CHURN_SIGNAL_WEIGHTS[s];
    if (!w) continue;
    matched.push({ signal: s, score: w.score, severity: w.severity });
    total += w.score;
  }

  const score = Math.min(100, total);
  const severity: ChurnSeverity = score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  return { score, severity, signals: matched };
}

// ───────────────────────── HELPERS ─────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
