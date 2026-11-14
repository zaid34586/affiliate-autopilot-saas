import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { reportSchedules } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * PATCH /api/dashboard/reports/schedules/[id]
 * Updates a report schedule.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;
  const { id } = await params;

  let body: Partial<{
    enabled: boolean;
    sendTime: string;
    timezone: string;
    recipients: string[];
    format: "html" | "pdf" | "markdown";
    includeAiInsights: boolean;
  }>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const [existing] = await db
      .select()
      .from(reportSchedules)
      .where(and(eq(reportSchedules.id, id), eq(reportSchedules.workspaceId, workspaceId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.sendTime !== undefined) updateData.sendTime = body.sendTime;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.recipients !== undefined) updateData.recipients = body.recipients;
    if (body.format !== undefined) updateData.format = body.format;
    if (body.includeAiInsights !== undefined) updateData.includeAiInsights = body.includeAiInsights;

    // Recalculate nextGenerationAt if sendTime or timezone changed
    if (body.sendTime !== undefined || body.timezone !== undefined) {
      const now = new Date();
      let nextGen = new Date(now);

      switch (existing.reportType) {
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

      const [hours, minutes] = (body.sendTime || existing.sendTime || "09:00").split(":").map(Number);
      nextGen.setHours(hours, minutes, 0, 0);
      updateData.nextGenerationAt = nextGen;
    }

    await db
      .update(reportSchedules)
      .set(updateData)
      .where(eq(reportSchedules.id, id));

    const [updated] = await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.id, id))
      .limit(1);

    return NextResponse.json({ schedule: updated });
  } catch (e) {
    console.error("Update schedule error:", e);
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}