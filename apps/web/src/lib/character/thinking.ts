/**
 * Phase 5 Module C — Thinking Engine (DB orchestration).
 * Gathers real workspace context and delegates to the pure core in
 * thinking-core.ts. Writes one journal entry per character per day
 * (unique index tj_char_date_uq — upsert semantics).
 */

import { db } from "@/lib/db";
import {
  analyticsDaily,
  autopilotConfig,
  brandProfiles,
  characters,
  posts,
  products,
  thinkingJournal,
} from "@aa/db";
import { and, desc, eq, gte, sql, sum } from "drizzle-orm";
import { buildDailyThought, type DailyThought } from "./thinking-core";

export { buildDailyThought } from "./thinking-core";
export type { DailyThought } from "./thinking-core";
export type { ThinkingContext } from "./thinking-core";

function dayStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  return dayStr(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

/** Aggregate analytics for a single day (UTC). */
async function dayAggregate(workspaceId: string, day: string) {
  const [row] = await db
    .select({
      impressions: sum(analyticsDaily.impressions),
      clicks: sum(analyticsDaily.clicks),
      conversions: sum(analyticsDaily.conversions),
      revenue: sum(analyticsDaily.revenue),
    })
    .from(analyticsDaily)
    .where(and(eq(analyticsDaily.workspaceId, workspaceId), eq(analyticsDaily.day, day)))
    .limit(1);

  return {
    impressions: Number(row?.impressions ?? 0),
    clicks: Number(row?.clicks ?? 0),
    conversions: Number(row?.conversions ?? 0),
    revenue: Number(row?.revenue ?? 0),
  };
}

/**
 * Run today's reflection: gather context, build the thought, upsert it
 * into thinking_journal. Idempotent per day — running twice updates the
 * same row instead of duplicating.
 */
export async function runDailyReflection(
  workspaceId: string,
  onDate: Date = new Date(),
): Promise<DailyThought & { id: string; date: string; created: boolean }> {
  const date = dayStr(onDate);

  const [character] = await db
    .select({ id: characters.id, name: characters.name })
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId))
    .limit(1);
  if (!character) throw new Error("No character yet — finish onboarding first");

  const [brand] = await db
    .select({ niche: brandProfiles.niche })
    .from(brandProfiles)
    .where(eq(brandProfiles.workspaceId, workspaceId))
    .limit(1);

  const [cfg] = await db
    .select({ level: autopilotConfig.level, paused: autopilotConfig.paused })
    .from(autopilotConfig)
    .where(eq(autopilotConfig.workspaceId, workspaceId))
    .limit(1);

  const yesterday = await dayAggregate(workspaceId, daysAgo(1));
  const weekStart = daysAgo(7);

  const [weekAgg] = await db
    .select({
      impressions: sum(analyticsDaily.impressions),
      clicks: sum(analyticsDaily.clicks),
      conversions: sum(analyticsDaily.conversions),
      revenue: sum(analyticsDaily.revenue),
    })
    .from(analyticsDaily)
    .where(
      and(eq(analyticsDaily.workspaceId, workspaceId), gte(analyticsDaily.day, weekStart)),
    )
    .limit(1);

  const [postCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(posts)
    .where(
      and(
        eq(posts.workspaceId, workspaceId),
        gte(posts.publishedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      ),
    )
    .limit(1);

  const [top] = await db
    .select({ title: products.title, aiScore: products.aiScore })
    .from(products)
    .where(and(eq(products.workspaceId, workspaceId), eq(products.status, "active")))
    .orderBy(desc(products.aiScore))
    .limit(1);

  const [prev] = await db
    .select({ thoughtText: thinkingJournal.thoughtText })
    .from(thinkingJournal)
    .where(
      and(
        eq(thinkingJournal.characterId, character.id),
        sql`${thinkingJournal.date} < ${date}`,
      ),
    )
    .orderBy(desc(thinkingJournal.date))
    .limit(1);

  const thought = buildDailyThought({
    characterName: character.name,
    niche: brand?.niche ?? null,
    yesterday,
    last7: {
      impressions: Number(weekAgg?.impressions ?? 0),
      clicks: Number(weekAgg?.clicks ?? 0),
      conversions: Number(weekAgg?.conversions ?? 0),
      revenue: Number(weekAgg?.revenue ?? 0),
      posts: postCount?.n ?? 0,
    },
    autopilotLevel: cfg?.level ?? "manual",
    paused: cfg?.paused ?? false,
    topProduct: top ? { title: top.title, aiScore: top.aiScore } : null,
    previousThought: prev?.thoughtText ?? null,
  });

  // Upsert: one entry per character per day.
  const [existing] = await db
    .select({ id: thinkingJournal.id })
    .from(thinkingJournal)
    .where(
      and(
        eq(thinkingJournal.characterId, character.id),
        eq(thinkingJournal.date, date),
      ),
    )
    .limit(1);

  const reasoningRecord = {
    engine: thought.engine,
    bullets: thought.reasoning,
    dataWindow: { yesterday, since: weekStart },
  };

  if (existing) {
    await db
      .update(thinkingJournal)
      .set({
        thoughtText: thought.thoughtText,
        reasoning: reasoningRecord as unknown as Record<string, unknown>,
        decision: thought.decision,
        confidence: thought.confidence,
      })
      .where(eq(thinkingJournal.id, existing.id));
    return { ...thought, id: existing.id, date, created: false };
  }

  const [row] = await db
    .insert(thinkingJournal)
    .values({
      characterId: character.id,
      date,
      thoughtText: thought.thoughtText,
      reasoning: reasoningRecord as unknown as Record<string, unknown>,
      decision: thought.decision,
      confidence: thought.confidence,
    })
    .returning({ id: thinkingJournal.id });

  return { ...thought, id: row!.id, date, created: true };
}

export interface JournalEntry {
  id: string;
  date: string;
  thoughtText: string;
  decision: string | null;
  confidence: number | null;
  reasoning: string[];
  createdAt: Date;
}

/** Recent journal entries, newest first (max 30). */
export async function listThoughts(workspaceId: string): Promise<JournalEntry[]> {
  const [character] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId))
    .limit(1);
  if (!character) return [];

  const rows = await db
    .select()
    .from(thinkingJournal)
    .where(eq(thinkingJournal.characterId, character.id))
    .orderBy(desc(thinkingJournal.date))
    .limit(30);

  return rows.map((r) => {
    const reasoning = (r.reasoning ?? {}) as { bullets?: unknown };
    return {
      id: r.id,
      date: r.date,
      thoughtText: r.thoughtText,
      decision: r.decision,
      confidence: r.confidence,
      reasoning: Array.isArray(reasoning.bullets)
        ? (reasoning.bullets as string[])
        : [],
      createdAt: r.createdAt,
    };
  });
}
