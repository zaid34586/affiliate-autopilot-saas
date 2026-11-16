/**
 * Phase 7 — Product Analytics Cron
 *
 * Daily: feature-usage rollup → MRR snapshot → churn signal detection.
 * GET (Vercel Cron default) and POST both run the job; both are authorized
 * with the shared CRON_SECRET (see src/lib/cron-auth.ts).
 */

import { NextResponse } from "next/server";
import { cronGuard } from "@/lib/cron-auth";
import {
  rollupFeatureUsage,
  takeMrrSnapshot,
  detectChurnSignals,
} from "@/lib/analytics/product-analytics";

export async function GET(req: Request) {
  return runProductAnalyticsCron(req);
}

export async function POST(req: Request) {
  return runProductAnalyticsCron(req);
}

async function runProductAnalyticsCron(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

  try {
    const now = new Date();

    const upserted = await rollupFeatureUsage(now);
    await takeMrrSnapshot(now);
    const churnResults = await detectChurnSignals();

    return NextResponse.json({
      success: true,
      featureUsageRows: upserted,
      churnSignals: churnResults.length,
      highRisk: churnResults.filter((r) => r.assessment.severity === "high").length,
    });
  } catch (error) {
    console.error("Product analytics cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 },
    );
  }
}
