/**
 * GET /api/dashboard/optimizer/decisions — list decisions.
 * POST /api/dashboard/optimizer/decisions/[id]/execute — execute a decision.
 */
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { optimizerDecisions } from "@aa/db";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { executeDecision } from "@/lib/optimizer/optimizer";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decisions = await db
      .select()
      .from(optimizerDecisions)
      .where(eq(optimizerDecisions.workspaceId, session.user.workspaceId))
      .orderBy(desc(optimizerDecisions.createdAt))
      .limit(100);

    return NextResponse.json({ decisions });
  } catch (e) {
    console.error("Load decisions error:", e);
    return NextResponse.json({ error: "Failed to load decisions" }, { status: 500 });
  }
}