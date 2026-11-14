/**
 * GET /api/dashboard/trend-miner — get trend data + suggestions.
 * POST /api/dashboard/trend-miner — run trend analysis.
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { runTrendAnalysis, loadRemixSuggestions, loadAllRemixSuggestions } from "@/lib/trend/trend";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [suggestions, allSuggestions] = await Promise.all([
      loadRemixSuggestions(session.user.workspaceId),
      loadAllRemixSuggestions(session.user.workspaceId),
    ]);

    return NextResponse.json({ suggestions, all: allSuggestions });
  } catch (e) {
    console.error("Trend miner GET error:", e);
    return NextResponse.json({ error: "Failed to load trend data" }, { status: 500 });
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTrendAnalysis(session.user.workspaceId);
    return NextResponse.json({ result }, { status: 201 });
  } catch (e) {
    console.error("Trend analysis error:", e);
    return NextResponse.json({ error: "Failed to run trend analysis" }, { status: 500 });
  }
}