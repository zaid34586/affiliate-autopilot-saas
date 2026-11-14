/**
 * Phase 6 — Analyze A/B Test
 * POST /api/dashboard/optimizer/ab-tests/[id]/analyze
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { analyzeAndUpdateAbTest } from "@/lib/optimizer/ab-test";

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
    const analysis = await analyzeAndUpdateAbTest(workspaceId, id);
    if (!analysis) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Analyze A/B test error:", error);
    return NextResponse.json({ error: "Failed to analyze A/B test" }, { status: 500 });
  }
}