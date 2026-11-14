/**
 * GET /api/dashboard/optimizer — dashboard data (config, decisions, stats).
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { loadOptimizerDashboard } from "@/lib/optimizer/optimizer";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dashboard = await loadOptimizerDashboard(session.user.workspaceId);
    return NextResponse.json({ dashboard });
  } catch (e) {
    console.error("Load optimizer dashboard error:", e);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}