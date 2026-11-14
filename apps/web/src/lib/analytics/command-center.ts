/**
 * Phase 6 — Command Center DB Orchestration.
 *
 * Database operations for proactive recommendations:
 * - Gather full workspace context
 * - Generate recommendations using core logic
 * - Cache recommendations
 * - Integration with Copilot
 */

import { db } from "@/lib/db";
import {
  characters,
  brandProfiles,
  products,
  posts,
  videos,
  analyticsDaily,
  autopilotConfig,
  thinkingJournal,
  optimizerDecisions,
  abTests,
} from "@aa/db";
import { eq, desc, gte, sql, sum, and, inArray } from "drizzle-orm";
import {
  CommandCenterContext,
  CommandCenterResult,
  generateRecommendations,
} from "./command-center-core";
import { getWhatWorksRecommendations } from "./performance-memory";

/**
 * Gather complete workspace context for command center
 */
export async function gatherCommandCenterContext(workspaceId: string): Promise<CommandCenterContext | null> {
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
    .where(and(eq(analyticsDaily.workspaceId, workspaceId), gte(analyticsDaily.day, sinceStr)))
    .limit(1);

  const [postCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), gte(posts.publishedAt, since)))
    .limit(1);

  const topProducts = await db
    .select({
      id: products.id,
      title: products.title,
      aiScore: products.aiScore,
      commissionValue: products.commissionValue,
      commissionType: products.commissionType,
    })
    .from(products)
    .where(and(eq(products.workspaceId, workspaceId), eq(products.status, "active")))
    .orderBy(desc(products.aiScore))
    .limit(5);

  const [journal] = await db
    .select({ thoughtText: thinkingJournal.thoughtText })
    .from(thinkingJournal)
    .where(eq(thinkingJournal.characterId, character.id))
    .orderBy(desc(thinkingJournal.date))
    .limit(1);

  const recentPosts = await db
    .select({
      id: posts.id,
      platform: posts.platform,
      title: videos.title,
      status: posts.status,
    })
    .from(posts)
    .leftJoin(videos, eq(videos.id, posts.videoId))
    .where(eq(posts.workspaceId, workspaceId))
    .orderBy(desc(posts.createdAt))
    .limit(10);

  const [pendingOptimizer] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(optimizerDecisions)
    .where(and(eq(optimizerDecisions.workspaceId, workspaceId), eq(optimizerDecisions.executed, false)))
    .limit(1);

  const [activeAB] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(abTests)
    .where(and(eq(abTests.workspaceId, workspaceId), eq(abTests.status, "running")))
    .limit(1);

  // Get performance memory insights if available
  let performanceMemory: CommandCenterContext["performanceMemory"] = undefined;
  try {
    if (brand?.niche) {
      const memory = await getWhatWorksRecommendations(workspaceId, brand.niche);
      performanceMemory = {
        bestHooks: memory.hooks,
        bestCtAs: memory.ctas,
        bestPlatforms: memory.platforms,
        bestFormats: memory.formats,
        avgMetrics: memory.avgMetrics,
      };
    }
  } catch {
    // Performance memory not available yet
  }

  return {
    workspaceId,
    characterName: character.name,
    characterId: character.id,
    niche: brand?.niche ?? undefined,
    tone: brand?.tone ?? undefined,
    autopilotLevel: cfg?.level ?? "manual",
    autopilotPaused: cfg?.paused ?? false,
    last7Days: {
      impressions: Number(agg?.impressions ?? 0),
      clicks: Number(agg?.clicks ?? 0),
      conversions: Number(agg?.conversions ?? 0),
      revenue: Number(agg?.revenue ?? 0),
    },
    postsLast7: postCount?.n ?? 0,
    topProducts,
    lastJournal: journal?.thoughtText ?? null,
    recentPosts: recentPosts.map(p => ({
      id: p.id,
      platform: p.platform,
      title: p.title ?? "Untitled",
      status: p.status,
    })),
    pendingOptimizerDecisions: pendingOptimizer?.count ?? 0,
    activeABTests: activeAB?.count ?? 0,
    performanceMemory,
  };
}

/**
 * Generate command center recommendations for a workspace
 */
export async function generateCommandCenterRecommendations(workspaceId: string): Promise<CommandCenterResult> {
  const context = await gatherCommandCenterContext(workspaceId);
  if (!context) {
    return {
      recommendations: [],
      summary: { totalOpportunities: 0, criticalCount: 0, highCount: 0, estimatedRevenueImpact: 0, topPriority: null },
      generatedAt: new Date(),
    };
  }

  return generateRecommendations(context);
}

/**
 * Get cached or generate fresh recommendations
 */
export async function getCommandCenterRecommendations(workspaceId: string, forceRefresh = false): Promise<CommandCenterResult> {
  // For now, always generate fresh - could add caching later
  return generateCommandCenterRecommendations(workspaceId);
}