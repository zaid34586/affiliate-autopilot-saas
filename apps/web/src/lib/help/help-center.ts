/**
 * Phase 7 — Help Center DB Orchestration.
 * 
 * Database operations for:
 * - Help Articles (CRUD, search, feedback, view tracking)
 * - Changelog (CRUD, publishing)
 * - Announcements (CRUD, targeting, dismissals)
 * - Support Tickets (lifecycle, messages, SLA)
 */

import { db } from "@/lib/db";
import {
  helpArticles,
  helpArticleFeedback,
  changelogEntries,
  announcements,
  announcementDismissals,
  supportTickets,
  ticketMessages,
} from "@aa/db";
import { eq, and, desc, asc, sql, gte, lte, inArray, ilike, or, isNull } from "drizzle-orm";
import {
  HelpArticle,
  HelpArticleFeedback,
  ChangelogEntry,
  Announcement,
  SupportTicket,
  TicketMessage,
  getRelatedArticles,
  generateSlug,
  renderMarkdown,
} from "./help-center-core";

export { getRelatedArticles, generateSlug, renderMarkdown };

/**
 * ==================== HELP ARTICLES ====================
 */

export interface CreateArticleInput {
  workspaceId?: string;
  slug: string;
  title: string;
  description?: string;
  contentMd: string;
  category: string;
  tags?: string[];
  isPublished?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  authorId?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface UpdateArticleInput {
  title?: string;
  description?: string;
  contentMd?: string;
  category?: string;
  tags?: string[];
  isPublished?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
}

/**
 * Create a new help article
 */
export async function createHelpArticle(input: CreateArticleInput) {
  const { generateSlug, renderMarkdown } = await import("./help-center-core");
  
  const slug = input.slug || generateSlug(input.title);
  const contentHtml = input.contentMd ? renderMarkdown(input.contentMd) : null;
  const publishedAt = input.isPublished ? new Date() : null;

  const [article] = await db
    .insert(helpArticles)
    .values({
      workspaceId: input.workspaceId || null,
      slug,
      title: input.title,
      description: input.description,
      contentMd: input.contentMd,
      contentHtml,
      category: input.category,
      tags: input.tags || [],
      isPublished: input.isPublished || false,
      isFeatured: input.isFeatured || false,
      sortOrder: input.sortOrder || 0,
      authorId: input.authorId,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      publishedAt,
    })
    .returning();

  return mapArticle(article);
}

/**
 * Update a help article
 */
export async function updateHelpArticle(
  id: string,
  workspaceId: string | null,
  input: UpdateArticleInput
) {
  const { renderMarkdown } = await import("./help-center-core");
  
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  
  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.contentMd !== undefined) {
    updateData.contentMd = input.contentMd;
    updateData.contentHtml = renderMarkdown(input.contentMd);
  }
  if (input.category !== undefined) updateData.category = input.category;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.isPublished !== undefined) {
    updateData.isPublished = input.isPublished;
    if (input.isPublished) updateData.publishedAt = new Date();
  }
  if (input.isFeatured !== undefined) updateData.isFeatured = input.isFeatured;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
  if (input.seoTitle !== undefined) updateData.seoTitle = input.seoTitle;
  if (input.seoDescription !== undefined) updateData.seoDescription = input.seoDescription;

  const where = workspaceId
    ? and(eq(helpArticles.id, id), eq(helpArticles.workspaceId, workspaceId))
    : and(eq(helpArticles.id, id), isNull(helpArticles.workspaceId));

  const [article] = await db
    .update(helpArticles)
    .set(updateData)
    .where(where)
    .returning();

  return article ? mapArticle(article) : null;
}

/**
 * Get article by ID
 */
export async function getHelpArticle(id: string, workspaceId?: string) {
  const where = workspaceId
    ? and(eq(helpArticles.id, id), eq(helpArticles.workspaceId, workspaceId))
    : and(eq(helpArticles.id, id), isNull(helpArticles.workspaceId));

  const [article] = await db
    .select()
    .from(helpArticles)
    .where(where)
    .limit(1);

  return article ? mapArticle(article) : null;
}

/**
 * Get article by slug
 */
export async function getHelpArticleBySlug(slug: string, workspaceId?: string) {
  const where = workspaceId
    ? and(eq(helpArticles.slug, slug), eq(helpArticles.workspaceId, workspaceId))
    : and(eq(helpArticles.slug, slug), isNull(helpArticles.workspaceId));

  const [article] = await db
    .select()
    .from(helpArticles)
    .where(where)
    .limit(1);

  return article ? mapArticle(article) : null;
}

/**
 * List help articles with filters
 */
export async function listHelpArticles(options: {
  workspaceId?: string;
  category?: string;
  isPublished?: boolean;
  isFeatured?: boolean;
  authorId?: string;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "viewCount" | "sortOrder";
  sortOrder?: "asc" | "desc";
} = {}) {
  const {
    workspaceId,
    category,
    isPublished,
    isFeatured,
    authorId,
    limit = 50,
    offset = 0,
    sortBy = "sortOrder",
    sortOrder = "asc",
  } = options;

  const conditions = [];
  if (workspaceId !== undefined) {
    conditions.push(workspaceId ? eq(helpArticles.workspaceId, workspaceId) : isNull(helpArticles.workspaceId));
  }
  if (category) conditions.push(eq(helpArticles.category, category));
  if (isPublished !== undefined) conditions.push(eq(helpArticles.isPublished, isPublished));
  if (isFeatured !== undefined) conditions.push(eq(helpArticles.isFeatured, isFeatured));
  if (authorId) conditions.push(eq(helpArticles.authorId, authorId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orderColumn = sortBy === "createdAt" ? helpArticles.createdAt :
    sortBy === "updatedAt" ? helpArticles.updatedAt :
    sortBy === "viewCount" ? helpArticles.viewCount :
    helpArticles.sortOrder;

  const orderFn = sortOrder === "desc" ? desc : asc;

  const articles = await db
    .select()
    .from(helpArticles)
    .where(whereClause)
    .orderBy(orderFn(orderColumn))
    .limit(limit)
    .offset(offset);

  return articles.map(mapArticle);
}

/**
 * Search help articles
 */
export async function searchHelpArticles(
  query: string,
  options: {
    workspaceId?: string;
    category?: string;
    isPublished?: boolean;
    limit?: number;
  } = {}
) {
  const { workspaceId, category, isPublished = true, limit = 20 } = options;

  const conditions = [
    isPublished ? eq(helpArticles.isPublished, true) : undefined,
    category ? eq(helpArticles.category, category) : undefined,
    or(
      ilike(helpArticles.title, `%${query}%`),
      ilike(helpArticles.description, `%${query}%`),
      ilike(helpArticles.contentMd, `%${query}%`),
    ),
  ].filter(Boolean) as any[];

  if (workspaceId !== undefined) {
    conditions.push(workspaceId ? eq(helpArticles.workspaceId, workspaceId) : isNull(helpArticles.workspaceId));
  }

  const articles = await db
    .select()
    .from(helpArticles)
    .where(and(...conditions))
    .orderBy(desc(helpArticles.viewCount))
    .limit(limit);

  return articles.map(mapArticle);
}

/**
 * Increment view count
 */
export async function incrementArticleViewCount(id: string) {
  await db
    .update(helpArticles)
    .set({ viewCount: sql`${helpArticles.viewCount} + 1` })
    .where(eq(helpArticles.id, id));
}

/**
 * Submit article feedback
 */
export async function submitArticleFeedback(
  articleId: string,
  workspaceId: string,
  userId: string | null,
  isHelpful: boolean,
  comment?: string
) {
  const [feedback] = await db
    .insert(helpArticleFeedback)
    .values({
      articleId,
      workspaceId,
      userId,
      isHelpful,
      comment,
    })
    .returning();

  // Update helpful counts
  if (isHelpful) {
    await db
      .update(helpArticles)
      .set({ helpfulCount: sql`${helpArticles.helpfulCount} + 1` })
      .where(eq(helpArticles.id, articleId));
  } else {
    await db
      .update(helpArticles)
      .set({ notHelpfulCount: sql`${helpArticles.notHelpfulCount} + 1` })
      .where(eq(helpArticles.id, articleId));
  }

  return feedback;
}

/**
 * Get article feedback stats
 */
export async function getArticleFeedbackStats(articleId: string) {
  const [stats] = await db
    .select({
      helpful: sql<number>`count(*) filter (where ${helpArticleFeedback.isHelpful} = true)::int`,
      notHelpful: sql<number>`count(*) filter (where ${helpArticleFeedback.isHelpful} = false)::int`,
    })
    .from(helpArticleFeedback)
    .where(eq(helpArticleFeedback.articleId, articleId))
    .limit(1);

  return {
    helpful: Number(stats?.helpful || 0),
    notHelpful: Number(stats?.notHelpful || 0),
    total: Number(stats?.helpful || 0) + Number(stats?.notHelpful || 0),
  };
}

/**
 * Map database row to HelpArticle type
 */
function mapArticle(row: any): HelpArticle {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    slug: row.slug,
    title: row.title,
    description: row.description,
    contentMd: row.contentMd,
    contentHtml: row.contentHtml,
    category: row.category,
    tags: row.tags || [],
    isPublished: row.isPublished,
    isFeatured: row.isFeatured,
    sortOrder: row.sortOrder,
    viewCount: row.viewCount,
    helpfulCount: row.helpfulCount,
    notHelpfulCount: row.notHelpfulCount,
    authorId: row.authorId,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  };
}