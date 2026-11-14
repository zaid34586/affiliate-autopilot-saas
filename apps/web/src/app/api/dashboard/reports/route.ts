import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { generateAIReport } from "@/lib/analytics/reports";
import { aiReports } from "@aa/db";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * GET /api/dashboard/reports
 * Returns list of AI reports for the workspace.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const reports = await db
      .select()
      .from(aiReports)
      .where(eq(aiReports.workspaceId, workspaceId))
      .orderBy(desc(aiReports.createdAt))
      .limit(50);

    return NextResponse.json({ reports });
  } catch (e) {
    console.error("Fetch reports error:", e);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}

/**
 * POST /api/dashboard/reports
 * Generates an AI report (daily/weekly/monthly).
 * Body: { type: "daily" | "weekly" | "monthly", model?: string }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: { type: "daily" | "weekly" | "monthly"; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, model } = body;
  if (!type || !["daily", "weekly", "monthly"].includes(type)) {
    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  }

  try {
    const report = await generateAIReport(workspaceId, type, model);
    return NextResponse.json({ report });
  } catch (e) {
    console.error("Generate report error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate report" },
      { status: 500 }
    );
  }
}