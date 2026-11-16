// Phase 6 Module B — AI Reports cron.
// Generates scheduled AI reports for all workspaces.
// Vercel Cron sends GET; POST works too — both are authorized via CRON_SECRET
// and run the same job (see src/lib/cron-auth.ts).
import { db } from "@/lib/db";
import { reportSchedules, workspaces } from "@aa/db";
import { eq, lte, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateAIReport, updateScheduleAfterGeneration } from "@/lib/analytics/reports";
import type { ReportType } from "@/lib/analytics/reports";
import { cronGuard } from "@/lib/cron-auth";

export const maxDuration = 120;

export async function GET(req: Request) {
  return runReportsCron(req);
}

export async function POST(req: Request) {
  return runReportsCron(req);
}

async function runReportsCron(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

  try {
    const now = new Date();

    // Get all enabled schedules that are due
    const dueSchedules = await db
      .select()
      .from(reportSchedules)
      .where(and(eq(reportSchedules.enabled, true), lte(reportSchedules.nextGenerationAt, now)));

    let generated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const schedule of dueSchedules) {
      try {
        // Generate the report
        await generateAIReport(schedule.workspaceId, schedule.reportType as ReportType);

        // Update schedule with next generation time
        await updateScheduleAfterGeneration(schedule.id);

        generated++;
      } catch (e) {
        failed++;
        errors.push(`${schedule.workspaceId} (${schedule.reportType}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      schedulesProcessed: dueSchedules.length,
      reportsGenerated: generated,
      reportsFailed: failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("Reports cron error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Reports cron failed" },
      { status: 500 },
    );
  }
}