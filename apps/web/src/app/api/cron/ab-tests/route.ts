/**
 * Phase 6 — A/B Test Cron
 * POST /api/cron/ab-tests
 * Runs A/B test analysis and auto-creates tests from optimizer decisions
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { abTests } from "@aa/db";
import { eq } from "drizzle-orm";
import {
  runAbTestAnalysis,
  createAbTestsFromOptimizerDecisions,
} from "@/lib/optimizer/ab-test";

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
    // Get all workspaces with active A/B tests
    const activeTests = await db
      .select({ workspaceId: abTests.workspaceId })
      .from(abTests)
      .where(eq(abTests.status, "running"))
      .groupBy(abTests.workspaceId);

    const results = [];

    for (const { workspaceId } of activeTests) {
      // Analyze running tests
      const analyses = await runAbTestAnalysis(workspaceId);

      // Auto-create new tests from optimizer decisions
      const createdTests = await createAbTestsFromOptimizerDecisions(workspaceId);

      results.push({
        workspaceId,
        analyzed: analyses.length,
        created: createdTests.length,
        analyses,
        createdTests,
      });
    }

    return NextResponse.json({
      success: true,
      workspacesProcessed: results.length,
      results,
    });
  } catch (error) {
    console.error("A/B test cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 },
    );
  }
}