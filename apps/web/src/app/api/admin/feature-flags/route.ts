/**
 * Phase 8 — Admin API: Feature Flags Control
 * GET /api/admin/feature-flags - List all flags with workspace overrides
 * PATCH /api/admin/feature-flags/[key] - Update flag (rollout %, enabled, workspace overrides)
 * POST /api/admin/feature-flags - Create new flag
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { featureFlags, workspaces } from "@aa/db";
import { eq, and, desc, asc, sql, count, or, ilike } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const enabled = searchParams.get("enabled"); // true|false|all
  const search = searchParams.get("search")?.trim();

  const offset = (page - 1) * limit;

  const whereConditions = [];
  if (enabled === "true") whereConditions.push(eq(featureFlags.enabled, true));
  if (enabled === "false") whereConditions.push(eq(featureFlags.enabled, false));
  if (search) {
    whereConditions.push(
      or(
        ilike(featureFlags.key, `%${search}%`),
        ilike(featureFlags.name, `%${search}%`),
        ilike(featureFlags.description, `%${search}%`),
      ),
    );
  }

  const [flags, totalResult] = await Promise.all([
    db
      .select({
        id: featureFlags.id,
        key: featureFlags.key,
        name: featureFlags.name,
        description: featureFlags.description,
        enabled: featureFlags.enabled,
        rolloutPercentage: featureFlags.rolloutPercentage,
        workspaceOverrides: featureFlags.workspaceOverrides,
        createdBy: featureFlags.createdBy,
        createdAt: featureFlags.createdAt,
        updatedAt: featureFlags.updatedAt,
      })
      .from(featureFlags)
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .orderBy(desc(featureFlags.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(featureFlags)
      .where(whereConditions.length ? and(...whereConditions) : undefined),
  ]);

  return NextResponse.json({
    flags,
    pagination: {
      page,
      limit,
      total: totalResult[0]?.count || 0,
      totalPages: Math.ceil((totalResult[0]?.count || 0) / limit),
    },
  });
}

export async function POST(req: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  let body: {
    key: string;
    name: string;
    description?: string;
    enabled?: boolean;
    rolloutPercentage?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.key || !/^[a-z][a-z0-9_]*$/.test(body.key)) {
    return NextResponse.json({ error: "Invalid key (lowercase, underscore, start with letter)" }, { status: 400 });
  }
  if (!body.name || body.name.length < 3 || body.name.length > 100) {
    return NextResponse.json({ error: "Name must be 3-100 chars" }, { status: 400 });
  }

  // Check duplicate
  const [existing] = await db
    .select({ id: featureFlags.id })
    .from(featureFlags)
    .where(eq(featureFlags.key, body.key))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "Flag key already exists" }, { status: 409 });
  }

  const [flag] = await db
    .insert(featureFlags)
    .values({
      key: body.key,
      name: body.name,
      description: body.description || "",
      enabled: body.enabled ?? false,
      rolloutPercentage: body.rolloutPercentage ?? 0,
      workspaceOverrides: {},
    })
    .returning();

  return NextResponse.json({ flag }, { status: 201 });
}