import { auth } from "@/auth";
import { getAnalyticsDashboard, generateWeeklyReport } from "@/lib/analytics/sync";
import { NextResponse } from "next/server";

/**
 * GET /api/dashboard/analytics?days=30
 * Returns analytics dashboard data for the workspace.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const url = new URL(req.url);
  const days = Math.min(parseInt(url.searchParams.get("days") ?? "30"), 90);

  try {
    const analytics = await getAnalyticsDashboard(workspaceId, days);
    return NextResponse.json(analytics);
  } catch (e) {
    console.error("Fetch analytics error:", e);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}

/**
 * POST /api/dashboard/analytics?report=weekly
 * Generates weekly AI report.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "weekly";

  try {
    if (type === "weekly") {
      const report = await generateWeeklyReport(workspaceId);
      return NextResponse.json({ report });
    }
    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  } catch (e) {
    console.error("Generate report error:", e);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}