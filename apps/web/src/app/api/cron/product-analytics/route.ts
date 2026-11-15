/**
 * Phase 7 — Product Analytics Cron
 * POST /api/cron/product-analytics
 *
 * Daily: feature-usage rollup → MRR snapshot → churn signal detection.
 */

import { NextResponse } from "next/server";
import {
  rollupFeatureUsage,
  takeMrrSnapshot,
  detectChurnSignals,
} from "@/lib/analytics/product-analytics";

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Also allow in development
  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }

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
