/**
 * Phase 7 — Signup Funnel API
 * GET /api/dashboard/analytics/funnel?days=90
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth-utils";
import { getSignupFunnel } from "@/lib/analytics/product-analytics";

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
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "90")));

  try {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const funnel = await getSignupFunnel({ from, to: new Date() });

    return NextResponse.json({ funnel, days });
  } catch (error) {
    console.error("Get funnel error:", error);
    return NextResponse.json({ error: "Failed to compute funnel" }, { status: 500 });
  }
}
