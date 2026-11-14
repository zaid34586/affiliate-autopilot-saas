/**
 * Phase 6 — Performance Memory DB Orchestration.
 *
 * Database operations for vector-based performance memory:
 * - Store embeddings with performance metrics
 * - Semantic similarity search
 * - Niche insight generation
 * - Batch embedding generation
 */

import { db } from "@/lib/db";
import {
  performanceEmbeddings,
  posts,
  videos,
  analyticsDaily,
  contents,
  products,
  brandProfiles,
} from "@aa/db";
import { eq, and, desc, sql, inArray, gte, sum } from "drizzle-orm";
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import {
  PerformanceEntry,
  SimilarContentResult,
  NicheInsight,
  buildEmbeddingText,
  generateNicheInsight,
} from "./performance-memory-core";

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dimensions
const BATCH_SIZE = 50;

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const { embeddings } = await embedMany({
    model: openai.embedding(EMBEDDING_MODEL),
    values: [text],
  });
  return embeddings[0];
}

/**
 * Generate embeddings for multiple texts
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: openai.embedding(EMBEDDING_MODEL),
    values: texts,
  });
  return embeddings;
}

/**
 * Store a performance entry with embedding
 */
export async function storePerformanceEntry(
  workspaceId: string,
  entry: PerformanceEntry,
): Promise<void> {
  const embeddingText = buildEmbeddingText(entry);
  const embedding = await generateEmbedding(embeddingText);

  await db.insert(performanceEmbeddings).values({
    workspaceId,
    contentType: entry.contentType,
    contentId: entry.contentId,
    contentText: embeddingText,
    embedding,
    metadata: {
      platform: entry.platform,
      format: entry.format,
      niche: entry.niche,
      metrics: entry.metrics,
      ...entry.metadata,
    },
  });
}

/**
 * Batch store performance entries
 */
export async function batchStorePerformanceEntries(
  workspaceId: string,
  entries: PerformanceEntry[],
): Promise<number> {
  let stored = 0;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);
    const embeddings = await generateEmbeddings(texts);

    const values = batch.map((entry, idx) => ({
      workspaceId,
      contentType: entry.contentType,
      contentId: entry.contentId,
      contentText: texts[idx],
      embedding: embeddings[idx],
      metadata: {
        platform: entry.platform,
        format: entry.format,
        niche: entry.niche,
        metrics: entry.metrics,
        ...entry.metadata,
      },
    }));

    await db.insert(performanceEmbeddings).values(values);
    stored += batch.length;
  }
  return stored;
}

/**
 * Find similar content by semantic search
 */
export async function findSimilarContent(
  workspaceId: string,
  queryText: string,
  options: {
    contentType?: string;
    platform?: string;
    niche?: string;
    limit?: number;
    minSimilarity?: number;
  } = {},
): Promise<SimilarContentResult[]> {
  const { contentType, platform, niche, limit = 10, minSimilarity = 0.7 } = options;

  const queryEmbedding = await generateEmbedding(queryText);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  // Build where conditions for metadata filtering
  const metadataConditions: string[] = [];
  if (platform) metadataConditions.push(`metadata->>'platform' = '${platform}'`);
  if (niche) metadataConditions.push(`metadata->>'niche' = '${niche}'`);
  const metadataWhere = metadataConditions.length > 0 ? `AND ${metadataConditions.join(" AND ")}` : "";

  const results = await db.execute(sql`
    SELECT 
      id,
      content_type as "contentType",
      content_text as "contentText",
      metadata,
      1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM performance_embeddings
    WHERE workspace_id = ${workspaceId}
    ${contentType ? sql`AND content_type = ${contentType}` : sql``}
    ${metadataWhere}
    AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${minSimilarity}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `);

  // Handle different result formats from db.execute
  const rows = Array.isArray(results) ? results : (results as any).rows || [];

  return rows.map((row: any) => ({
    id: row.id,
    contentType: row.contentType,
    contentText: row.contentText,
    platform: row.metadata?.platform,
    format: row.metadata?.format,
    niche: row.metadata?.niche,
    metrics: row.metadata?.metrics || {},
    similarity: parseFloat(row.similarity),
    metadata: row.metadata,
  }));
}

/**
 * Get niche-specific insights from performance memory
 */
export async function getNicheInsights(
  workspaceId: string,
  niche: string,
  limit: number = 50,
): Promise<NicheInsight> {
  const similarContent = await findSimilarContent(workspaceId, `Best performing content in ${niche} niche`, {
    niche,
    limit,
    minSimilarity: 0.6,
  });
  return generateNicheInsight(niche, similarContent);
}

/**
 * Get "what works" recommendations for a niche/platform/format
 */
export async function getWhatWorksRecommendations(
  workspaceId: string,
  niche: string,
  platform?: string,
  format?: string,
): Promise<{
  hooks: string[];
  ctas: string[];
  platforms: string[];
  formats: string[];
  avgMetrics: { ctr: number; conversionRate: number; revenue: number };
  topExamples: SimilarContentResult[];
}> {
  const query = `High performing ${niche} content${platform ? ` on ${platform}` : ""}${format ? ` in ${format} format` : ""}`;
  const similar = await findSimilarContent(workspaceId, query, {
    contentType: "post",
    platform,
    niche,
    limit: 20,
    minSimilarity: 0.65,
  });

  const insight = generateNicheInsight(niche, similar);

  // Calculate average metrics
  const avgMetrics = similar.length > 0
    ? similar.reduce((acc, r) => ({
        ctr: acc.ctr + r.metrics.ctr,
        conversionRate: acc.conversionRate + r.metrics.conversionRate,
        revenue: acc.revenue + r.metrics.revenue,
      }), { ctr: 0, conversionRate: 0, revenue: 0 })
    : { ctr: 0, conversionRate: 0, revenue: 0 };

  if (similar.length > 0) {
    avgMetrics.ctr /= similar.length;
    avgMetrics.conversionRate /= similar.length;
    avgMetrics.revenue /= similar.length;
  }

  return {
    hooks: insight.bestHooks.map(h => h.hook),
    ctas: insight.bestCtAs.map(c => c.cta),
    platforms: insight.bestPlatforms.map(p => p.platform),
    formats: insight.bestFormats.map(f => f.format),
    avgMetrics,
    topExamples: similar.slice(0, 5),
  };
}

/**
 * Sync recent post performance to embeddings (run via cron)
 */
export async function syncPostPerformanceToMemory(workspaceId: string, lookbackDays: number = 30): Promise<number> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString().split("T")[0];

  // Get posts with analytics - join with contents, products, and brandProfiles for niche
  const postsWithAnalytics = await db
    .select({
      postId: posts.id,
      platform: posts.platform,
      contentId: posts.contentId,
      videoId: posts.videoId,
      status: posts.status,
      publishedAt: posts.publishedAt,
      contentBody: contents.body,
      productTitle: products.title,
      productCategory: products.category,
      brandNiche: brandProfiles.niche,
    })
    .from(posts)
    .leftJoin(contents, eq(contents.id, posts.contentId))
    .leftJoin(products, eq(products.id, contents.productId))
    .leftJoin(brandProfiles, eq(brandProfiles.workspaceId, posts.workspaceId))
    .where(and(eq(posts.workspaceId, workspaceId), gte(posts.publishedAt, since)))
    .limit(100);

  // Get analytics for these posts
  const postIds = postsWithAnalytics.map(p => p.postId);
  if (postIds.length === 0) return 0;

  const analytics = await db
    .select({
      postId: analyticsDaily.postId,
      impressions: sum(analyticsDaily.impressions),
      clicks: sum(analyticsDaily.clicks),
      conversions: sum(analyticsDaily.conversions),
      revenue: sum(analyticsDaily.revenue),
    })
    .from(analyticsDaily)
    .where(and(
      eq(analyticsDaily.workspaceId, workspaceId),
      inArray(analyticsDaily.postId, postIds),
      gte(analyticsDaily.day, sinceStr),
    ))
    .groupBy(analyticsDaily.postId);

  const analyticsMap = new Map(analytics.map(a => [a.postId, a]));

  // Build performance entries
  const entries: PerformanceEntry[] = [];
  for (const post of postsWithAnalytics) {
    const a = analyticsMap.get(post.postId);
    if (!a || Number(a.impressions || 0) < 50) continue; // Minimum impressions threshold

    const impressions = Number(a.impressions || 0);
    const clicks = Number(a.clicks || 0);
    const conversions = Number(a.conversions || 0);
    const revenue = Number(a.revenue || 0);

    const contentText = typeof post.contentBody === "object" && post.contentBody
      ? JSON.stringify(post.contentBody)
      : `Product: ${post.productTitle || "Unknown"}`;

    // Use brand niche or product category as niche
    const niche = post.brandNiche || post.productCategory || undefined;

    entries.push({
      contentType: "post",
      contentId: post.postId,
      contentText,
      platform: post.platform,
      niche,
      metrics: {
        impressions,
        clicks,
        conversions,
        revenue,
        ctr: impressions > 0 ? clicks / impressions : 0,
        conversionRate: clicks > 0 ? conversions / clicks : 0,
        roi: revenue > 0 ? revenue / Math.max(impressions * 0.01, 1) : 0,
      },
      metadata: {
        productTitle: post.productTitle,
        status: post.status,
        publishedAt: post.publishedAt,
      },
    });
  }

  if (entries.length === 0) return 0;

  // Check which are already stored
  const existingContentIds = entries.map(e => e.contentId);
  const existing = await db
    .select({ contentId: performanceEmbeddings.contentId })
    .from(performanceEmbeddings)
    .where(and(
      eq(performanceEmbeddings.workspaceId, workspaceId),
      inArray(performanceEmbeddings.contentId, existingContentIds),
    ));

  const existingSet = new Set(existing.map(e => e.contentId));
  const newEntries = entries.filter(e => !existingSet.has(e.contentId));

  if (newEntries.length > 0) {
    await batchStorePerformanceEntries(workspaceId, newEntries);
  }

  return newEntries.length;
}

/**
 * Sync video performance to embeddings
 */
export async function syncVideoPerformanceToMemory(workspaceId: string, lookbackDays: number = 30): Promise<number> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const videosWithAnalytics = await db
    .select({
      videoId: videos.id,
      workspaceId: videos.workspaceId,
      title: videos.title,
      format: videos.mode,
      productTitle: products.title,
      productCategory: products.category,
      brandNiche: brandProfiles.niche,
    })
    .from(videos)
    .leftJoin(contents, eq(contents.id, videos.contentId))
    .leftJoin(products, eq(products.id, contents.productId))
    .leftJoin(brandProfiles, eq(brandProfiles.workspaceId, videos.workspaceId))
    .where(and(eq(videos.workspaceId, workspaceId), gte(videos.createdAt, since)))
    .limit(50);

  if (videosWithAnalytics.length === 0) return 0;

  // Get analytics from posts that used these videos
  const videoIds = videosWithAnalytics.map(v => v.videoId);
  const postsWithVideos = await db
    .select({ videoId: posts.videoId, postId: posts.id })
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), inArray(posts.videoId, videoIds)));

  const postIdMap = new Map<string, string[]>();
  for (const p of postsWithVideos) {
    if (p.videoId) {
      const arr = postIdMap.get(p.videoId) || [];
      arr.push(p.postId);
      postIdMap.set(p.videoId, arr);
    }
  }

  const entries: PerformanceEntry[] = [];
  for (const video of videosWithAnalytics) {
    const postIds = postIdMap.get(video.videoId) || [];
    if (postIds.length === 0) continue;

    // Aggregate analytics across all posts using this video
    const analytics = await db
      .select({
        impressions: sum(analyticsDaily.impressions),
        clicks: sum(analyticsDaily.clicks),
        conversions: sum(analyticsDaily.conversions),
        revenue: sum(analyticsDaily.revenue),
      })
      .from(analyticsDaily)
      .where(and(
        eq(analyticsDaily.workspaceId, workspaceId),
        inArray(analyticsDaily.postId, postIds),
        gte(analyticsDaily.day, since.toISOString().split("T")[0]),
      ))
      .limit(1);

    const a = analytics[0];
    const impressions = Number(a?.impressions || 0);
    if (impressions < 100) continue;

    const clicks = Number(a?.clicks || 0);
    const conversions = Number(a?.conversions || 0);
    const revenue = Number(a?.revenue || 0);

    const niche = video.brandNiche || video.productCategory || undefined;

    entries.push({
      contentType: "video",
      contentId: video.videoId,
      contentText: `Video: ${video.title || video.productTitle || "Unknown"} (${video.format})`,
      platform: "multi",
      format: video.format,
      niche,
      metrics: {
        impressions,
        clicks,
        conversions,
        revenue,
        ctr: impressions > 0 ? clicks / impressions : 0,
        conversionRate: clicks > 0 ? conversions / clicks : 0,
        roi: revenue > 0 ? revenue / Math.max(impressions * 0.01, 1) : 0,
      },
      metadata: {
        videoTitle: video.title,
        productTitle: video.productTitle,
        postCount: postIds.length,
      },
    });
  }

  if (entries.length === 0) return 0;

  const existingContentIds = entries.map(e => e.contentId);
  const existing = await db
    .select({ contentId: performanceEmbeddings.contentId })
    .from(performanceEmbeddings)
    .where(and(
      eq(performanceEmbeddings.workspaceId, workspaceId),
      inArray(performanceEmbeddings.contentId, existingContentIds),
    ));

  const existingSet = new Set(existing.map(e => e.contentId));
  const newEntries = entries.filter(e => !existingSet.has(e.contentId));

  if (newEntries.length > 0) {
    await batchStorePerformanceEntries(workspaceId, newEntries);
  }

  return newEntries.length;
}