/**
 * Phase 7 — Templates Library DB Orchestration.
 *
 * Builtin seeding (idempotent), list/filter, detail, custom create/delete,
 * usage tracking.
 */

import { db } from "@/lib/db";
import { contentTemplates } from "@aa/db";
import { eq, and, desc, sql, isNull, or } from "drizzle-orm";
import {
  BUILTIN_TEMPLATES,
  extractVariables,
  validateTemplate,
  filterTemplates,
  recommendTemplates,
  TemplateRecord,
  TemplateInput,
} from "./templates-core";

function toRecord(row: typeof contentTemplates.$inferSelect): TemplateRecord {
  return {
    id: row.id,
    key: row.key,
    workspaceId: row.workspaceId,
    niche: row.niche,
    format: row.format,
    title: row.title,
    description: row.description,
    body: row.body,
    variables: Array.isArray(row.variables) ? row.variables : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    builtin: row.builtin,
    usageCount: row.usageCount,
  };
}

// ───────────────────────── SEED ─────────────────────────

/** Count builtins; seed when zero (lazy init — no cron needed). */
export async function ensureBuiltinTemplates(): Promise<void> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(contentTemplates)
    .where(eq(contentTemplates.builtin, true))
    .limit(1);

  if (Number(row?.n || 0) === 0) {
    await seedBuiltinTemplates();
  }
}

/**
 * Idempotently insert builtin templates (skips existing keys).
 * Safe to run on every deploy / cron.
 */
export async function seedBuiltinTemplates(): Promise<{ inserted: number; total: number }> {
  let inserted = 0;

  for (const t of BUILTIN_TEMPLATES) {
    const result = await db
      .insert(contentTemplates)
      .values({
        key: t.key,
        workspaceId: null,
        niche: t.niche,
        format: t.format,
        title: t.title,
        description: t.description,
        body: t.body,
        variables: extractVariables(t.body),
        tags: t.tags || [],
        builtin: true,
      })
      .onConflictDoNothing({ target: contentTemplates.key })
      .returning({ id: contentTemplates.id });
    if (result.length > 0) inserted++;
  }

  return { inserted, total: BUILTIN_TEMPLATES.length };
}

// ───────────────────────── LIST / GET ─────────────────────────

export interface ListFilters {
  niche?: string;
  format?: string;
  q?: string;
  builtin?: boolean;
  limit?: number;
}

/** List templates (builtins + workspace customs), filtered. */
export async function listTemplates(workspaceId: string, filters: ListFilters = {}): Promise<TemplateRecord[]> {
  await ensureBuiltinTemplates();

  const rows = await db
    .select()
    .from(contentTemplates)
    .where(
      or(
        isNull(contentTemplates.workspaceId),
        eq(contentTemplates.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(contentTemplates.builtin), desc(contentTemplates.usageCount));

  const filtered = filterTemplates(rows.map(toRecord), { ...filters, workspaceId });

  const limit = Math.min(200, Math.max(1, filters.limit ?? 100));
  return filtered.slice(0, limit);
}

export async function getTemplate(workspaceId: string, id: string): Promise<TemplateRecord | null> {
  const [row] = await db
    .select()
    .from(contentTemplates)
    .where(eq(contentTemplates.id, id))
    .limit(1);
  if (!row) return null;

  // Scope check: builtin or own workspace
  if (!row.builtin && row.workspaceId !== workspaceId) return null;
  return toRecord(row);
}

/** Top templates for a niche (builtin only). */
export async function getRecommendations(niche: string, limit = 4): Promise<TemplateRecord[]> {
  const rows = await db
    .select()
    .from(contentTemplates)
    .where(and(eq(contentTemplates.builtin, true), eq(contentTemplates.niche, niche)))
    .orderBy(desc(contentTemplates.usageCount));

  return recommendTemplates(rows.map(toRecord), niche, limit);
}

// ───────────────────────── CREATE / DELETE ─────────────────────────

export async function createCustomTemplate(input: {
  workspaceId: string;
  createdBy: string;
  template: TemplateInput;
}): Promise<{ ok: true; template: TemplateRecord } | { ok: false; errors: string[] }> {
  const validation = validateTemplate(input.template);
  if (!validation.valid) return { ok: false, errors: validation.errors };

  const variables = extractVariables(input.template.body);
  const key = `ws:${input.workspaceId}:${Date.now().toString(36)}`;

  const [row] = await db
    .insert(contentTemplates)
    .values({
      key,
      workspaceId: input.workspaceId,
      niche: input.template.niche,
      format: input.template.format,
      title: input.template.title,
      description: input.template.description,
      body: input.template.body,
      variables,
      tags: input.template.tags || [],
      builtin: false,
      createdBy: input.createdBy,
    })
    .returning();

  return { ok: true, template: toRecord(row) };
}

export async function deleteCustomTemplate(
  workspaceId: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const [row] = await db
    .select()
    .from(contentTemplates)
    .where(eq(contentTemplates.id, id))
    .limit(1);

  if (!row) return { ok: false, error: "Template not found" };
  if (row.builtin) return { ok: false, error: "Built-in templates cannot be deleted" };
  if (row.workspaceId !== workspaceId) return { ok: false, error: "Template not found" };

  await db.delete(contentTemplates).where(eq(contentTemplates.id, id));
  return { ok: true };
}

// ───────────────────────── USAGE ─────────────────────────

/** Increment usage counter (fire-and-forget from UI "Use template"). */
export async function recordTemplateUse(id: string): Promise<boolean> {
  const result = await db
    .update(contentTemplates)
    .set({ usageCount: sql`${contentTemplates.usageCount} + 1`, updatedAt: new Date() })
    .where(eq(contentTemplates.id, id))
    .returning({ id: contentTemplates.id });
  return result.length > 0;
}
