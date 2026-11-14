/**
 * Phase 5 Module C — Character Discussion Engine (DB orchestration).
 * Gathers real workspace context and delegates reply building to the
 * pure core in discuss-core.ts (unit-tested separately).
 */

import { db } from "@/lib/db";
import {
  autopilotConfig,
  brandProfiles,
  characters,
  products,
  thinkingJournal,
  analyticsDaily,
  posts,
} from "@aa/db";
import { and, desc, eq, gte, sql, sum } from "drizzle-orm";
import {
  buildDiscussReply,
  type DiscussContext,
  type DiscussResult,
} from "./discuss-core";

export {
  classifyIntent,
  buildDiscussReply,
  type DiscussContext,
  type DiscussIntent,
  type DiscussResult,
} from "./discuss-core";

/** Load real context from the DB. Returns null if no character exists. */
export async function gatherDiscussContext(
  workspaceId: string,
): Promise<DiscussContext | null> {
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId))
    .limit(1);

  if (!character) return null;

  const [brand] = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.workspaceId, workspaceId))
    .limit(1);

  const [cfg] = await db
    .select()
    .from(autopilotConfig)
    .where(eq(autopilotConfig.workspaceId, workspaceId))
    .limit(1);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString().split("T")[0];

  const [agg] = await db
    .select({
      impressions: sum(analyticsDaily.impressions),
      clicks: sum(analyticsDaily.clicks),
      conversions: sum(analyticsDaily.conversions),
      revenue: sum(analyticsDaily.revenue),
    })
    .from(analyticsDaily)
    .where(
      and(
        eq(analyticsDaily.workspaceId, workspaceId),
        gte(analyticsDaily.day, sinceStr),
      ),
    )
    .limit(1);

  const [postCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), gte(posts.publishedAt, since)))
    .limit(1);

  const topProducts = await db
    .select({
      title: products.title,
      aiScore: products.aiScore,
      commissionValue: products.commissionValue,
      commissionType: products.commissionType,
    })
    .from(products)
    .where(
      and(
        eq(products.workspaceId, workspaceId),
        eq(products.status, "active"),
      ),
    )
    .orderBy(desc(products.aiScore))
    .limit(3);

  const [journal] = await db
    .select({ thoughtText: thinkingJournal.thoughtText })
    .from(thinkingJournal)
    .where(eq(thinkingJournal.characterId, character.id))
    .orderBy(desc(thinkingJournal.date))
    .limit(1);

  return {
    characterName: character.name,
    niche: brand?.niche ?? null,
    tone: brand?.tone ?? null,
    autopilotLevel: cfg?.level ?? "manual",
    paused: cfg?.paused ?? false,
    last7: {
      impressions: Number(agg?.impressions ?? 0),
      clicks: Number(agg?.clicks ?? 0),
      conversions: Number(agg?.conversions ?? 0),
      revenue: Number(agg?.revenue ?? 0),
    },
    postsLast7: postCount?.n ?? 0,
    topProducts,
    lastJournal: journal?.thoughtText ?? null,
  };
}

/** Full path: gather context + build reply. */
export async function discussWithCharacter(
  workspaceId: string,
  message: string,
): Promise<DiscussResult | { error: string }> {
  const ctx = await gatherDiscussContext(workspaceId);
  if (!ctx) return { error: "No character yet — finish onboarding first." };
  return buildDiscussReply(ctx, message);
}
