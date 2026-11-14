/**
 * Phase 6 — Pause A/B Test
 * POST /api/dashboard/optimizer/ab-tests/[id]/pause
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { abTests } from "@aa/db";
import { eq, and } from "drizzle-orm";

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
    const [test] = await db
      .update(abTests)
      .set({
        status: "paused",
        updatedAt: new Date(),
      })
      .where(and(eq(abTests.id, id), eq(abTests.workspaceId, workspaceId)))
      .returning();

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }
    return NextResponse.json({ test });
  } catch (error) {
    console.error("Pause A/B test error:", error);
    return NextResponse.json({ error: "Failed to pause A/B test" }, { status: 500 });
  }
}