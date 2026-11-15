/**
 * Phase 7 — Product Analytics Core Tests
 */

import { describe, it, expect } from "vitest";
import {
  buildFunnel,
  computeRevenue,
  computeLtv,
  computeCac,
  ltvToCacRatio,
  computeAiCostPerUser,
  computeCohortRetention,
  cohortKeyForWeek,
  cohortKeyForMonth,
  assessChurnRisk,
  CHURN_SIGNAL_WEIGHTS,
  PLAN_MONTHLY_CENTS,
} from "./product-analytics-core";

describe("buildFunnel", () => {
  it("computes step conversions and overall conversion", () => {
    const r = buildFunnel({ signup: 1000, activation: 600, trial: 300, paid: 150 });

    expect(r.steps).toHaveLength(4);
    expect(r.steps[0].count).toBe(1000);
    expect(r.steps[1].conversionFromPrev).toBe(60);
    expect(r.steps[2].conversionFromPrev).toBe(50);
    expect(r.steps[3].conversionFromPrev).toBe(50);
    expect(r.steps[3].conversionFromStart).toBe(15);
    expect(r.overallConversion).toBe(15);
    expect(r.steps[1].dropOff).toBe(400);
  });

  it("clamps non-monotonic counts (data anomaly guard)", () => {
    const r = buildFunnel({ signup: 100, activation: 150, trial: 10, paid: 5 });
    expect(r.steps[1].count).toBe(100); // clamped to signup
    expect(r.steps[1].conversionFromPrev).toBe(100);
  });

  it("handles zero signup without division by zero", () => {
    const r = buildFunnel({ signup: 0, activation: 0, trial: 0, paid: 0 });
    expect(r.overallConversion).toBe(0);
    expect(r.steps.every((s) => s.conversionFromPrev === 0)).toBe(true);
  });

  it("handles zero middle stage", () => {
    const r = buildFunnel({ signup: 100, activation: 0, trial: 0, paid: 0 });
    expect(r.steps[1].conversionFromPrev).toBe(0);
    expect(r.steps[3].conversionFromStart).toBe(0);
  });
});

describe("computeRevenue", () => {
  it("computes MRR/ARR from plan counts", () => {
    const r = computeRevenue({ free: 50, starter: 10, pro: 5, agency: 1 });
    // 10*2900 + 5*7900 + 1*24900 = 29000 + 39500 + 24900 = 93400
    expect(r.mrrCents).toBe(93400);
    expect(r.arrCents).toBe(93400 * 12);
    expect(r.paidWorkspaces).toBe(16);
    expect(r.freeWorkspaces).toBe(50);
    expect(r.arpuCents).toBe(Math.round(93400 / 16));
  });

  it("returns zeros for all-free", () => {
    const r = computeRevenue({ free: 100 });
    expect(r.mrrCents).toBe(0);
    expect(r.paidWorkspaces).toBe(0);
    expect(r.arpuCents).toBe(0);
  });

  it("has plan prices matching pricing page", () => {
    expect(PLAN_MONTHLY_CENTS.starter).toBe(2900);
    expect(PLAN_MONTHLY_CENTS.pro).toBe(7900);
    expect(PLAN_MONTHLY_CENTS.agency).toBe(24900);
    expect(PLAN_MONTHLY_CENTS.free).toBe(0);
  });
});

describe("computeLtv", () => {
  it("computes ARPU × margin ÷ churn", () => {
    // ARPU $50, churn 5%/mo, margin 80% → 50*0.8/0.05 = 800
    expect(computeLtv(5000, 0.05, 0.8)).toBe(80000);
  });

  it("caps at 60 months when churn is 0", () => {
    expect(computeLtv(5000, 0, 0.8)).toBe(5000 * 0.8 * 60);
  });

  it("returns 0 for zero ARPU", () => {
    expect(computeLtv(0, 0.05)).toBe(0);
  });
});

describe("computeCac", () => {
  it("divides spend by new customers", () => {
    expect(computeCac(100000, 10)).toBe(10000);
  });

  it("returns 0 with no new customers", () => {
    expect(computeCac(100000, 0)).toBe(0);
  });
});

describe("ltvToCacRatio", () => {
  it("computes ratio", () => {
    expect(ltvToCacRatio(80000, 20000)).toBe(4);
  });

  it("returns 0 when CAC is 0", () => {
    expect(ltvToCacRatio(80000, 0)).toBe(0);
  });
});

describe("computeAiCostPerUser", () => {
  it("computes cost per workspace and per event", () => {
    const r = computeAiCostPerUser(100, 8, 1000);
    expect(r.costPerWorkspaceUsd).toBe(12.5);
    expect(r.costPerEventUsd).toBe(0.1);
    expect(r.totalCostUsd).toBe(100);
  });

  it("guards zero active workspaces", () => {
    const r = computeAiCostPerUser(100, 0);
    expect(r.costPerWorkspaceUsd).toBe(0);
  });
});

describe("cohort keys", () => {
  it("builds month key", () => {
    expect(cohortKeyForMonth(new Date("2026-11-15"))).toBe("2026-11");
    expect(cohortKeyForMonth(new Date("2026-01-05"))).toBe("2026-01");
  });

  it("builds stable week key", () => {
    const k1 = cohortKeyForWeek(new Date("2026-11-15")); // Sunday
    const k2 = cohortKeyForWeek(new Date("2026-11-09")); // Monday, same ISO week
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("different weeks get different keys", () => {
    expect(cohortKeyForWeek(new Date("2026-11-15"))).not.toBe(
      cohortKeyForWeek(new Date("2026-11-02")),
    );
  });
});

describe("computeCohortRetention", () => {
  it("computes retention percentages per cohort/period", () => {
    const rows = computeCohortRetention([
      { cohort: "2026-W40", periodIndex: 0, cohortSize: 100, activeCount: 100 },
      { cohort: "2026-W40", periodIndex: 1, cohortSize: 100, activeCount: 60 },
      { cohort: "2026-W40", periodIndex: 2, cohortSize: 100, activeCount: 45 },
      { cohort: "2026-W41", periodIndex: 0, cohortSize: 50, activeCount: 50 },
    ]);

    expect(rows).toHaveLength(4);
    expect(rows[0].retentionPct).toBe(100);
    expect(rows[1].retentionPct).toBe(60);
    expect(rows[2].retentionPct).toBe(45);
    expect(rows[3].retentionPct).toBe(100);
  });

  it("sorts by cohort then period", () => {
    const rows = computeCohortRetention([
      { cohort: "2026-W41", periodIndex: 0, cohortSize: 10, activeCount: 10 },
      { cohort: "2026-W40", periodIndex: 1, cohortSize: 20, activeCount: 10 },
      { cohort: "2026-W40", periodIndex: 0, cohortSize: 20, activeCount: 20 },
    ]);
    expect(rows.map((r) => `${r.cohort}:${r.periodIndex}`)).toEqual([
      "2026-W40:0",
      "2026-W40:1",
      "2026-W41:0",
    ]);
  });

  it("guards zero cohort size", () => {
    const rows = computeCohortRetention([
      { cohort: "2026-W40", periodIndex: 0, cohortSize: 0, activeCount: 0 },
    ]);
    expect(rows[0].retentionPct).toBe(0);
  });
});

describe("assessChurnRisk", () => {
  it("returns zero risk with no signals", () => {
    const r = assessChurnRisk([]);
    expect(r.score).toBe(0);
    expect(r.severity).toBe("low");
    expect(r.signals).toHaveLength(0);
  });

  it("aggregates known signals and assigns severity", () => {
    const low = assessChurnRisk(["inactive_7d"]); // 25 → low
    expect(low.score).toBe(25);
    expect(low.severity).toBe("low");

    const medium = assessChurnRisk(["inactive_14d", "low_usage"]); // 45+20=65 → high
    expect(medium.score).toBe(65);
    expect(medium.severity).toBe("high");

    const mid2 = assessChurnRisk(["inactive_14d"]); // 45 → medium (≥30)
    expect(mid2.severity).toBe("medium");
  });

  it("caps score at 100", () => {
    const all = Object.keys(CHURN_SIGNAL_WEIGHTS);
    const r = assessChurnRisk(all);
    expect(r.score).toBe(100);
    expect(r.severity).toBe("high");
  });

  it("ignores unknown signals", () => {
    const r = assessChurnRisk(["totally_unknown_signal"]);
    expect(r.score).toBe(0);
    expect(r.signals).toHaveLength(0);
  });
});
