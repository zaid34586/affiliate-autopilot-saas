/**
 * Phase 7 — Announcements DB Orchestration.
 */

import { db } from "@/lib/db";
import { announcements, announcementDismissals } from "@aa/db";
import { eq, and, desc, asc, sql, gte, lte, inArray, or, isNull } from "drizzle-orm";
import { Announcement } from "./help-center-core";

export interface CreateAnnouncementInput {
  workspaceId?: string;
  title: string;
  bodyMd: string;
  type?: "info" | "warning" | "success" | "maintenance" | "feature";
  priority?: number;
  targetRoles?: string[];
  targetWorkspaces?: string[];
  startAt?: Date;
  endAt?: Date | null;
  isDismissible?: boolean;
  ctaText?: string;
  ctaUrl?: string;
  isPublished?: boolean;
  createdBy?: string;
}

export interface UpdateAnnouncementInput {
  title?: string;
  bodyMd?: string;
  type?: "info" | "warning" | "success" | "maintenance" | "feature";
  priority?: number;
  targetRoles?: string[];
  targetWorkspaces?: string[];
  startAt?: Date;
  endAt?: Date | null;
  isDismissible?: boolean;
  ctaText?: string;
  ctaUrl?: string;
  isPublished?: boolean;
}

/**
 * Create a new announcement
 */
export async function createAnnouncement(input: CreateAnnouncementInput) {
  const { renderMarkdown } = await import("./help-center-core");
  
  const bodyHtml = input.bodyMd ? renderMarkdown(input.bodyMd) : null;

  const [announcement] = await db
    .insert(announcements)
    .values({
      workspaceId: input.workspaceId || null,
      title: input.title,
      bodyMd: input.bodyMd,
      bodyHtml,
      type: input.type || "info",
      priority: input.priority || 0,
      targetRoles: input.targetRoles || [],
      targetWorkspaces: input.targetWorkspaces || [],
      startAt: input.startAt || new Date(),
      endAt: input.endAt || null,
      isDismissible: input.isDismissible !== false,
      ctaText: input.ctaText,
      ctaUrl: input.ctaUrl,
      isPublished: input.isPublished || false,
      createdBy: input.createdBy,
    })
    .returning();

  return mapAnnouncement(announcement);
}

/**
 * Update an announcement
 */
export async function updateAnnouncement(id: string, input: UpdateAnnouncementInput) {
  const { renderMarkdown } = await import("./help-center-core");
  
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  
  if (input.title !== undefined) updateData.title = input.title;
  if (input.bodyMd !== undefined) {
    updateData.bodyMd = input.bodyMd;
    updateData.bodyHtml = renderMarkdown(input.bodyMd);
  }
  if (input.type !== undefined) updateData.type = input.type;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.targetRoles !== undefined) updateData.targetRoles = input.targetRoles;
  if (input.targetWorkspaces !== undefined) updateData.targetWorkspaces = input.targetWorkspaces;
  if (input.startAt !== undefined) updateData.startAt = input.startAt;
  if (input.endAt !== undefined) updateData.endAt = input.endAt;
  if (input.isDismissible !== undefined) updateData.isDismissible = input.isDismissible;
  if (input.ctaText !== undefined) updateData.ctaText = input.ctaText;
  if (input.ctaUrl !== undefined) updateData.ctaUrl = input.ctaUrl;
  if (input.isPublished !== undefined) updateData.isPublished = input.isPublished;

  const [announcement] = await db
    .update(announcements)
    .set(updateData)
    .where(eq(announcements.id, id))
    .returning();

  return announcement ? mapAnnouncement(announcement) : null;
}

/**
 * Get announcement by ID
 */
export async function getAnnouncement(id: string) {
  const [announcement] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id))
    .limit(1);

  return announcement ? mapAnnouncement(announcement) : null;
}

/**
 * List announcements
 */
export async function listAnnouncements(options: {
  workspaceId?: string;
  isPublished?: boolean;
  limit?: number;
  offset?: number;
} = {}) {
  const { workspaceId, isPublished, limit = 50, offset = 0 } = options;

  const conditions = [];
  if (workspaceId !== undefined) {
    conditions.push(workspaceId ? eq(announcements.workspaceId, workspaceId) : sql`${announcements.workspaceId} IS NULL`);
  }
  if (isPublished !== undefined) conditions.push(eq(announcements.isPublished, isPublished));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const announcementList = await db
    .select()
    .from(announcements)
    .where(whereClause)
    .orderBy(desc(announcements.priority), desc(announcements.startAt))
    .limit(limit)
    .offset(offset);

  return announcementList.map(mapAnnouncement);
}

/**
 * Get active announcements for a user
 */
export async function getActiveAnnouncementsForUser(
  workspaceId: string,
  userId: string,
  userRole: string,
  limit = 10
) {
  const now = new Date();

  // Get user dismissals
  const userDismissals = await db
    .select({ announcementId: announcementDismissals.announcementId })
    .from(announcementDismissals)
    .where(and(
      eq(announcementDismissals.workspaceId, workspaceId),
      eq(announcementDismissals.userId, userId)
    ));

  const dismissedIds = new Set(userDismissals.map(d => d.announcementId));

  // Get active announcements
  const activeAnnouncements = await db
    .select()
    .from(announcements)
    .where(and(
      eq(announcements.isPublished, true),
      sql`${announcements.startAt} <= NOW()`,
      or(
        isNull(announcements.endAt),
        sql`${announcements.endAt} > NOW()`
      ),
      or(
        eq(announcements.workspaceId, workspaceId),
        sql`${announcements.workspaceId} IS NULL`
      )
    ))
    .orderBy(desc(announcements.priority), desc(announcements.startAt))
    .limit(limit * 2); // Get extra to filter out dismissed

  return activeAnnouncements
    .map(mapAnnouncement)
    .filter(a => !dismissedIds.has(a.id))
    .slice(0, limit);
}

/**
 * Dismiss an announcement for a user
 */
export async function dismissAnnouncement(
  announcementId: string,
  workspaceId: string,
  userId: string
) {
  await db
    .insert(announcementDismissals)
    .values({
      announcementId,
      workspaceId,
      userId,
    })
    .onConflictDoNothing();

  return { success: true };
}

/**
 * Map database row to Announcement type
 */
function mapAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    bodyMd: row.bodyMd,
    bodyHtml: row.bodyHtml,
    type: row.type,
    priority: row.priority,
    targetRoles: row.targetRoles || [],
    targetWorkspaces: row.targetWorkspaces || [],
    startAt: row.startAt,
    endAt: row.endAt,
    isDismissible: row.isDismissible,
    ctaText: row.ctaText,
    ctaUrl: row.ctaUrl,
    isPublished: row.isPublished,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}