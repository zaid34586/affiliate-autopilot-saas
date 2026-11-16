/**
 * Phase 6 — A/B Test Cron
 * Runs A/B test analysis and auto-creates tests from optimizer decisions
 * GET (Vercel Cron default) and POST both run the job; both are authorized
 * with the shared CRON_SECRET (see src/lib/cron-auth.ts).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { abTests } from "@aa/db";
import { eq } from "drizzle-orm";
import { cronGuard } from "@/lib/cron-auth";
import {
  runAbTestAnalysis,
  createAbTestsFromOptimizerDecisions,
} from "@/lib/optimizer/ab-test";

export async function GET(req: Request) {
  return runAbTestsCron(req);
}

export async function POST(req: Request) {
  return runAbTestsCron(req);
}

async function runAbTestsCron(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

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