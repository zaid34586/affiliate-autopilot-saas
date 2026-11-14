/**
 * Phase 5 Module E — Trend Miner (DB orchestration).
 * Loads trend data from DB, delegates to pure core, writes suggestions.
 */

import { db } from "@/lib/db";
import {
  trendingHashtags,
  trendingAudio,
  viralPosts,
  trendRemixSuggestions,
  products,
  brandProfiles,
} from "@aa/db";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  generateRemixSuggestions,
  getTopHashtagsForNiche,
  getTopAudioForPlatform,
  type TrendAnalysisInput,
  type RemixSuggestion,
  type TrendingHashtag,
  type TrendingAudio,
  type ViralPost,
  type ProductContext,
} from "./trend-core";

export {
  generateRemixSuggestions,
  getTopHashtagsForNiche,
  getTopAudioForPlatform,
} from "./trend-core";
export type { RemixSuggestion, TrendingHashtag, TrendingAudio, ViralPost, ProductContext, TrendAnalysisInput } from "./trend-core";

/** Load workspace niche from brand profile. */
async function getWorkspaceNiche(workspaceId: string): Promise<string | null> {
  const [brand] = await db
    .select({ niche: brandProfiles.niche })
    .from(brandProfiles)
    .where(eq(brandProfiles.workspaceId, workspaceId))
    .limit(1);
  return brand?.niche ?? null;
}

/** Load active products for workspace. */
async function getProducts(workspaceId: string): Promise<ProductContext[]> {
  const rows = await db
    .select({
      id: products.id,
      title: products.title,
      niche: products.category,
      commissionType: products.commissionType,
      commissionValue: products.commissionValue,
    })
    .from(products)
    .where(and(eq(products.workspaceId, workspaceId), eq(products.status, "active")));

  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    niche: p.niche ?? null,
    commissionType: p.commissionType,
    commissionValue: p.commissionValue?.toString() ?? null,
  }));
}

/** Load trending hashtags (last 7 days). */
async function loadTrendingHashtags(workspaceId: string): Promise<TrendingHashtag[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(trendingHashtags)
    .where(and(eq(trendingHashtags.workspaceId, workspaceId), gte(trendingHashtags.fetchedAt, since)))
    .orderBy(desc(trendingHashtags.velocity))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    hashtag: r.hashtag,
    platform: r.platform,
    volume: r.volume,
    velocity: r.velocity ? Number(r.velocity) : null,
    niche: r.niche,
  }));
}

/** Load trending audio (last 7 days). */
async function loadTrendingAudio(workspaceId: string): Promise<TrendingAudio[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(trendingAudio)
    .where(and(eq(trendingAudio.workspaceId, workspaceId), gte(trendingAudio.fetchedAt, since)))
    .orderBy(desc(trendingAudio.velocity))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    audioId: r.audioId,
    platform: r.platform,
    title: r.title,
    artist: r.artist,
    usageCount: r.usageCount,
    velocity: r.velocity ? Number(r.velocity) : null,
  }));
}

/** Load viral posts (last 30 days). */
async function loadViralPosts(workspaceId: string): Promise<ViralPost[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(viralPosts)
    .where(and(eq(viralPosts.workspaceId, workspaceId), gte(viralPosts.fetchedAt, since)))
    .orderBy(desc(viralPosts.views))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    platformPostId: r.platformPostId,
    authorHandle: r.authorHandle,
    caption: r.caption,
    hashtags: r.hashtags ?? [],
    audioId: r.audioId,
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    shares: r.shares,
    engagementRate: r.engagementRate ? Number(r.engagementRate) : null,
    affiliateLinks: r.affiliateLinks ?? [],
    niche: r.niche,
  }));
}

/** Load pending remix suggestions. */
export async function loadRemixSuggestions(workspaceId: string): Promise<RemixSuggestion[]> {
  const rows = await db
    .select()
    .from(trendRemixSuggestions)
    .where(and(eq(trendRemixSuggestions.workspaceId, workspaceId), eq(trendRemixSuggestions.status, "pending")))
    .orderBy(desc(trendRemixSuggestions.confidence))
    .limit(50);

  return rows.map((r) => ({
    id: r.id,
    viralPostId: r.viralPostId,
    trendingHashtagId: r.trendingHashtagId,
    trendingAudioId: r.trendingAudioId,
    productId: r.productId,
    suggestedFormat: r.suggestedFormat as "remix" | "reaction" | "tutorial" | "showcase",
    hookIdea: r.hookIdea,
    scriptOutline: r.scriptOutline,
    confidence: r.confidence,
    status: r.status,
  }));
}

/** Load all remix suggestions with status. */
export async function loadAllRemixSuggestions(workspaceId: string) {
  return db
    .select()
    .from(trendRemixSuggestions)
    .where(eq(trendRemixSuggestions.workspaceId, workspaceId))
    .orderBy(desc(trendRemixSuggestions.createdAt))
    .limit(50);
}

/** Approve a remix suggestion. */
export async function approveRemixSuggestion(
  workspaceId: string,
  suggestionId: string,
): Promise<void> {
  await db
    .update(trendRemixSuggestions)
    .set({
      status: "approved",
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(trendRemixSuggestions.id, suggestionId), eq(trendRemixSuggestions.workspaceId, workspaceId)));
}

/** Reject a remix suggestion. */
export async function rejectRemixSuggestion(
  workspaceId: string,
  suggestionId: string,
): Promise<void> {
  await db
    .update(trendRemixSuggestions)
    .set({
      status: "rejected",
      updatedAt: new Date(),
    })
    .where(and(eq(trendRemixSuggestions.id, suggestionId), eq(trendRemixSuggestions.workspaceId, workspaceId)));
}

/** Mark suggestion as created (video enqueued). */
export async function markRemixCreated(
  workspaceId: string,
  suggestionId: string,
): Promise<void> {
  await db
    .update(trendRemixSuggestions)
    .set({
      status: "created",
      updatedAt: new Date(),
    })
    .where(and(eq(trendRemixSuggestions.id, suggestionId), eq(trendRemixSuggestions.workspaceId, workspaceId)));
}

/** Run trend analysis and generate suggestions. */
export async function runTrendAnalysis(workspaceId: string): Promise<{
  suggestionsCreated: number;
  topHashtags: TrendingHashtag[];
  topAudio: TrendingAudio[];
  topViralPosts: ViralPost[];
}> {
  console.log(`[Trend Miner] Starting analysis for workspace ${workspaceId}`);
  try {
    const [niche, products, hashtags, audio, viralPostsData] = await Promise.all([
      getWorkspaceNiche(workspaceId),
      getProducts(workspaceId),
      loadTrendingHashtags(workspaceId),
      loadTrendingAudio(workspaceId),
      loadViralPosts(workspaceId),
    ]);

    console.log(`[Trend Miner] Loaded: niche=${niche}, products=${products.length}, hashtags=${hashtags.length}, audio=${audio.length}, viralPosts=${viralPostsData.length}`);

    const input: TrendAnalysisInput = {
      workspaceNiche: niche,
      products,
      trendingHashtags: hashtags,
      trendingAudio: audio,
      viralPosts: viralPostsData,
    };

    const suggestions = generateRemixSuggestions(input);
    console.log(`[Trend Miner] Generated ${suggestions.length} suggestions`);

    if (suggestions.length === 0) {
      return { suggestionsCreated: 0, topHashtags: [], topAudio: [], topViralPosts: [] };
    }

    // Insert suggestions
    const inserted = await db
      .insert(trendRemixSuggestions)
      .values(
        suggestions.map((s) => ({
          workspaceId,
          viralPostId: s.viralPostId,
          trendingHashtagId: s.trendingHashtagId,
          trendingAudioId: s.trendingAudioId,
          productId: s.productId,
          suggestedFormat: s.suggestedFormat,
          hookIdea: s.hookIdea,
          scriptOutline: s.scriptOutline,
          confidence: s.confidence,
          status: "pending",
        })),
      )
      .returning({ id: trendRemixSuggestions.id });

    console.log(`[Trend Miner] Inserted ${inserted.length} suggestions`);

    return {
      suggestionsCreated: inserted.length,
      topHashtags: getTopHashtagsForNiche(hashtags, niche, 10),
      topAudio: getTopAudioForPlatform(audio, "instagram", 10),
      topViralPosts: viralPostsData.slice(0, 10),
    };
  } catch (error) {
    console.error(`[Trend Miner] Error in runTrendAnalysis:`, error);
    throw error;
  }
}

/** Cron job: fetch trending data from platforms (stub). */
export async function fetchTrendingData(workspaceId: string): Promise<void> {
  // This would call platform APIs to fetch trending hashtags/audio/viral posts
  // For now, it's a stub - real implementation would use platform connections
  console.log(`[Trend Miner] Fetching trending data for workspace ${workspaceId}`);
  // Example: fetch from TikTok Creative Center, Instagram Explore, YouTube Trending
}

/** Cron job: run full trend analysis pipeline. */
export async function runTrendMinerPipeline(workspaceId: string): Promise<void> {
  await fetchTrendingData(workspaceId);
  await runTrendAnalysis(workspaceId);
}