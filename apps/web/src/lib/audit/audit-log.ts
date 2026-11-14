/**
 * Phase 7 — Audit Log DB Orchestration.
 * 
 * Database operations for audit logging.
 */

import { db } from "@/lib/db";
import { auditLogs } from "@aa/db";
import { eq, and, desc, gte, lte, sql, inArray } from "drizzle-orm";
import {
  AuditLogEntry,
  AuditLogQuery,
  AuditLogResult,
  AuditAction,
  isValidAuditAction,
  buildAuditMetadata,
  sanitizeAuditValues,
  AUDIT_ACTIONS,
} from "./audit-log-core";

export type { AuditLogQuery } from "./audit-log-core";

/**
 * Write an audit log entry
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  if (!isValidAuditAction(entry.action)) {
    console.warn(`Invalid audit action: ${entry.action}`);
    // Still log it but mark as custom
  }

  await db.insert(auditLogs).values({
    workspaceId: entry.workspaceId,
    userId: entry.userId,
    actorType: entry.actorType,
    actorId: entry.actorId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    oldValues: entry.oldValues ? sanitizeAuditValues(entry.oldValues) : null,
    newValues: entry.newValues ? sanitizeAuditValues(entry.newValues) : null,
    metadata: entry.metadata || {},
  });
}

/**
 * Write multiple audit log entries (batch)
 */
export async function writeAuditLogs(entries: AuditLogEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const values = entries.map(e => ({
    workspaceId: e.workspaceId,
    userId: e.userId,
    actorType: e.actorType,
    actorId: e.actorId,
    action: e.action,
    resourceType: e.resourceType,
    resourceId: e.resourceId,
    oldValues: e.oldValues ? sanitizeAuditValues(e.oldValues) : null,
    newValues: e.newValues ? sanitizeAuditValues(e.newValues) : null,
    metadata: e.metadata || {},
  }));

  await db.insert(auditLogs).values(values);
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(query: AuditLogQuery): Promise<AuditLogResult[]> {
  const conditions = [eq(auditLogs.workspaceId, query.workspaceId)];

  if (query.userId) conditions.push(eq(auditLogs.userId, query.userId));
  if (query.actorType) conditions.push(eq(auditLogs.actorType, query.actorType));
  if (query.action) conditions.push(eq(auditLogs.action, query.action));
  if (query.resourceType) conditions.push(eq(auditLogs.resourceType, query.resourceType));
  if (query.resourceId) conditions.push(eq(auditLogs.resourceId, query.resourceId));
  if (query.fromDate) conditions.push(gte(auditLogs.createdAt, query.fromDate));
  if (query.toDate) conditions.push(lte(auditLogs.createdAt, query.toDate));

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const limit = query.limit || 100;
  const offset = query.offset || 0;

  const results = await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return results.map(r => ({
    id: r.id,
    workspaceId: r.workspaceId,
    userId: r.userId,
    actorType: r.actorType,
    actorId: r.actorId,
    action: r.action,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    oldValues: r.oldValues as Record<string, unknown> | null,
    newValues: r.newValues as Record<string, unknown> | null,
    metadata: r.metadata as Record<string, unknown>,
    createdAt: r.createdAt,
  }));
}

/**
 * Get audit log count for pagination
 */
export async function getAuditLogCount(query: AuditLogQuery): Promise<number> {
  const conditions = [eq(auditLogs.workspaceId, query.workspaceId)];

  if (query.userId) conditions.push(eq(auditLogs.userId, query.userId));
  if (query.actorType) conditions.push(eq(auditLogs.actorType, query.actorType));
  if (query.action) conditions.push(eq(auditLogs.action, query.action));
  if (query.resourceType) conditions.push(eq(auditLogs.resourceType, query.resourceType));
  if (query.resourceId) conditions.push(eq(auditLogs.resourceId, query.resourceId));
  if (query.fromDate) conditions.push(gte(auditLogs.createdAt, query.fromDate));
  if (query.toDate) conditions.push(lte(auditLogs.createdAt, query.toDate));

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(whereClause)
    .limit(1);

  return result?.count || 0;
}

/**
 * Get audit log summary for a workspace
 */
export async function getAuditLogSummary(workspaceId: string, days = 7): Promise<{
  totalActions: number;
  byActorType: Record<string, number>;
  byAction: Record<string, number>;
  uniqueUsers: number;
  aiActions: number;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(eq(auditLogs.workspaceId, workspaceId), gte(auditLogs.createdAt, since)))
    .limit(1);

  const actorTypeResults = await db
    .select({
      actorType: auditLogs.actorType,
      count: sql<number>`count(*)::int`,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.workspaceId, workspaceId), gte(auditLogs.createdAt, since)))
    .groupBy(auditLogs.actorType);

  const actionResults = await db
    .select({
      action: auditLogs.action,
      count: sql<number>`count(*)::int`,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.workspaceId, workspaceId), gte(auditLogs.createdAt, since)))
    .groupBy(auditLogs.action)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  const [userResult] = await db
    .select({ count: sql<number>`count(DISTINCT ${auditLogs.userId})::int` })
    .from(auditLogs)
    .where(and(eq(auditLogs.workspaceId, workspaceId), gte(auditLogs.createdAt, since)))
    .limit(1);

  const [aiResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(
      eq(auditLogs.workspaceId, workspaceId),
      gte(auditLogs.createdAt, since),
      eq(auditLogs.actorType, "ai")
    ))
    .limit(1);

  return {
    totalActions: totalResult?.count || 0,
    byActorType: Object.fromEntries(actorTypeResults.map(r => [r.actorType, Number(r.count)])),
    byAction: Object.fromEntries(actionResults.map(r => [r.action, Number(r.count)])),
    uniqueUsers: userResult?.count || 0,
    aiActions: aiResult?.count || 0,
  };
}

/**
 * Convenience function to log common actions
 */
export const auditLog = {
  async userLogin(workspaceId: string, userId: string, request?: Request) {
    await writeAuditLog({
      workspaceId,
      userId,
      actorType: "user",
      actorId: userId,
      action: "auth.login",
      metadata: buildAuditMetadata(request),
    });
  },

  async userAction(
    workspaceId: string,
    userId: string,
    action: AuditAction,
    resourceType?: string,
    resourceId?: string,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>,
    request?: Request,
  ) {
    await writeAuditLog({
      workspaceId,
      userId,
      actorType: "user",
      actorId: userId,
      action,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      metadata: buildAuditMetadata(request),
    });
  },

  async aiAction(
    workspaceId: string,
    action: AuditAction,
    resourceType?: string,
    resourceId?: string,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ) {
    await writeAuditLog({
      workspaceId,
      actorType: "ai",
      actorId: "copilot", // or specific AI agent name
      action,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      metadata: { ...metadata, source: "ai" },
    });
  },

  async systemAction(
    workspaceId: string,
    action: AuditAction,
    resourceType?: string,
    resourceId?: string,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ) {
    await writeAuditLog({
      workspaceId,
      actorType: "system",
      actorId: "system",
      action,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      metadata: { ...metadata, source: "system" },
    });
  },
};

/**
 * Helper to create old/new values for update actions
 */
export function createUpdateValues(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fields?: string[],
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const keys = fields || new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const key of keys) {
    if (oldObj[key] !== newObj[key]) {
      oldValues[key] = oldObj[key];
      newValues[key] = newObj[key];
    }
  }

  return { oldValues, newValues };
}