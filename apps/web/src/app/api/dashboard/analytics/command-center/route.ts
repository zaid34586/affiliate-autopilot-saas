/**
 * Phase 6 — Command Center API
 * GET /api/dashboard/analytics/command-center - Get proactive recommendations
 * POST /api/dashboard/analytics/command-center - Force refresh recommendations
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getCommandCenterRecommendations } from "@/lib/analytics/command-center";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get("refresh") === "true";

  try {
    const result = await getCommandCenterRecommendations(workspaceId, forceRefresh);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Command center error:", error);
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const result = await getCommandCenterRecommendations(workspaceId, true);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Command center refresh error:", error);
    return NextResponse.json({ error: "Failed to refresh recommendations" }, { status: 500 });
  }
}