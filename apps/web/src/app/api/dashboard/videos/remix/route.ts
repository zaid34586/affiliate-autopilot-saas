/**
 * Phase 6 — Video Remix History API
 * GET /api/dashboard/videos/remix - List remix jobs
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getRemixHistory } from "@/lib/video/video-remix";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const history = await getRemixHistory(workspaceId, limit);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Remix history error:", error);
    return NextResponse.json({ error: "Failed to fetch remix history" }, { status: 500 });
  }
}