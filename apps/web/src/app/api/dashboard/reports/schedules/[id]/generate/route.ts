import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { generateAIReport, updateScheduleAfterGeneration } from "@/lib/analytics/reports";
import type { ReportType } from "@/lib/analytics/reports";
import { reportSchedules } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * POST /api/dashboard/reports/schedules/[id]/generate
 * Generates a report for a specific schedule.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;
  const { id } = await params;

  try {
    const [schedule] = await db
      .select()
      .from(reportSchedules)
      .where(and(eq(reportSchedules.id, id), eq(reportSchedules.workspaceId, workspaceId)))
      .limit(1);

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    // Generate the report
    const report = await generateAIReport(workspaceId, schedule.reportType as ReportType);

    // Update schedule with next generation time
    await updateScheduleAfterGeneration(id);

    return NextResponse.json({ report, schedule: { ...schedule, lastGeneratedAt: new Date() } });
  } catch (e) {
    console.error("Generate scheduled report error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate report" },
      { status: 500 }
    );
  }
}