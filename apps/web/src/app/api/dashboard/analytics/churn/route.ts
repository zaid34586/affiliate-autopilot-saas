/**
 * Phase 7 — Churn Signals API
 * GET /api/dashboard/analytics/churn?minScore=30
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth-utils";
import { getChurnSignals } from "@/lib/analytics/product-analytics";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const minScore = Math.min(100, Math.max(0, parseInt(searchParams.get("minScore") || "0")));

  try {
    const signals = await getChurnSignals(undefined, minScore);
    return NextResponse.json({ signals, minScore });
  } catch (error) {
    console.error("Get churn signals error:", error);
    return NextResponse.json({ error: "Failed to get churn signals" }, { status: 500 });
  }
}
