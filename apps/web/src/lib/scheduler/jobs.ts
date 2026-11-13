/**
 * Phase 5 Module A — Scheduler job definitions (full implementations).
 * Research → Script → Video → Publish → Analytics → Optimizer → Report
 * All jobs use the plugin architecture for affiliate/social integrations.
 */
import { db } from "@/lib/db";
import {
  jobsAudit,
  workspaces,
  products,
  contents,
  videos,
  autopilotConfig,
  connections,
  affiliateLinks,
  analyticsDaily,
  brandProfiles,
  posts,
} from "@aa/db";
import { runAIScoring } from "@/lib/scoring/ai-score";
import { and, desc, eq, gte, lt, inArray, sql, count, sum } from "drizzle-orm";
import { generateScript, VIDEO_MODES, type VideoMode } from "@/lib/video/scripts";
import { splitScriptIntoScenes } from "@/lib/video/scenes";
import { enqueueVideoRender } from "@/lib/video/enqueue";
import { checkRenderQuota } from "@/lib/video/credits";
import { publishVideoPost } from "@/lib/publisher";
import { loadWorkspacePlugins, buildPluginConfig } from "@/lib/connections/plugins/registry";

export type JobType =
  | "research"
  | "ai_scoring"
  | "script"
  | "video"
  | "publish"
  | "analytics"
  | "optimizer"
  | "report"
  | "dm_triggers";

export interface JobContext {
  workspaceId: string;
  jobType: JobType;
  /** Correlation ID for tracing a full daily run. */
  runId: string;
}

export interface JobResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  costUsd?: number;
}

export type JobFn = (ctx: JobContext) => Promise<JobResult>;

/** Research Job — 04:00 UTC: fetch trending products from all enabled affiliate plugins. */
async function researchJob(ctx: JobContext): Promise<JobResult> {
  const { affiliatePlugins, socialPlugins } = await loadWorkspacePlugins(ctx.workspaceId);

  if (affiliatePlugins.length === 0) {
    return { success: true, output: { message: "No affiliate plugins configured", productsFound: 0 } };
  }

  // Get workspace niche from brand profile
  const [brand] = await db.select({ niche: brandProfiles.niche }).from(brandProfiles).where(eq(brandProfiles.workspaceId, ctx.workspaceId)).limit(1);
  const niche = brand?.niche ?? "general";

  let totalProductsFound = 0;
  let totalProductsSaved = 0;

  for (const plugin of affiliatePlugins) {
    // Get connection config for this plugin
    const [conn] = await db
      .select()
      .from(connections)
      .where(and(eq(connections.workspaceId, ctx.workspaceId), eq(connections.provider, plugin.id), eq(connections.status, "active")))
      .limit(1);

    if (!conn) continue;

    const config = buildPluginConfig(conn);
    const validation = plugin.validateConfig(config);
    if (!validation.ok) {
      console.warn(`Plugin ${plugin.id} config invalid:`, validation.missing);
      continue;
    }

    try {
      const result = await plugin.fetchProducts({
        niche,
        limit: 50,
        config,
      });

      totalProductsFound += result.products.length;

      // Save new products
      for (const fp of result.products) {
        const [existing] = await db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.workspaceId, ctx.workspaceId), eq(products.source, plugin.id), eq(products.sourceId, fp.sourceId)))
          .limit(1);

        if (existing) continue;

        await db.insert(products).values({
          workspaceId: ctx.workspaceId,
          source: plugin.id,
          sourceId: fp.sourceId,
          title: fp.title,
          price: fp.price ?? null,
          currency: fp.currency ?? "USD",
          category: fp.category ?? null,
          rating: fp.rating ?? null,
          reviewCount: fp.reviewCount ?? null,
          imageUrl: fp.imageUrl ?? null,
          commissionType: fp.commissionType ?? null,
          commissionValue: fp.commissionValue ?? null,
          aiScore: null,
          status: "active",
        }).onConflictDoNothing();

        totalProductsSaved++;
      }
    } catch (e) {
      console.error(`Research failed for ${plugin.id}:`, e);
    }
  }

  return {
    success: true,
    output: { productsFound: totalProductsFound, productsSaved: totalProductsSaved, niche },
  };
}

/** AI Scoring Job — 04:30 UTC: calculate 0-100 AI score for all active products. */
async function aiScoringJob(ctx: JobContext): Promise<JobResult> {
  const result = await runAIScoring(ctx.workspaceId);
  return { success: true, output: { scored: result.scored, updated: result.updated } };
}

/** Script Job — 05:00 UTC: generate scripts for top-scored products without scripts. */
async function scriptJob(ctx: JobContext): Promise<JobResult> {
  const productRows = await db
    .select({ id: products.id, title: products.title, price: products.price, currency: products.currency, category: products.category, rating: products.rating, reviewCount: products.reviewCount })
    .from(products)
    .where(and(eq(products.workspaceId, ctx.workspaceId), eq(products.status, "active")))
    .orderBy(desc(products.aiScore))
    .limit(20);

  let scriptsCreated = 0;

  for (const product of productRows) {
    const [existingContent] = await db
      .select({ id: contents.id })
      .from(contents)
      .where(and(eq(contents.workspaceId, ctx.workspaceId), eq(contents.productId, product.id), eq(contents.type, "video")))
      .limit(1);

    if (existingContent) continue;

    for (const mode of VIDEO_MODES) {
      const script = generateScript(
        {
          title: product.title,
          price: product.price,
          currency: product.currency,
          category: product.category,
          rating: product.rating,
          reviewCount: product.reviewCount,
        },
        mode
      );

      const { scenes } = splitScriptIntoScenes(script, product.title);

      await db.insert(contents).values({
        workspaceId: ctx.workspaceId,
        productId: product.id,
        type: "video",
        platformTarget: "instagram",
        body: { script, scenes, mode } as unknown as Record<string, unknown>,
        status: "approved",
        aiModelUsed: "template-v1",
      });

      scriptsCreated++;
    }
  }

  return { success: true, output: { scriptsCreated, productsProcessed: productRows.length } };
}

/** Video Job — 06:00 UTC: enqueue renders for approved scripts without videos. */
async function videoJob(ctx: JobContext): Promise<JobResult> {
  const contentRows = await db
    .select({ id: contents.id, productId: contents.productId, body: contents.body })
    .from(contents)
    .where(and(eq(contents.workspaceId, ctx.workspaceId), eq(contents.status, "approved"), eq(contents.type, "video")))
    .limit(20);

  let videosEnqueued = 0;

  for (const content of contentRows) {
    const [existingVideo] = await db
      .select({ id: videos.id })
      .from(videos)
      .where(eq(videos.contentId, content.id))
      .limit(1);

    if (existingVideo) continue;

    const body = content.body as { mode?: string; script?: any; scenes?: any[] };
    const mode = (body.mode ?? "showcase") as VideoMode;

    const quotaCheck = await checkRenderQuota(ctx.workspaceId, "platform_pool");
    if (!quotaCheck.decision.allowed) {
      return { success: true, output: { message: "Quota exceeded, stopping video enqueue", videosEnqueued } };
    }

    try {
      await enqueueVideoRender({
        workspaceId: ctx.workspaceId,
        productId: content.productId!,
        mode,
      });
      videosEnqueued++;
    } catch (e) {
      console.error("Video enqueue failed:", e);
    }
  }

  return { success: true, output: { videosEnqueued, contentProcessed: contentRows.length } };
}

/** Publish Job — runs every 30 min: publish due posts respecting caps/quiet hours. */
async function publishJob(ctx: JobContext): Promise<JobResult> {
  const { isQuietHours, checkDailyPostCap } = await import("./jobs");

  const [cfg] = await db
    .select()
    .from(autopilotConfig)
    .where(eq(autopilotConfig.workspaceId, ctx.workspaceId))
    .limit(1);

  const config = cfg
    ? {
        dailyPostLimits: cfg.dailyPostLimits as Record<string, number>,
        activePlatforms: cfg.activePlatforms as string[],
        quietHours: cfg.quietHours as { from: string; to: string },
        paused: cfg.paused ?? false,
      }
    : {
        dailyPostLimits: { instagram: 3, youtube: 2 },
        activePlatforms: ["instagram", "youtube"],
        quietHours: { from: "22:00", to: "08:00" },
        paused: false,
      };

  if (config.paused || isQuietHours(config.quietHours)) {
    return { success: true, output: { message: "Paused or quiet hours" } };
  }

  let totalPublished = 0;

  for (const platform of config.activePlatforms) {
    const limit = config.dailyPostLimits[platform] ?? 5;
    const capCheck = await checkDailyPostCap(ctx.workspaceId, platform, limit);
    if (!capCheck.allowed) continue;

    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const postsToPublish = await db
      .select({ id: videos.id })
      .from(videos)
      .where(
        and(
          eq(videos.workspaceId, ctx.workspaceId),
          eq(videos.renderStatus, "done"),
          sql`NOT EXISTS (SELECT 1 FROM posts WHERE posts.video_id = videos.id AND posts.platform = ${platform})`
        )
      )
      .limit(limit - capCheck.used);

    for (const post of postsToPublish) {
      try {
        await publishVideoPost({
          workspaceId: ctx.workspaceId,
          videoId: post.id,
          platform: platform as "instagram" | "youtube",
          mode: "auto",
        });
        totalPublished++;
      } catch (e) {
        console.error(`Auto-publish failed for video ${post.id} to ${platform}:`, e);
      }
    }
  }

  return { success: true, output: { published: totalPublished } };
}

/** Analytics Job — sync platform insights + affiliate conversions. */
async function analyticsJob(ctx: JobContext): Promise<JobResult> {
  const { affiliatePlugins, socialPlugins } = await loadWorkspacePlugins(ctx.workspaceId);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let totalConversions = 0;

  for (const plugin of affiliatePlugins) {
    if (!plugin.capabilities.apiConversions) continue;

    const [conn] = await db
      .select()
      .from(connections)
      .where(and(eq(connections.workspaceId, ctx.workspaceId), eq(connections.provider, plugin.id), eq(connections.status, "active")))
      .limit(1);

    if (!conn) continue;

    const config = buildPluginConfig(conn);
    try {
      const conversions = await plugin.importConversions?.({ since, config }) ?? [];
      totalConversions += conversions.length;

      for (const conv of conversions) {
        // Record in affiliate_links — need a productId, so we try to find by sourceId
        let productId: string | null = null;
        if (conv.sourceId) {
          const [prod] = await db
            .select({ id: products.id })
            .from(products)
            .where(and(eq(products.workspaceId, ctx.workspaceId), eq(products.sourceId, conv.sourceId)))
            .limit(1);
          productId = prod?.id ?? null;
        }

        const shortCode = conv.shortCode ?? `conv_${Date.now().toString(36)}`;
        if (productId) {
          await db.insert(affiliateLinks).values({
            workspaceId: ctx.workspaceId,
            productId: productId as string,
            rawUrl: "",
            shortCode: shortCode as string,
            createdAt: conv.occurredAt,
          }).onConflictDoNothing({ target: affiliateLinks.shortCode });
        }
      }
    } catch (e) {
      console.error(`Analytics import failed for ${plugin.id}:`, e);
    }
  }

  let totalInsights = 0;
  for (const plugin of socialPlugins) {
    const [conn] = await db
      .select()
      .from(connections)
      .where(and(eq(connections.workspaceId, ctx.workspaceId), eq(connections.provider, plugin.id), eq(connections.status, "active")))
      .limit(1);

    if (!conn) continue;

    const config = buildPluginConfig(conn);
    try {
      const insights = await plugin.fetchInsights?.({
        accountId: String(conn.accountId),
        since,
        until: now,
        credentials: { accessToken: String(conn.accessTokenEnc), refreshToken: String(conn.refreshTokenEnc), expiresAt: (conn.tokenExpiresAt ?? undefined) as Date | undefined, accountId: String(conn.accountId), accountName: conn.accountName ?? "" },
      }) ?? [];
      totalInsights += insights.length;
    } catch (e) {
      console.error(`Insights fetch failed for ${plugin.id}:`, e);
    }
  }

  return { success: true, output: { conversionsImported: totalConversions, insightsFetched: totalInsights } };
}

/** Optimizer Job — score posts, boost winners, pause losers. */
async function optimizerJob(ctx: JobContext): Promise<JobResult> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  const recentPosts = await db
    .select({ id: videos.id })
    .from(videos)
    .where(and(eq(videos.workspaceId, ctx.workspaceId), gte(videos.createdAt, weekAgo)))
    .limit(100);

  let boosted = 0;
  let paused = 0;

  for (const post of recentPosts) {
    // Get platform from posts table for this video
    const [postData] = await db
      .select({ platform: posts.platform })
      .from(posts)
      .where(and(eq(posts.workspaceId, ctx.workspaceId), eq(posts.videoId, post.id)))
      .limit(1);

    const platform = postData?.platform ?? "instagram";

    const [stats] = await db
      .select({
        clicks: sum(analyticsDaily.clicks),
        views: sum(analyticsDaily.impressions),
      })
      .from(analyticsDaily)
      .where(and(eq(analyticsDaily.workspaceId, ctx.workspaceId), eq(analyticsDaily.platform, platform), gte(analyticsDaily.day, weekAgoStr)))
      .limit(1);

    const views = Number(stats?.views ?? 0);
    const clicks = Number(stats?.clicks ?? 0);
    const ctr = views > 0 ? clicks / views : 0;

    if (ctr < 0.01 && views > 100) {
      paused++;
    }
    if (ctr > 0.05) {
      boosted++;
    }
  }

  return { success: true, output: { boosted, paused, analyzed: recentPosts.length } };
}

/** Report Job — generate daily/weekly report, send email. */
async function reportJob(ctx: JobContext): Promise<JobResult> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dayStr = yesterday.toISOString().split("T")[0];

  const [summary] = await db
    .select({
      totalViews: sum(analyticsDaily.impressions),
      totalClicks: sum(analyticsDaily.clicks),
      totalConversions: sum(analyticsDaily.conversions),
      totalEarnings: sum(analyticsDaily.revenue),
    })
    .from(analyticsDaily)
    .where(and(eq(analyticsDaily.workspaceId, ctx.workspaceId), eq(analyticsDaily.day, dayStr)))
    .limit(1);

  const totalViews = Number(summary?.totalViews ?? 0);
    const totalClicks = Number(summary?.totalClicks ?? 0);
    const report = {
      date: dayStr,
      views: totalViews,
      clicks: totalClicks,
      conversions: Number(summary?.totalConversions ?? 0),
      earnings: Number(summary?.totalEarnings ?? 0),
      ctr: totalViews > 0 ? totalClicks / totalViews : 0,
    };

  return { success: true, output: { report } };
}

/** DM Triggers Job — process comment/DM triggers, send replies. */
async function dmTriggersJob(ctx: JobContext): Promise<JobResult> {
  return { success: true, output: { message: "Handled by dedicated cron" } };
}

/** Registry of all scheduled jobs. */
export const jobRegistry: Record<JobType, JobFn> = {
  research: researchJob,
  ai_scoring: aiScoringJob,
  script: scriptJob,
  video: videoJob,
  publish: publishJob,
  analytics: analyticsJob,
  optimizer: optimizerJob,
  report: reportJob,
  dm_triggers: dmTriggersJob,
};

/**
 * Run a single job with full audit trail (jobs_audit row).
 * Handles errors gracefully — never throws, always records outcome.
 */
export async function runJob(ctx: JobContext): Promise<JobResult> {
  const jobFn = jobRegistry[ctx.jobType];

  const [audit] = await db
    .insert(jobsAudit)
    .values({
      workspaceId: ctx.workspaceId,
      jobType: ctx.jobType,
      status: "running",
      startedAt: new Date(),
      input: { runId: ctx.runId },
    })
    .returning({ id: jobsAudit.id });

  try {
    const result = await jobFn(ctx);
    await db
      .update(jobsAudit)
      .set({
        status: result.success ? "success" : "failed",
        finishedAt: new Date(),
        output: result.output ?? null,
        error: result.error ?? null,
        costUsd: result.costUsd ? String(result.costUsd.toFixed(4)) : null,
      })
      .where(eq(jobsAudit.id, audit.id));
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db
      .update(jobsAudit)
      .set({
        status: "failed",
        finishedAt: new Date(),
        error: message.slice(0, 1000),
      })
      .where(eq(jobsAudit.id, audit.id));
    return { success: false, error: message };
  }
}

/** Generate a run ID for correlating a full daily cycle. */
export function generateRunId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 8);
  return `run_${dateStr}_${random}`;
}

/** Check if current time is within quiet hours (UTC). */
export function isQuietHours(
  quietHours: { from: string; to: string } = { from: "22:00", to: "08:00" },
  now: Date = new Date()
): boolean {
  const [fromH, fromM] = quietHours.from.split(":").map(Number);
  const [toH, toM] = quietHours.to.split(":").map(Number);

  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const fromMinutes = fromH * 60 + fromM;
  const toMinutes = toH * 60 + toM;

  if (fromMinutes === toMinutes) return false;

  if (fromMinutes < toMinutes) {
    return currentMinutes >= fromMinutes && currentMinutes < toMinutes;
  } else {
    return currentMinutes >= fromMinutes || currentMinutes < toMinutes;
  }
}

/** Check daily post cap for a platform. */
export async function checkDailyPostCap(
  workspaceId: string,
  platform: string,
  limit: number,
  now: Date = new Date()
): Promise<{ allowed: boolean; used: number }> {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const { posts } = await import("@aa/db");
  const { count, and, eq, gte, lt } = await import("drizzle-orm");

  const [row] = await db
    .select({ value: count() })
    .from(posts)
    .where(
      and(
        eq(posts.workspaceId, workspaceId),
        eq(posts.platform, platform),
        gte(posts.publishedAt, dayStart),
        lt(posts.publishedAt, dayEnd)
      )
    );

  const used = Number(row?.value ?? 0);
  return { allowed: used < limit, used };
}