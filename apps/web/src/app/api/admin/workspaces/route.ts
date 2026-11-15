/**
 * Phase 8 — Admin API: Workspaces (Organizations)
 * GET /api/admin/workspaces - List workspaces with filters, pagination
 * GET /api/admin/workspaces/[id] - Workspace detail with members, usage
 * PATCH /api/admin/workspaces/[id] - Update workspace (suspend, plan override)
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers, users, subscriptions, analyticsDaily } from "@aa/db";
import { eq, and, desc, asc, ilike, or, sql, count, sum, gte } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const search = searchParams.get("search")?.trim();
  const plan = searchParams.get("plan"); // free|starter|pro|agency
  const sort = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") || "desc";

  const offset = (page - 1) * limit;

  const whereConditions = [];
  if (search) {
    whereConditions.push(
      or(
        ilike(workspaces.name, `%${search}%`),
        eq(workspaces.id, search),
      ),
    );
  }
  if (plan && ["free", "starter", "pro", "agency"].includes(plan)) {
    whereConditions.push(eq(workspaces.plan, plan as "free" | "starter" | "pro" | "agency"));
  }

  // Map sort parameter to actual column
  const orderColumnMap: Record<string, any> = {
    name: workspaces.name,
    plan: workspaces.plan,
    createdAt: workspaces.createdAt,
    creditsBalance: workspaces.creditsBalance,
  };
  const orderColumn = orderColumnMap[sort] || workspaces.createdAt;
  const orderFn = order === "asc" ? asc : desc;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [wsRows, totalResult] = await Promise.all([
    db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        ownerUserId: workspaces.ownerUserId,
        plan: workspaces.plan,
        creditsBalance: workspaces.creditsBalance,
        createdAt: workspaces.createdAt,
        memberCount: sql<number>`(
          select count(*) from ${workspaceMembers} where ${workspaceMembers.workspaceId} = ${workspaces.id}
        )::int`,
        subscriptionStatus: sql<string>`(
          select status from ${subscriptions} where ${subscriptions.workspaceId} = ${workspaces.id} order by created_at desc limit 1
        )`,
        subscriptionCurrentPeriodEnd: sql<string>`(
          select current_period_end from ${subscriptions} where ${subscriptions.workspaceId} = ${workspaces.id} order by created_at desc limit 1
        )`,
        recentActivity: sql<number>`(
          select count(*) from ${analyticsDaily} 
          where ${analyticsDaily.workspaceId} = ${workspaces.id} 
          and ${analyticsDaily.day} >= ${thirtyDaysAgo.toISOString().split("T")[0]}
        )::int`,
        ownerEmail: sql<string>`(
          select email from ${users} where ${users.id} = ${workspaces.ownerUserId}
        )`,
      })
      .from(workspaces)
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(workspaces)
      .where(whereConditions.length ? and(...whereConditions) : undefined),
  ]);

  return NextResponse.json({
    workspaces: wsRows,
    pagination: {
      page,
      limit,
      total: totalResult[0]?.count || 0,
      totalPages: Math.ceil((totalResult[0]?.count || 0) / limit),
    },
  });
}