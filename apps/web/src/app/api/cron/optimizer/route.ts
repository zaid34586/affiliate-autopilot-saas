// Phase 6 — Auto-Optimizer cron.
// Analyzes post performance and makes optimization decisions.
// Vercel Cron sends GET; POST works too — both are authorized via CRON_SECRET
// and run the same job (see src/lib/cron-auth.ts).
import { db } from "@/lib/db";
import { optimizerState, posts } from "@aa/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getOptimizerConfig, loadPostMetrics, runOptimizer, recordDecisions, loadOptimizerDashboard } from "@/lib/optimizer/optimizer";
import { cronGuard } from "@/lib/cron-auth";

export const maxDuration = 120;

export async function GET(req: Request) {
  return runOptimizerCron(req);
}

export async function POST(req: Request) {
  return runOptimizerCron(req);
}

async function runOptimizerCron(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

  try {
    const workspaces = await db
      .select({ workspaceId: optimizerState.workspaceId })
      .from(optimizerState)
      .where(eq(optimizerState.enabled, true));

    let totalDecisions = 0;
    let totalExecuted = 0;
    const errors: string[] = [];

    for (const ws of workspaces) {
      const workspaceId = ws.workspaceId;

      try {
        const config = await getOptimizerConfig(workspaceId);
        const postsData = await loadPostMetrics(workspaceId, config.lookbackDays);

        const decisions = runOptimizer(postsData, config);

        if (decisions.length > 0) {
          await recordDecisions(workspaceId, decisions);
          totalDecisions += decisions.length;
        }

        // Auto-execute high-confidence decisions in "aggressive" mode
        const config_ = await getOptimizerConfig(workspaceId);
        if (config_.mode === "aggressive") {
          for (const decision of decisions) {
            if (decision.confidence >= 85 && ["boost", "pause"].includes(decision.decisionType)) {
              const { executeDecision } = await import("@/lib/optimizer/optimizer");
              const result = await executeDecision(workspaceId, decision.targetId);
              if (result.success) totalExecuted++;
            }
          }
        }

      } catch (e) {
        errors.push(`${workspaceId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      workspacesProcessed: workspaces.length,
      decisionsCreated: totalDecisions,
      decisionsExecuted: totalExecuted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("Optimizer cron error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Optimizer cron failed" },
      { status: 500 },
    );
  }
}