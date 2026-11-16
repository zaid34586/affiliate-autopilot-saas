/**
 * Phase 8 — Admin API: Subscriptions & Revenue
 * GET /api/admin/revenue - MRR, ARR, churn, trials, upgrades/downgrades
 * GET /api/admin/subscriptions - List subscriptions with filters
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { subscriptions, workspaces, users } from "@aa/db";
import { eq, and, desc, asc, sql, count, sum, gte, lte, or, ilike } from "drizzle-orm";

type PlanFilter = "free" | "starter" | "pro" | "agency";

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "overview"; // overview|subscriptions

  if (type === "subscriptions") {
    return getSubscriptionsList(req);
  }
  return getRevenueOverview();
}

async function getRevenueOverview() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    activeSubs,
    mrrResult,
    arrResult,
    trialResult,
    churnResult,
    revenueByPlan,
    recentCharges,
  ] = await Promise.all([
    // Active subscriptions
    db
      .select({ count: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active")),
    
    // MRR (sum of active subscription amounts)
    db
      .select({ mrr: sql<number>`coalesce(sum(amount_cents), 0)::int / 100.0` })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active")),
    
    // ARR
    db
      .select({ arr: sql<number>`coalesce(sum(amount_cents) * 12, 0)::int / 100.0` })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active")),
    
    // Trials (status = trialing)
    db
      .select({ count: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, "trialing")),
    
    // Churn last 30 days (cancelled subscriptions)
    db
      .select({ count: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, "canceled"),
          gte(subscriptions.canceledAt, startOfLastMonth),
          lte(subscriptions.canceledAt, endOfLastMonth),
        ),
      ),
    
    // Revenue by plan
    db
      .select({
        plan: subscriptions.plan,
        count: count(),
        mrr: sql<number>`coalesce(sum(amount_cents), 0)::int / 100.0`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"))
      .groupBy(subscriptions.plan),
    
    // Recent successful charges (last 10)
    db
      .select({
        id: subscriptions.id,
        workspaceId: subscriptions.workspaceId,
        amountCents: subscriptions.amountCents,
        plan: subscriptions.plan,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        workspaceName: workspaces.name,
        ownerEmail: users.email,
      })
      .from(subscriptions)
      .leftJoin(workspaces, eq(subscriptions.workspaceId, workspaces.id))
      .leftJoin(users, eq(workspaces.ownerUserId, users.id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(10),
  ]);

  const mrr = mrrResult[0]?.mrr || 0;
  const arr = arrResult[0]?.arr || 0;
  const activeCount = activeSubs[0]?.count || 0;
  const trialCount = trialResult[0]?.count || 0;
  const churnCount = churnResult[0]?.count || 0;
  const churnRate = activeCount > 0 ? (churnCount / activeCount) * 100 : 0;

  return NextResponse.json({
    overview: {
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      activeSubscriptions: activeCount,
      trials: trialCount,
      churnLast30Days: churnCount,
      churnRate: Math.round(churnRate * 100) / 100,
    },
    revenueByPlan: revenueByPlan.map((r) => ({
      plan: r.plan,
      count: r.count,
      mrr: Math.round((r.mrr || 0) * 100) / 100,
    })),
    recentSubscriptions: recentCharges,
  });
}

async function getSubscriptionsList(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const status = searchParams.get("status"); // active|trialing|past_due|canceled|all
  const plan = searchParams.get("plan");
  const search = searchParams.get("search")?.trim();

  const offset = (page - 1) * limit;

  const whereConditions = [];
  if (status && status !== "all") whereConditions.push(eq(subscriptions.status, status));
  if (plan) whereConditions.push(eq(subscriptions.plan, plan as PlanFilter));
  if (search) {
    whereConditions.push(
      or(
        ilike(workspaces.name, `%${search}%`),
        ilike(users.email, `%${search}%`),
        eq(subscriptions.id, search),
      ),
    );
  }

  const [subRows, totalResult] = await Promise.all([
    db
      .select({
        id: subscriptions.id,
        workspaceId: subscriptions.workspaceId,
        userId: workspaces.ownerUserId, // subscriptions link via workspace -> owner
        status: subscriptions.status,
        plan: subscriptions.plan,
        amountCents: subscriptions.amountCents,
        interval: subscriptions.interval,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        canceledAt: subscriptions.canceledAt,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        createdAt: subscriptions.createdAt,
        workspaceName: workspaces.name,
        ownerEmail: users.email,
      })
      .from(subscriptions)
      .leftJoin(workspaces, eq(subscriptions.workspaceId, workspaces.id))
      .leftJoin(users, eq(workspaces.ownerUserId, users.id))
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .orderBy(desc(subscriptions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(subscriptions)
      .leftJoin(workspaces, eq(subscriptions.workspaceId, workspaces.id))
      .leftJoin(users, eq(workspaces.ownerUserId, users.id))
      .where(whereConditions.length ? and(...whereConditions) : undefined),
  ]);

  return NextResponse.json({
    subscriptions: subRows,
    pagination: {
      page,
      limit,
      total: totalResult[0]?.count || 0,
      totalPages: Math.ceil((totalResult[0]?.count || 0) / limit),
    },
  });
}