/**
 * Phase 7 — Support Tickets DB Orchestration.
 */

import { db } from "@/lib/db";
import { supportTickets, ticketMessages, users } from "@aa/db";
import { eq, and, desc, asc, sql, gte, lte, inArray, count } from "drizzle-orm";
import {
  SupportTicket,
  TicketMessage,
  validateTicket,
  getTicketSLA,
} from "./help-center-core";

export interface CreateTicketInput {
  workspaceId: string;
  userId: string;
  subject: string;
  descriptionMd: string;
  category: "technical" | "billing" | "feature_request" | "bug_report" | "general";
  priority?: "low" | "medium" | "high" | "urgent";
  tags?: string[];
}

export interface UpdateTicketInput {
  subject?: string;
  descriptionMd?: string;
  category?: "technical" | "billing" | "feature_request" | "bug_report" | "general";
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  assignedTo?: string | null;
  tags?: string[];
  satisfactionRating?: number;
  satisfactionFeedback?: string;
}

export interface CreateMessageInput {
  ticketId: string;
  userId: string;
  isStaff: boolean;
  bodyMd: string;
  isInternal?: boolean;
}

/**
 * Create a new support ticket
 */
export async function createSupportTicket(input: CreateTicketInput) {
  const validation = validateTicket(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(", "));
  }

  const sla = getTicketSLA(input.priority || "medium");

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      subject: input.subject,
      descriptionMd: input.descriptionMd,
      category: input.category,
      priority: input.priority || "medium",
      status: "open",
      tags: input.tags || [],
    })
    .returning();

  // Log the creation
  console.log(`[Support] Ticket created: ${ticket.id} for workspace ${input.workspaceId}`);

  return mapTicket(ticket);
}

/**
 * Update a support ticket
 */
export async function updateSupportTicket(id: string, workspaceId: string, input: UpdateTicketInput) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  let statusChanged = false;
  let oldStatus: string | null = null;

  if (input.subject !== undefined) updateData.subject = input.subject;
  if (input.descriptionMd !== undefined) updateData.descriptionMd = input.descriptionMd;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.status !== undefined) {
    updateData.status = input.status;
    statusChanged = true;
  }
  if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.satisfactionRating !== undefined) updateData.satisfactionRating = input.satisfactionRating;
  if (input.satisfactionFeedback !== undefined) updateData.satisfactionFeedback = input.satisfactionFeedback;

  // Track status transitions
  if (statusChanged && input.status) {
    const now = new Date();
    switch (input.status) {
      case "in_progress":
        if (!oldStatus || oldStatus === "open") {
          updateData.firstResponseAt = new Date();
        }
        break;
      case "resolved":
        updateData.resolvedAt = new Date();
        break;
      case "closed":
        updateData.closedAt = new Date();
        break;
    }
  }

  const [ticket] = await db
    .update(supportTickets)
    .set(updateData)
    .where(and(eq(supportTickets.id, id), eq(supportTickets.workspaceId, workspaceId)))
    .returning();

  return ticket ? mapTicket(ticket) : null;
}

/**
 * Get ticket by ID
 */
export async function getSupportTicket(id: string, workspaceId: string) {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, id), eq(supportTickets.workspaceId, workspaceId)))
    .limit(1);

  return ticket ? mapTicket(ticket) : null;
}

/**
 * List support tickets
 */
export async function listSupportTickets(options: {
  workspaceId: string;
  userId?: string;
  status?: string;
  category?: string;
  priority?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "priority";
  sortOrder?: "asc" | "desc";
}) {
  const {
    workspaceId,
    userId,
    status,
    category,
    priority,
    assignedTo,
    limit = 50,
    offset = 0,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const conditions = [eq(supportTickets.workspaceId, workspaceId)];
  if (userId) conditions.push(eq(supportTickets.userId, userId));
  if (status) conditions.push(eq(supportTickets.status, status));
  if (category) conditions.push(eq(supportTickets.category, category));
  if (priority) conditions.push(eq(supportTickets.priority, priority));
  if (assignedTo) conditions.push(eq(supportTickets.assignedTo, assignedTo));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orderColumn = sortBy === "priority" ? supportTickets.priority :
    sortBy === "updatedAt" ? supportTickets.updatedAt :
    supportTickets.createdAt;

  const orderFn = sortOrder === "desc" ? desc : asc;

  const tickets = await db
    .select()
    .from(supportTickets)
    .where(whereClause)
    .orderBy(sortFn(orderColumn, sortOrder))
    .limit(limit)
    .offset(offset);

  return tickets.map(mapTicket);
}

/**
 * Get ticket with messages
 */
export async function getTicketWithMessages(ticketId: string, workspaceId: string) {
  const ticket = await getSupportTicket(ticketId, workspaceId);
  if (!ticket) return null;

  const messages = await db
    .select({
      id: ticketMessages.id,
      ticketId: ticketMessages.ticketId,
      userId: ticketMessages.userId,
      isStaff: ticketMessages.isStaff,
      bodyMd: ticketMessages.bodyMd,
      bodyHtml: ticketMessages.bodyHtml,
      isInternal: ticketMessages.isInternal,
      createdAt: ticketMessages.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(ticketMessages)
    .leftJoin(users, eq(users.id, ticketMessages.userId))
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(asc(ticketMessages.createdAt));

  return {
    ...ticket,
    messages: messages.map(mapMessage),
  };
}

/**
 * Add message to ticket
 */
export async function addTicketMessage(input: CreateMessageInput, workspaceId: string) {
  // Verify ticket exists and belongs to workspace
  const ticket = await getSupportTicket(input.ticketId, workspaceId);
  if (!ticket) throw new Error("Ticket not found");

  const { renderMarkdown } = await import("./help-center-core");
  const bodyHtml = input.bodyMd ? renderMarkdown(input.bodyMd) : null;

  const [message] = await db
    .insert(ticketMessages)
    .values({
      ticketId: input.ticketId,
      userId: input.isStaff ? input.userId : null, // Staff messages don't have userId
      isStaff: input.isStaff,
      bodyMd: input.bodyMd,
      bodyHtml,
      isInternal: input.isInternal || false,
    })
    .returning();

  // Update ticket timestamp
  await db
    .update(supportTickets)
    .set({ updatedAt: new Date() })
    .where(eq(supportTickets.id, input.ticketId));

  // If first staff response, update firstResponseAt
  if (input.isStaff) {
    await db
      .update(supportTickets)
      .set({ firstResponseAt: new Date() })
      .where(and(
        eq(supportTickets.id, input.ticketId),
        eq(supportTickets.workspaceId, workspaceId),
        sql`${supportTickets.firstResponseAt} IS NULL`
      ));
  }

  return mapMessage(message);
}

/**
 * Get ticket messages
 */
export async function getTicketMessages(ticketId: string) {
  const messages = await db
    .select({
      id: ticketMessages.id,
      ticketId: ticketMessages.ticketId,
      userId: ticketMessages.userId,
      isStaff: ticketMessages.isStaff,
      bodyMd: ticketMessages.bodyMd,
      bodyHtml: ticketMessages.bodyHtml,
      isInternal: ticketMessages.isInternal,
      createdAt: ticketMessages.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(ticketMessages)
    .leftJoin(users, eq(users.id, ticketMessages.userId))
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(asc(ticketMessages.createdAt));

  return messages.map(mapMessage);
}

/**
 * Get ticket stats for workspace
 */
export async function getTicketStats(workspaceId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totalResult] = await db
    .select({ count: count() })
    .from(supportTickets)
    .where(and(eq(supportTickets.workspaceId, workspaceId), gte(supportTickets.createdAt, since)))
    .limit(1);

  const statusResults = await db
    .select({
      status: supportTickets.status,
      count: count(),
    })
    .from(supportTickets)
    .where(and(eq(supportTickets.workspaceId, workspaceId), gte(supportTickets.createdAt, since)))
    .groupBy(supportTickets.status);

  const priorityResults = await db
    .select({
      priority: supportTickets.priority,
      count: count(),
    })
    .from(supportTickets)
    .where(and(eq(supportTickets.workspaceId, workspaceId), gte(supportTickets.createdAt, since)))
    .groupBy(supportTickets.priority);

  const categoryResults = await db
    .select({
      category: supportTickets.category,
      count: count(),
    })
    .from(supportTickets)
    .where(and(eq(supportTickets.workspaceId, workspaceId), gte(supportTickets.createdAt, since)))
    .groupBy(supportTickets.category);

  // SLA metrics
  const [slaResult] = await db
    .select({
      avgFirstResponseHours: sql<number>`AVG(EXTRACT(EPOCH FROM (${supportTickets.firstResponseAt} - ${supportTickets.createdAt})) / 3600)::numeric(10,2)`,
      avgResolutionHours: sql<number>`AVG(EXTRACT(EPOCH FROM (${supportTickets.resolvedAt} - ${supportTickets.createdAt})) / 3600)::numeric(10,2)`,
      withinSLAFirstResponse: sql<number>`COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (${supportTickets.firstResponseAt} - ${supportTickets.createdAt})) / 3600 <= 
        CASE ${supportTickets.priority}
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 4
          WHEN 'medium' THEN 24
          ELSE 48
        END)::int`,
      withinSLAResolution: sql<number>`COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (${supportTickets.resolvedAt} - ${supportTickets.createdAt})) / 3600 <= 
        CASE ${supportTickets.priority}
          WHEN 'urgent' THEN 4
          WHEN 'high' THEN 24
          WHEN 'medium' THEN 72
          ELSE 168
        END)::int`,
    })
    .from(supportTickets)
    .where(and(
      eq(supportTickets.workspaceId, workspaceId),
      gte(supportTickets.createdAt, since),
      eq(supportTickets.status, "closed")
    ))
    .limit(1);

  return {
    total: Number(totalResult?.count || 0),
    byStatus: Object.fromEntries(statusResults.map(r => [r.status, Number(r.count)])),
    byPriority: Object.fromEntries(priorityResults.map(r => [r.priority, Number(r.count)])),
    sla: {
      avgFirstResponseHours: Number(slaResult?.avgFirstResponseHours || 0),
      avgResolutionHours: Number(slaResult?.avgResolutionHours || 0),
      firstResponseSLACompliance: slaResult?.withinSLAFirstResponse 
        ? Number(slaResult.withinSLAFirstResponse) / Number(totalResult?.count || 1) * 100
        : 0,
      resolutionSLACompliance: slaResult?.withinSLAResolution
        ? Number(slaResult.withinSLAResolution) / Number(totalResult?.count || 1) * 100
        : 0,
    },
  };
}

/**
 * Map database row to SupportTicket type
 */
function mapTicket(row: any): SupportTicket {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    subject: row.subject,
    descriptionMd: row.descriptionMd,
    category: row.category,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assignedTo,
    tags: row.tags || [],
    firstResponseAt: row.firstResponseAt,
    resolvedAt: row.resolvedAt,
    closedAt: row.closedAt,
    satisfactionRating: row.satisfactionRating,
    satisfactionFeedback: row.satisfactionFeedback,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Map database row to TicketMessage type
 */
function mapMessage(row: any): TicketMessage {
  return {
    id: row.id,
    ticketId: row.ticketId,
    userId: row.userId,
    isStaff: row.isStaff,
    bodyMd: row.bodyMd,
    bodyHtml: row.bodyHtml,
    isInternal: row.isInternal,
    createdAt: row.createdAt,
  };
}

/**
 * Helper for sorting
 */
function sortFn(column: any, order: string) {
  return order === "desc" ? desc(column) : asc(column);
}