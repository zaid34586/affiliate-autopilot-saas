/**
 * Phase 6 — Start A/B Test
 * POST /api/dashboard/optimizer/ab-tests/[id]/start
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { startAbTest } from "@/lib/optimizer/ab-test";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { id } = await params;

  try {
    const test = await startAbTest(workspaceId, id);
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }
    return NextResponse.json({ test });
  } catch (error) {
    console.error("Start A/B test error:", error);
    return NextResponse.json({ error: "Failed to start A/B test" }, { status: 500 });
  }
}