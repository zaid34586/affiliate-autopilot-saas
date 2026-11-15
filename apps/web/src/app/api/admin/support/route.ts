/**
 * Phase 8 — Admin API: Support Inbox
 * GET /api/admin/support - All tickets across workspaces with filters
 * GET /api/admin/support/[id] - Ticket detail with messages
 * PATCH /api/admin/support/[id] - Admin update (assign, status, internal notes)
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { supportTickets, ticketMessages, workspaces, users } from "@aa/db";
import { eq, and, desc, asc, ilike, or, sql, count, gte } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const status = searchParams.get("status"); // open|in_progress|waiting_customer|resolved|closed|all
  const category = searchParams.get("category");
  const priority = searchParams.get("priority");
  const workspaceId = searchParams.get("workspaceId");
  const search = searchParams.get("search")?.trim();
  const sort = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") || "desc";

  const offset = (page - 1) * limit;

  const whereConditions = [];
  if (status && status !== "all") whereConditions.push(eq(supportTickets.status, status));
  if (category) whereConditions.push(eq(supportTickets.category, category));
  if (priority) whereConditions.push(eq(supportTickets.priority, priority));
  if (workspaceId) whereConditions.push(eq(supportTickets.workspaceId, workspaceId));
  if (search) {
    whereConditions.push(
      or(
        ilike(supportTickets.subject, `%${search}%`),
        ilike(supportTickets.descriptionMd, `%${search}%`),
        eq(supportTickets.id, search),
      ),
    );
  }

  const orderColumn = supportTickets[sort as keyof typeof supportTickets] || supportTickets.createdAt;
  const orderFn = order === "asc" ? asc : desc;

  const [tickets, totalResult] = await Promise.all([
    db
      .select({
        id: supportTickets.id,
        workspaceId: supportTickets.workspaceId,
        userId: supportTickets.userId,
        subject: supportTickets.subject,
        descriptionMd: supportTickets.descriptionMd,
        category: supportTickets.category,
        priority: supportTickets.priority,
        status: supportTickets.status,
        tags: supportTickets.tags,
        assignedTo: supportTickets.assignedTo,
        satisfactionRating: supportTickets.satisfactionRating,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        resolvedAt: supportTickets.resolvedAt,
        workspaceName: workspaces.name,
        userEmail: users.email,
        userName: users.name,
        messageCount: sql<number>`(
          select count(*) from ${ticketMessages} where ${ticketMessages.ticketId} = ${supportTickets.id}
        )::int`,
        lastMessageAt: sql<string>`(
          select created_at from ${ticketMessages} where ${ticketMessages.ticketId} = ${supportTickets.id} order by created_at desc limit 1
        )`,
        lastMessageIsStaff: sql<boolean>`(
          select is_staff from ${ticketMessages} where ${ticketMessages.ticketId} = ${supportTickets.id} order by created_at desc limit 1
        )`,
      })
      .from(supportTickets)
      .leftJoin(workspaces, eq(supportTickets.workspaceId, workspaces.id))
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(supportTickets)
      .where(whereConditions.length ? and(...whereConditions) : undefined),
  ]);

  return NextResponse.json({
    tickets,
    pagination: {
      page,
      limit,
      total: totalResult[0]?.count || 0,
      totalPages: Math.ceil((totalResult[0]?.count || 0) / limit),
    },
  });
}