/**
 * Phase 7 — Feature Usage API
 * GET  /api/dashboard/analytics/feature-usage - usage summary (admin) or workspace usage
 * POST /api/dashboard/analytics/feature-usage - record a feature usage event
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth-utils";
import {
  getFeatureUsageSummary,
  getWorkspaceFeatureUsage,
  recordFeatureUsage,
} from "@/lib/analytics/product-analytics";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "workspace";
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30")));

  try {
    if (scope === "admin") {
      const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
      if (!hasAdminAccess) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const summary = await getFeatureUsageSummary(from, new Date());
      return NextResponse.json({ summary, days });
    }

    const usage = await getWorkspaceFeatureUsage(workspaceId, days);
    return NextResponse.json({ usage, days });
  } catch (error) {
    console.error("Get feature usage error:", error);
    return NextResponse.json({ error: "Failed to get feature usage" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: { feature: string; properties?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { feature, properties } = body;
  if (!feature || typeof feature !== "string" || feature.length > 100) {
    return NextResponse.json({ error: "feature (string, max 100 chars) required" }, { status: 400 });
  }

  try {
    await recordFeatureUsage(workspaceId, session.user.id, feature, properties);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Record feature usage error:", error);
    return NextResponse.json({ error: "Failed to record usage" }, { status: 500 });
  }
}
