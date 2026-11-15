/**
 * Phase 7 — Admin Product Metrics API
 * GET /api/dashboard/analytics/admin?days=90&cacSpendUsd=1000&churnRate=0.05
 *
 * MRR/ARR, LTV/CAC, AI cost per user, funnel — admin dashboard.
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth-utils";
import { getAdminMetrics, getMrrHistory, takeMrrSnapshot } from "@/lib/analytics/product-analytics";

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
  const cacSpendUsd = Math.max(0, parseFloat(searchParams.get("cacSpendUsd") || "0"));
  const churnRate = Math.min(1, Math.max(0.001, parseFloat(searchParams.get("churnRate") || "0.05")));
  const snapshot = searchParams.get("snapshot") === "true";

  try {
    // Optional: take today's snapshot on demand (also done by cron)
    if (snapshot) {
      await takeMrrSnapshot(new Date());
    }

    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const metrics = await getAdminMetrics({
      from,
      to: new Date(),
      cacSpendCents: Math.round(cacSpendUsd * 100),
      monthlyChurnRate: churnRate,
    });

    const history = await getMrrHistory(days);

    return NextResponse.json({ metrics, history, days });
  } catch (error) {
    console.error("Get admin metrics error:", error);
    return NextResponse.json({ error: "Failed to compute metrics" }, { status: 500 });
  }
}
