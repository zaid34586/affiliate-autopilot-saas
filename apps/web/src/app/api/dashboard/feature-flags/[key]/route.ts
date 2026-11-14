/**
 * Phase 7 — Feature Flag Detail API
 * GET /api/dashboard/feature-flags/[key] - Get flag details + analytics
 * PATCH /api/dashboard/feature-flags/[key] - Update flag
 * DELETE /api/dashboard/feature-flags/[key] - Delete flag
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  getFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  toggleFeatureFlag,
  getFlagAnalytics,
} from "@/lib/feature-flags/feature-flags";
import { requireAdminAccess, requireRole } from "@/lib/auth-utils";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { key } = await params;
  const { searchParams } = new URL(req.url);
  const analytics = searchParams.get("analytics") === "true";
  const days = parseInt(searchParams.get("days") || "7");

  try {
    const flag = await getFeatureFlag(key);
    if (!flag) {
      return NextResponse.json({ error: "Flag not found" }, { status: 404 });
    }

    let analyticsData = null;
    if (analytics) {
      analyticsData = await getFlagAnalytics(key, days);
    }

    return NextResponse.json({ flag, analytics: analyticsData });
  } catch (error) {
    console.error("Get feature flag error:", error);
    return NextResponse.json({ error: "Failed to get flag" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { key } = await params;

  let body: {
    name?: string;
    description?: string;
    enabled?: boolean;
    rolloutPercentage?: number;
    targeting?: { userIds?: string[]; workspaceIds?: string[]; roles?: string[] };
    variants?: Array<{ key: string; weight: number; payload?: Record<string, unknown> }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, description, enabled, rolloutPercentage, targeting, variants } = body;

  try {
    let flag;

    if (enabled !== undefined && Object.keys(body).length === 1) {
      // Simple toggle
      flag = await toggleFeatureFlag(key, enabled);
    } else {
      flag = await updateFeatureFlag(key, {
        name: body.name,
        description: body.description,
        enabled: body.enabled,
        rolloutPercentage: body.rolloutPercentage,
        targeting: body.targeting,
        variants: body.variants,
      });
    }

    if (!flag) {
      return NextResponse.json({ error: "Flag not found" }, { status: 404 });
    }

    return NextResponse.json({ flag });
  } catch (error) {
    console.error("Update feature flag error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update flag" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const hasOwnerAccess = await requireRole(workspaceId, session.user.id, ["owner"]);
  if (!hasOwnerAccess) {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const { key } = await params;

  try {
    const deleted = await deleteFeatureFlag(key);
    if (!deleted) {
      return NextResponse.json({ error: "Flag not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete feature flag error:", error);
    return NextResponse.json({ error: "Failed to delete flag" }, { status: 500 });
  }
}