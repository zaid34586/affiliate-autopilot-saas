import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { createDefaultReportSchedule } from "@/lib/analytics/reports";
import { reportSchedules } from "@aa/db";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * GET /api/dashboard/reports/schedules
 * Returns report schedules for the workspace.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const schedules = await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.workspaceId, workspaceId))
      .orderBy(desc(reportSchedules.createdAt));

    return NextResponse.json({ schedules });
  } catch (e) {
    console.error("Fetch schedules error:", e);
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }
}

/**
 * POST /api/dashboard/reports/schedules
 * Creates a new report schedule.
 * Body: { type: "daily" | "weekly" | "monthly", enabled?: boolean, sendTime?: string, timezone?: string }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: {
    type: "daily" | "weekly" | "monthly";
    enabled?: boolean;
    sendTime?: string;
    timezone?: string;
    recipients?: string[];
    format?: "html" | "pdf" | "markdown";
    includeAiInsights?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, enabled, sendTime, timezone, recipients, format, includeAiInsights } = body;
  if (!type || !["daily", "weekly", "monthly"].includes(type)) {
    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  }

  try {
    const now = new Date();
    let nextGen = new Date(now);

    switch (type) {
      case "daily":
        nextGen.setDate(nextGen.getDate() + 1);
        break;
      case "weekly":
        nextGen.setDate(nextGen.getDate() + 7);
        break;
      case "monthly":
        nextGen.setMonth(nextGen.getMonth() + 1);
        break;
    }

    const [hours, minutes] = (sendTime || "09:00").split(":").map(Number);
    nextGen.setHours(hours, minutes, 0, 0);

    const [schedule] = await db
      .insert(reportSchedules)
      .values({
        workspaceId,
        reportType: type,
        enabled: enabled ?? true,
        sendTime: sendTime || "09:00",
        timezone: timezone || "UTC",
        recipients: recipients || [],
        format: format || "html",
        includeAiInsights: includeAiInsights ?? true,
        nextGenerationAt: nextGen,
      })
      .returning();

    return NextResponse.json({ schedule });
  } catch (e) {
    console.error("Create schedule error:", e);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}