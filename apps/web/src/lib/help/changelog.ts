/**
 * Phase 7 — Changelog DB Orchestration.
 */

import { db } from "@/lib/db";
import { changelogEntries } from "@aa/db";
import { eq, and, desc, asc, sql, gte, lte } from "drizzle-orm";
import { ChangelogEntry } from "./help-center-core";

export interface CreateChangelogInput {
  version: string;
  title: string;
  description?: string;
  releaseDate?: Date;
  categories?: string[];
  items?: Array<{
    type: "feature" | "fix" | "improvement" | "breaking" | "security";
    title: string;
    description: string;
  }>;
  isPublished?: boolean;
  authorId?: string;
}

export interface UpdateChangelogInput {
  title?: string;
  description?: string;
  releaseDate?: Date;
  categories?: string[];
  items?: Array<{
    type: "feature" | "fix" | "improvement" | "breaking" | "security";
    title: string;
    description: string;
  }>;
  isPublished?: boolean;
}

/**
 * Create a new changelog entry
 */
export async function createChangelogEntry(input: CreateChangelogInput) {
  const [entry] = await db
    .insert(changelogEntries)
    .values({
      version: input.version,
      title: input.title,
      description: input.description,
      releaseDate: input.releaseDate || new Date(),
      categories: input.categories || [],
      items: input.items || [],
      isPublished: input.isPublished || false,
      authorId: input.authorId,
    })
    .returning();

  return mapChangelogEntry(entry);
}

/**
 * Update a changelog entry
 */
export async function updateChangelogEntry(id: string, input: UpdateChangelogInput) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  
  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.releaseDate !== undefined) updateData.releaseDate = input.releaseDate;
  if (input.categories !== undefined) updateData.categories = input.categories;
  if (input.items !== undefined) updateData.items = input.items;
  if (input.isPublished !== undefined) updateData.isPublished = input.isPublished;

  const [entry] = await db
    .update(changelogEntries)
    .set(updateData)
    .where(eq(changelogEntries.id, id))
    .returning();

  return entry ? mapChangelogEntry(entry) : null;
}

/**
 * Get changelog entry by ID
 */
export async function getChangelogEntry(id: string) {
  const [entry] = await db
    .select()
    .from(changelogEntries)
    .where(eq(changelogEntries.id, id))
    .limit(1);

  return entry ? mapChangelogEntry(entry) : null;
}

/**
 * List changelog entries
 */
export async function listChangelogEntries(options: {
  isPublished?: boolean;
  limit?: number;
  offset?: number;
  fromDate?: Date;
  toDate?: Date;
} = {}) {
  const { isPublished, limit = 50, offset = 0, fromDate, toDate } = options;

  const conditions = [];
  if (isPublished !== undefined) conditions.push(eq(changelogEntries.isPublished, isPublished));
  if (fromDate) conditions.push(gte(changelogEntries.releaseDate, fromDate));
  if (toDate) conditions.push(lte(changelogEntries.releaseDate, toDate));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const entries = await db
    .select()
    .from(changelogEntries)
    .where(whereClause)
    .orderBy(desc(changelogEntries.releaseDate))
    .limit(limit)
    .offset(offset);

  return entries.map(mapChangelogEntry);
}

/**
 * Get published changelog entries for public display
 */
export async function getPublishedChangelog(limit = 20) {
  const entries = await db
    .select()
    .from(changelogEntries)
    .where(eq(changelogEntries.isPublished, true))
    .orderBy(desc(changelogEntries.releaseDate))
    .limit(limit);

  return entries.map(mapChangelogEntry);
}

/**
 * Map database row to ChangelogEntry type
 */
function mapChangelogEntry(row: any): ChangelogEntry {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    description: row.description,
    releaseDate: row.releaseDate,
    categories: row.categories || [],
    items: row.items || [],
    isPublished: row.isPublished,
    authorId: row.authorId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}