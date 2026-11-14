// Phase 6 Module B — AI Reports cron (runs daily at 6 AM).
// Generates scheduled AI reports for all workspaces.
import { db } from "@/lib/db";
import { reportSchedules, workspaces } from "@aa/db";
import { eq, lte, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateAIReport, updateScheduleAfterGeneration } from "@/lib/analytics/reports";
import type { ReportType } from "@/lib/analytics/reports";

const CRON_SECRET = process.env.REPORTS_CRON_SECRET?.trim();

export const maxDuration = 120;

export async function POST(req: Request) {
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (CRON_SECRET) {
    if (provided !== CRON_SECRET) {
      return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "REPORTS_CRON_SECRET not configured" },
      { status: 503 },
    );
  }

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

export async function GET() {
  return NextResponse.json({ ok: true, service: "reports-cron" });
}