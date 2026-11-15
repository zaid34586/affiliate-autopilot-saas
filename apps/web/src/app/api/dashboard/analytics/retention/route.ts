/**
 * Phase 7 — Retention Cohorts API
 * GET /api/dashboard/analytics/retention?weeks=12
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth-utils";
import { getRetentionCohorts } from "@/lib/analytics/product-analytics";

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
  const weeks = Math.min(52, Math.max(2, parseInt(searchParams.get("weeks") || "12")));

  try {
    const cohorts = await getRetentionCohorts(weeks);
    return NextResponse.json({ cohorts, weeks });
  } catch (error) {
    console.error("Get retention cohorts error:", error);
    return NextResponse.json({ error: "Failed to compute cohorts" }, { status: 500 });
  }
}
