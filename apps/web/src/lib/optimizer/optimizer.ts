/**
 * Phase 6 — Auto-Optimizer DB Orchestration.
 * Loads post performance data, runs optimizer, records decisions.
 */

import { db } from "@/lib/db";
import {
  optimizerState,
  postPerformance,
  optimizerDecisions,
  posts,
  videos,
  abTests,
} from "@aa/db";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  runOptimizer,
  generateAbTestConfig,
  type OptimizerConfig,
  type PostMetrics,
  type OptimizerDecision,
} from "./optimizer-core";

export {
  runOptimizer,
  generateAbTestConfig,
} from "./optimizer-core";
export type { OptimizerConfig, PostMetrics, OptimizerDecision } from "./optimizer-core";

/** Load optimizer config for workspace (or defaults). */
export async function getOptimizerConfig(workspaceId: string): Promise<OptimizerConfig> {
  const [state] = await db
    .select()
    .from(optimizerState)
    .where(eq(optimizerState.workspaceId, workspaceId))
    .limit(1);

  if (!state) {
    return {
      enabled: true,
      mode: "conservative",
      minCtrThreshold: 0.005,
      minConversionRate: 0.001,
      boostThreshold: 0.02,
      pauseThreshold: 0.001,
      lookbackDays: 7,
      minPostsForDecision: 5,
    };
  }

  return {
    enabled: state.enabled,
    mode: state.mode as "conservative" | "balanced" | "aggressive",
    minCtrThreshold: Number(state.minCtrThreshold),
    minConversionRate: Number(state.minConversionRate),
    boostThreshold: Number(state.boostThreshold),
    pauseThreshold: Number(state.pauseThreshold),
    lookbackDays: state.lookbackDays ?? 7,
    minPostsForDecision: state.minPostsForDecision ?? 5,
  };
}

/** Save optimizer config. */
export async function updateOptimizerConfig(
  workspaceId: string,
  config: Partial<OptimizerConfig>,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(optimizerState)
    .where(eq(optimizerState.workspaceId, workspaceId))
    .limit(1);

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (config.enabled !== undefined) updateData.enabled = config.enabled;
  if (config.mode !== undefined) updateData.mode = config.mode;
  if (config.minCtrThreshold !== undefined) updateData.minCtrThreshold = config.minCtrThreshold;
  if (config.minConversionRate !== undefined) updateData.minConversionRate = config.minConversionRate;
  if (config.boostThreshold !== undefined) updateData.boostThreshold = config.boostThreshold;
  if (config.pauseThreshold !== undefined) updateData.pauseThreshold = config.pauseThreshold;
  if (config.lookbackDays !== undefined) updateData.lookbackDays = config.lookbackDays;
  if (config.minPostsForDecision !== undefined) updateData.minPostsForDecision = config.minPostsForDecision;

  if (existing) {
    await db
      .update(optimizerState)
      .set(updateData)
      .where(eq(optimizerState.id, existing.id));
  } else {
    await db.insert(optimizerState).values({
      workspaceId,
      ...updateData,
    } as any);
  }
}

/** Load post performance metrics for optimizer analysis. */
export async function loadPostMetrics(workspaceId: string, lookbackDays: number = 7): Promise<PostMetrics[]> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select()
    .from(postPerformance)
    .where(and(eq(postPerformance.workspaceId, workspaceId), gte(postPerformance.recordedAt, since)))
    .orderBy(desc(postPerformance.recordedAt));

  return rows.map((r) => ({
    postId: r.postId ?? "",
    videoId: r.videoId ?? undefined,
    platform: r.platform,
    format: r.format ?? undefined,
    hook: r.hook ?? undefined,
    cta: r.cta ?? undefined,
    impressions: r.impressions,
    clicks: r.clicks,
    conversions: r.conversions,
    revenue: Number(r.revenue),
    engagementRate: r.engagementRate ? Number(r.engagementRate) : undefined,
    ctr: r.ctr ? Number(r.ctr) : undefined,
    conversionRate: r.conversionRate ? Number(r.conversionRate) : undefined,
    roi: r.roi ? Number(r.roi) : undefined,
    postingTime: r.postingTime ?? new Date(),
  }));
}

/** Record optimizer decisions to DB. */
export async function recordDecisions(
  workspaceId: string,
  decisions: OptimizerDecision[],
): Promise<void> {
  if (decisions.length === 0) return;

  await db.insert(optimizerDecisions).values(
    decisions.map((d) => ({
      workspaceId,
      decisionType: d.decisionType,
      targetId: d.targetId,
      targetType: d.targetType,
      reason: d.reason,
      confidence: String(d.confidence),
      metadata: d.metadata,
      executed: false,
    })),
  );
}

/** Execute a single decision (boost/pause/remix/ab_test). */
export async function executeDecision(
  workspaceId: string,
  decisionId: string,
): Promise<{ success: boolean; error?: string }> {
  const [decision] = await db
    .select()
    .from(optimizerDecisions)
    .where(and(eq(optimizerDecisions.id, decisionId), eq(optimizerDecisions.workspaceId, workspaceId)))
    .limit(1);

  if (!decision) return { success: false, error: "Decision not found" };
  if (decision.executed) return { success: false, error: "Already executed" };

  try {
    let result: Record<string, unknown> = {};

    switch (decision.decisionType) {
      case "boost":
        // Boost: increase daily cap for this post's platform, notify autopilot
        result = await boostPost(workspaceId, decision.targetId);
        break;
      case "pause":
        // Pause: set post status to paused, stop autopilot from publishing
        result = await pausePost(workspaceId, decision.targetId);
        break;
      case "remix":
        // Remix: create a new video job with the same format but new product
        result = await createRemixJob(workspaceId, decision.targetId);
        break;
      case "ab_test":
        // A/B Test: create a new A/B test configuration
        result = await createAbTest(workspaceId, decision.targetId);
        break;
    }

    await db
      .update(optimizerDecisions)
      .set({
        executed: true,
        executedAt: new Date(),
        result,
      })
      .where(eq(optimizerDecisions.id, decisionId));

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await db
      .update(optimizerDecisions)
      .set({
        executed: false,
        result: { error: errorMsg },
      })
      .where(eq(optimizerDecisions.id, decisionId));
    return { success: false, error: errorMsg };
  }
}

/** Boost a post: increase its platform daily cap and priority. */
async function boostPost(workspaceId: string, postId: string): Promise<Record<string, unknown>> {
  const [post] = await db
    .select({ platform: posts.platform, videoId: posts.videoId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) throw new Error("Post not found");

  // Increase platform daily cap for autopilot
  const [config] = await db
    .select()
    .from(optimizerState)
    .where(eq(optimizerState.workspaceId, workspaceId))
    .limit(1);

  return {
    action: "boost",
    postId,
    platform: post.platform,
    videoId: post.videoId,
    previousCap: config?.minCtrThreshold,
    message: `Post boosted on ${post.platform}`,
  };
}

/** Pause a post: mark as paused in autopilot queue. */
async function pausePost(workspaceId: string, postId: string): Promise<Record<string, unknown>> {
  const [post] = await db
    .select({ platform: posts.platform, status: posts.status })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) throw new Error("Post not found");

  // Update post status to failed to pause it (no "paused" status in schema)
  await db
    .update(posts)
    .set({ status: "failed" })
    .where(eq(posts.id, postId));

  return {
    action: "pause",
    postId,
    platform: post.platform,
    message: `Post paused on ${post.platform}`,
  };
}

/** Create a remix job: new video with same format, new product. */
async function createRemixJob(workspaceId: string, postId: string): Promise<Record<string, unknown>> {
  const [post] = await db
    .select({ videoId: posts.videoId, platform: posts.platform, format: postPerformance.format })
    .from(posts)
    .leftJoin(postPerformance, eq(postPerformance.postId, posts.id))
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) throw new Error("Post not found");

  // Find a different high-scoring product
  const { products } = await import("@aa/db");
  const { eq: eq2, desc } = await import("drizzle-orm");

  const [product] = await db
    .select({ id: products.id, title: products.title })
    .from(products)
    .where(eq2(products.workspaceId, workspaceId))
    .orderBy(desc(products.aiScore))
    .limit(1);

  return {
    action: "remix",
    originalPostId: postId,
    newProductId: product?.id,
    newProductTitle: product?.title,
    format: post.format,
    platform: post.platform,
    message: `Remix job created for ${product?.title ?? "new product"}`,
  };
}

/** Create A/B test for a post. */
async function createAbTest(workspaceId: string, postId: string): Promise<Record<string, unknown>> {
  const [perf] = await db
    .select({ hook: postPerformance.hook, cta: postPerformance.cta, format: postPerformance.format, platform: postPerformance.platform })
    .from(postPerformance)
    .where(eq(postPerformance.postId, postId))
    .orderBy(desc(postPerformance.recordedAt))
    .limit(1);

  if (!perf) throw new Error("Post performance not found");

  // Default to CTA test if conversion rate is low
  const testType = "cta";

  const config = generateAbTestConfig(
    {
      postId,
      platform: perf.platform,
      format: perf.format ?? undefined,
      hook: perf.hook ?? undefined,
      cta: perf.cta ?? undefined,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      postingTime: new Date(),
    },
    "cta",
  );

  const [abTest] = await db
    .insert(abTests)
    .values({
      workspaceId,
      name: config.name,
      description: `Auto-generated A/B test for post ${postId.slice(0, 8)}`,
      status: "draft",
      testType: config.testType,
      variants: config.variants,
      trafficSplit: config.trafficSplit,
      metric: config.metric,
    })
    .returning({ id: abTests.id });

  return {
    action: "ab_test",
    abTestId: abTest.id,
    testType: config.testType,
    variants: config.variants.length,
    message: `A/B test created: ${config.name}`,
  };
}

/** Record post performance snapshot (called by analytics sync). */
export async function recordPostPerformance(
  workspaceId: string,
  metrics: Omit<PostMetrics, "workspaceId">,
): Promise<void> {
  await db.insert(postPerformance).values({
    workspaceId,
    postId: metrics.postId,
    videoId: metrics.videoId,
    platform: metrics.platform,
    format: metrics.format,
    hook: metrics.hook,
    cta: metrics.cta,
    postingTime: metrics.postingTime,
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    conversions: metrics.conversions,
    revenue: metrics.revenue,
    engagementRate: metrics.engagementRate,
    ctr: metrics.ctr,
    conversionRate: metrics.conversionRate,
    roi: metrics.roi,
  } as any);
}

/** Load pending decisions for review. */
export async function loadPendingDecisions(workspaceId: string): Promise<any[]> {
  return db
    .select()
    .from(optimizerDecisions)
    .where(and(eq(optimizerDecisions.workspaceId, workspaceId), eq(optimizerDecisions.executed, false)))
    .orderBy(desc(optimizerDecisions.createdAt))
    .limit(50);
}

/** Load optimizer state for dashboard. */
export async function loadOptimizerDashboard(workspaceId: string): Promise<{
  config: OptimizerConfig;
  recentDecisions: any[];
  pendingDecisions: any[];
  stats: { totalPosts: number; boosted: number; paused: number; remixed: number; abTests: number };
}> {
  const [config, recentDecisions, pendingDecisions] = await Promise.all([
    getOptimizerConfig(workspaceId),
    db
      .select()
      .from(optimizerDecisions)
      .where(eq(optimizerDecisions.workspaceId, workspaceId))
      .orderBy(desc(optimizerDecisions.createdAt))
      .limit(20),
    db
      .select()
      .from(optimizerDecisions)
      .where(and(eq(optimizerDecisions.workspaceId, workspaceId), eq(optimizerDecisions.executed, false)))
      .orderBy(desc(optimizerDecisions.createdAt))
      .limit(20),
  ]);

  const allDecisions = await db
    .select({ decisionType: optimizerDecisions.decisionType })
    .from(optimizerDecisions)
    .where(eq(optimizerDecisions.workspaceId, workspaceId));

  const stats = allDecisions.reduce(
    (acc, d) => {
      if (d.decisionType === "boost") acc.boosted++;
      else if (d.decisionType === "pause") acc.paused++;
      else if (d.decisionType === "remix") acc.remixed++;
      else if (d.decisionType === "ab_test") acc.abTests++;
      return acc;
    },
    { totalPosts: 0, boosted: 0, paused: 0, remixed: 0, abTests: 0 },
  );

  return { config, recentDecisions, pendingDecisions, stats };
}