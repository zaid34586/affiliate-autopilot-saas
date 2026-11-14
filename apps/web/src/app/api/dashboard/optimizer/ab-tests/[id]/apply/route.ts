/**
 * Phase 6 — Apply Winning Variant
 * POST /api/dashboard/optimizer/ab-tests/[id]/apply
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { applyWinningVariant } from "@/lib/optimizer/ab-test";

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
    const result = await applyWinningVariant(workspaceId, id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Apply A/B test winner error:", error);
    return NextResponse.json({ error: "Failed to apply winner" }, { status: 500 });
  }
}