/**
 * Phase 8 — Admin API: Audit Logs
 * GET /api/admin/audit - Audit trail of user + AI actions across workspaces
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { auditLogs, users, workspaces } from "@aa/db";
import { eq, and, desc, asc, ilike, or, sql, count, gte, lte } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100")));
  const action = searchParams.get("action"); // filter by action type
  const actorType = searchParams.get("actorType"); // user|ai|system
  const workspaceId = searchParams.get("workspaceId");
  const userId = searchParams.get("userId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const search = searchParams.get("search")?.trim();
  const sort = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") || "desc";

  const offset = (page - 1) * limit;

  const whereConditions = [];
  if (action) whereConditions.push(eq(auditLogs.action, action));
  if (actorType) whereConditions.push(eq(auditLogs.actorType, actorType));
  if (workspaceId) whereConditions.push(eq(auditLogs.workspaceId, workspaceId));
  if (userId) whereConditions.push(eq(auditLogs.userId, userId));
  if (startDate) whereConditions.push(gte(auditLogs.createdAt, new Date(startDate)));
  if (endDate) whereConditions.push(lte(auditLogs.createdAt, new Date(endDate)));
  if (search) {
    whereConditions.push(
      or(
        ilike(auditLogs.action, `%${search}%`),
        ilike(auditLogs.resourceType, `%${search}%`),
        ilike(auditLogs.metadata, `%${search}%`),
        eq(auditLogs.id, search),
      ),
    );
  }

  const orderColumnMap: Record<string, any> = {
    action: auditLogs.action,
    actorType: auditLogs.actorType,
    createdAt: auditLogs.createdAt,
    workspaceId: auditLogs.workspaceId,
    userId: auditLogs.userId,
  };
  const orderColumn = orderColumnMap[sort] || auditLogs.createdAt;
  const orderFn = order === "asc" ? asc : desc;

  const [logs, totalResult] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        workspaceId: auditLogs.workspaceId,
        userId: auditLogs.userId,
        actorType: auditLogs.actorType,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        metadata: auditLogs.metadata,
        actorId: auditLogs.actorId,
        createdAt: auditLogs.createdAt,
        workspaceName: workspaces.name,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(workspaces, eq(auditLogs.workspaceId, workspaces.id))
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(auditLogs)
      .where(whereConditions.length ? and(...whereConditions) : undefined),
  ]);

  // Action type summary for filters
  const actionSummary = await db
    .select({
      action: auditLogs.action,
      count: count(),
    })
    .from(auditLogs)
    .where(whereConditions.length ? and(...whereConditions) : undefined)
    .groupBy(auditLogs.action)
    .orderBy(desc(count()))
    .limit(50);

  return NextResponse.json({
    logs,
    actionSummary,
    pagination: {
      page,
      limit,
      total: totalResult[0]?.count || 0,
      totalPages: Math.ceil((totalResult[0]?.count || 0) / limit),
    },
  });
}