/**
 * Phase 7 — Feature Flags API
 * GET /api/dashboard/feature-flags - List all flags
 * POST /api/dashboard/feature-flags - Create new flag
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { listFeatureFlags, createFeatureFlag } from "@/lib/feature-flags/feature-flags";
import { requireAdminAccess } from "@/lib/auth-utils";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  // Admin only for feature flag management
  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const flags = await listFeatureFlags();
    return NextResponse.json({ flags });
  } catch (error) {
    console.error("List feature flags error:", error);
    return NextResponse.json({ error: "Failed to list flags" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: {
    key: string;
    name: string;
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

  const { key, name, description, enabled, rolloutPercentage, targeting, variants } = body;

  if (!key || !name) {
    return NextResponse.json({ error: "key and name required" }, { status: 400 });
  }

  try {
    const flag = await createFeatureFlag({
      key,
      name,
      description,
      enabled,
      rolloutPercentage,
      targeting,
      variants,
      createdBy: session.user.id,
    });
    return NextResponse.json({ flag }, { status: 201 });
  } catch (error) {
    console.error("Create feature flag error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create flag" }, { status: 500 });
  }
}