/**
 * Phase 5 Module B — Analytics Sync Jobs.
 * Syncs platform insights (IG, YT, TikTok) and affiliate conversions.
 * Runs on dedicated cron schedules (every 4-6 hours).
 */
import { db } from "@/lib/db";
import { analyticsDaily, connections, posts, videos, affiliateLinks, products } from "@aa/db";
import { and, desc, eq, gte, inArray, sql, sum } from "drizzle-orm";
import { loadWorkspacePlugins, buildPluginConfig } from "@/lib/connections/plugins/registry";

export interface PlatformInsight {
  date: string | Date; // YYYY-MM-DD
  platform: string;
  postId?: string;
  videoId?: string;
  impressions: number;
  views?: number; // alias for impressions
  likes: number;
  comments: number;
  shares: number;
  clicks?: number;
  conversions?: number;
  revenue?: number; // in USD
}

/** Sync platform insights for a workspace. */
export async function syncPlatformInsights(workspaceId: string): Promise<{ synced: number; errors: string[] }> {
  const { socialPlugins } = await loadWorkspacePlugins(workspaceId);
  const errors: string[] = [];
  let totalSynced = 0;

  for (const plugin of socialPlugins) {
    const [conn] = await db
      .select()
      .from(connections)
      .where(and(eq(connections.workspaceId, workspaceId), eq(connections.provider, plugin.id), eq(connections.status, "active")))
      .limit(1);

    if (!conn) continue;

    try {
      // Get posts from last 7 days to sync insights
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentPosts = await db
        .select({ id: posts.id, platform: posts.platform, videoId: posts.videoId, publishedAt: posts.publishedAt })
        .from(posts)
        .where(and(eq(posts.workspaceId, workspaceId), eq(posts.platform, plugin.id), gte(posts.publishedAt, weekAgo)))
        .limit(100);

      for (const post of recentPosts) {
        if (!post.publishedAt) continue;

        const since = new Date(post.publishedAt);
        const until = new Date(Math.min(Date.now(), since.getTime() + 7 * 24 * 60 * 60 * 1000));

        const insights = await plugin.fetchInsights?.({
          accountId: conn.accountId!,
          since,
          until,
          credentials: {
            accessToken: conn.accessTokenEnc!,
            refreshToken: conn.refreshTokenEnc ?? undefined,
            expiresAt: conn.tokenExpiresAt ? new Date(conn.tokenExpiresAt) : undefined,
            accountId: conn.accountId!,
            accountName: String(conn.accountName ?? ""),
          } satisfies { accessToken: string; refreshToken?: string; expiresAt?: Date; accountId: string; accountName: string },
        }) ?? [];

        for (const insight of insights) {
          const dayDate = insight.date instanceof Date ? insight.date : new Date(insight.date);
          const dayStr = dayDate.toISOString().split("T")[0];

          // Upsert analytics_daily - day field expects YYYY-MM-DD string for date type
          // Use type assertion since plugin insights may not have all optional fields
          const imp = insight as { views?: number; impressions?: number; likes?: number; comments?: number; shares?: number; clicks?: number; conversions?: number };
          await db.insert(analyticsDaily).values({
            workspaceId,
            day: dayStr,
            platform: plugin.id,
            postId: post.id,
            impressions: imp.views ?? imp.impressions ?? 0,
            likes: imp.likes ?? 0,
            comments: imp.comments ?? 0,
            shares: imp.shares ?? 0,
            clicks: imp.clicks ?? 0,
            conversions: imp.conversions ?? 0,
            revenue: "0", // filled by affiliate sync
          }).onConflictDoUpdate({
            target: [analyticsDaily.workspaceId, analyticsDaily.day, analyticsDaily.platform, analyticsDaily.postId],
            set: {
              impressions: imp.views ?? imp.impressions ?? 0,
              likes: imp.likes ?? 0,
              comments: imp.comments ?? 0,
              shares: imp.shares ?? 0,
              clicks: imp.clicks ?? 0,
              conversions: imp.conversions ?? 0,
            },
          });
          totalSynced++;
        }
      }
    } catch (e) {
      errors.push(`${plugin.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { synced: totalSynced, errors };
}

/** Sync affiliate conversions for a workspace. */
export async function syncAffiliateConversions(workspaceId: string): Promise<{ imported: number; errors: string[] }> {
  const { affiliatePlugins } = await loadWorkspacePlugins(workspaceId);
  const errors: string[] = [];
  let totalImported = 0;

  // Determine sync window: last 24 hours (or since last sync)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const plugin of affiliatePlugins) {
    if (!plugin.capabilities.apiConversions) continue;

    const [conn] = await db
      .select()
      .from(connections)
      .where(and(eq(connections.workspaceId, workspaceId), eq(connections.provider, plugin.id), eq(connections.status, "active")))
      .limit(1);

    if (!conn) continue;

    const config = buildPluginConfig(conn);

    try {
      const conversions = await plugin.importConversions?.({ since: dayAgo, config }) ?? [];

      for (const conv of conversions) {
        // Find product by sourceId
        let productId: string | null = null;
        if (conv.sourceId) {
          const [prod] = await db
            .select({ id: products.id })
            .from(products)
            .where(and(eq(products.workspaceId, workspaceId), eq(products.sourceId, conv.sourceId)))
            .limit(1);
          productId = prod?.id ?? null;
        }

        // Record in affiliate_links
        const shortCode = conv.shortCode ?? `conv_${Date.now().toString(36)}`;
        if (productId) {
          await db.insert(affiliateLinks).values({
            workspaceId,
            productId: productId as string,
            rawUrl: "",
            shortCode: shortCode as string,
            createdAt: conv.occurredAt,
          }).onConflictDoNothing({ target: affiliateLinks.shortCode });
        }

        // Update analyticsDaily revenue for the conversion day
        const dayStr = conv.occurredAt.toISOString().split("T")[0];
        await db.insert(analyticsDaily).values({
          workspaceId,
          day: dayStr,
          platform: plugin.id,
          postId: null,
          impressions: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          conversions: 1,
          revenue: conv.commission,
        }).onConflictDoUpdate({
          target: [analyticsDaily.workspaceId, analyticsDaily.day, analyticsDaily.platform, analyticsDaily.postId],
          set: {
            conversions: sql`${analyticsDaily.conversions} + 1`,
            revenue: sql`${analyticsDaily.revenue} + ${Number(conv.commission).toFixed(2)}`,
          },
        });
        totalImported++;
      }
    } catch (e) {
      errors.push(`${plugin.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { imported: totalImported, errors };
}

/** Get analytics dashboard data for a workspace. */
export async function getAnalyticsDashboard(workspaceId: string, days: number = 30): Promise<{
  summary: { totalImpressions: number; totalClicks: number; totalConversions: number; totalRevenue: number; ctr: number };
  byPlatform: Array<{ platform: string; impressions: number; clicks: number; conversions: number; revenue: number; ctr: number }>;
  byPost: Array<{ postId: string; platform: string; title: string; impressions: number; clicks: number; conversions: number; revenue: number; ctr: number }>;
  byProduct: Array<{ productId: string; title: string; impressions: number; clicks: number; conversions: number; revenue: number }>;
  daily: Array<{ day: string; impressions: number; clicks: number; conversions: number; revenue: number }>;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString().split("T")[0];

  // Overall summary
  const [summary] = await db
    .select({
      totalImpressions: sum(analyticsDaily.impressions),
      totalClicks: sum(analyticsDaily.clicks),
      totalConversions: sum(analyticsDaily.conversions),
      totalRevenue: sum(analyticsDaily.revenue),
    })
    .from(analyticsDaily)
    .where(and(eq(analyticsDaily.workspaceId, workspaceId), gte(analyticsDaily.day, sinceStr)))
    .limit(1);

  const totalImpressions = Number(summary?.totalImpressions ?? 0);
  const totalClicks = Number(summary?.totalClicks ?? 0);
  const totalConversions = Number(summary?.totalConversions ?? 0);
  const totalRevenue = Number(summary?.totalRevenue ?? 0);
  const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

  // By platform
  const byPlatformRows = await db
    .select({
      platform: analyticsDaily.platform,
      impressions: sum(analyticsDaily.impressions),
      clicks: sum(analyticsDaily.clicks),
      conversions: sum(analyticsDaily.conversions),
      revenue: sum(analyticsDaily.revenue),
    })
    .from(analyticsDaily)
    .where(and(eq(analyticsDaily.workspaceId, workspaceId), gte(analyticsDaily.day, sinceStr)))
    .groupBy(analyticsDaily.platform);

  const byPlatform = byPlatformRows.map((r) => ({
    platform: r.platform ?? "",
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    conversions: Number(r.conversions ?? 0),
    revenue: Number(r.revenue ?? 0),
    ctr: Number(r.impressions ?? 0) > 0 ? Number(r.clicks ?? 0) / Number(r.impressions ?? 1) : 0,
  }));

  // By post
  const byPostRows = await db
    .select({
      postId: analyticsDaily.postId,
      platform: analyticsDaily.platform,
      impressions: sum(analyticsDaily.impressions),
      clicks: sum(analyticsDaily.clicks),
      conversions: sum(analyticsDaily.conversions),
      revenue: sum(analyticsDaily.revenue),
    })
    .from(analyticsDaily)
    .where(and(eq(analyticsDaily.workspaceId, workspaceId), gte(analyticsDaily.day, sinceStr)))
    .groupBy(analyticsDaily.postId, analyticsDaily.platform)
    .orderBy(desc(sum(analyticsDaily.revenue)))
    .limit(20);

  // Get post titles
  const postIds = byPostRows.map((r) => r.postId).filter(Boolean) as string[];
  const postTitles = new Map<string, string>();
  if (postIds.length > 0) {
    const postsData = await db
      .select({ id: posts.id, videoId: posts.videoId })
      .from(posts)
      .where(inArray(posts.id, postIds));
    // Get video titles
    for (const p of postsData) {
      if (p.videoId) {
        const [v] = await db.select({ title: videos.title }).from(videos).where(eq(videos.id, p.videoId)).limit(1);
        if (v) postTitles.set(p.id, v.title ?? "Untitled");
      }
    }
  }

  const byPost = byPostRows.map((r) => ({
    postId: r.postId ?? "",
    platform: r.platform ?? "",
    title: postTitles.get(r.postId ?? "") ?? "Untitled",
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    conversions: Number(r.conversions ?? 0),
    revenue: Number(r.revenue ?? 0),
    ctr: Number(r.impressions ?? 0) > 0 ? Number(r.clicks ?? 0) / Number(r.impressions ?? 1) : 0,
  }));

  // By product (from affiliate_links)
  const byProductRows = await db
    .select({
      productId: affiliateLinks.productId,
      clicks: sum(affiliateLinks.clicksTotal),
    })
    .from(affiliateLinks)
    .where(eq(affiliateLinks.workspaceId, workspaceId))
    .groupBy(affiliateLinks.productId);

  const byProduct = [];
  for (const r of byProductRows) {
    if (!r.productId) continue;
    const [prod] = await db.select({ title: products.title }).from(products).where(eq(products.id, r.productId)).limit(1);
    if (prod) {
      byProduct.push({
        productId: r.productId,
        title: prod.title,
        impressions: 0,
        clicks: Number(r.clicks ?? 0),
        conversions: 0,
        revenue: 0,
      });
    }
  }

  // Daily trend
  const dailyRows = await db
    .select({
      day: analyticsDaily.day,
      impressions: sum(analyticsDaily.impressions),
      clicks: sum(analyticsDaily.clicks),
      conversions: sum(analyticsDaily.conversions),
      revenue: sum(analyticsDaily.revenue),
    })
    .from(analyticsDaily)
    .where(and(eq(analyticsDaily.workspaceId, workspaceId), gte(analyticsDaily.day, sinceStr)))
    .groupBy(analyticsDaily.day)
    .orderBy(analyticsDaily.day);

  const daily = dailyRows.map((r) => ({
    day: r.day,
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    conversions: Number(r.conversions ?? 0),
    revenue: Number(r.revenue ?? 0),
  }));

  return {
    summary: { totalImpressions, totalClicks, totalConversions, totalRevenue, ctr },
    byPlatform,
    byPost,
    byProduct,
    daily,
  };
}

/** Generate weekly AI report content. */
export async function generateWeeklyReport(workspaceId: string): Promise<{
  period: { from: string; to: string };
  summary: { totalImpressions: number; totalClicks: number; totalConversions: number; totalRevenue: number; ctr: number };
  topPosts: Array<{ title: string; platform: string; revenue: number; ctr: number }>;
  insights: string[];
  nextWeekPlan: string[];
}> {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fromStr = from.toISOString().split("T")[0];
  const toStr = to.toISOString().split("T")[0];

  const analytics = await getAnalyticsDashboard(workspaceId, 7);

  // Top posts by revenue
  const topPosts = analytics.byPost
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((p) => ({ title: p.title, platform: p.platform, revenue: p.revenue, ctr: p.ctr }));

  // AI insights (template-based for now, LLM later)
  const insights: string[] = [];
  if (analytics.summary.totalRevenue > 0) {
    insights.push(`Generated $${analytics.summary.totalRevenue.toFixed(2)} this week from ${analytics.summary.totalConversions} conversions.`);
  }
  const bestPlatform = analytics.byPlatform.sort((a, b) => b.revenue - a.revenue)[0];
  if (bestPlatform) {
    insights.push(`Best platform: ${bestPlatform.platform} ($${bestPlatform.revenue.toFixed(2)}, ${(bestPlatform.ctr * 100).toFixed(2)}% CTR).`);
  }
  if (analytics.summary.ctr < 0.01) {
    insights.push("Overall CTR below 1% — consider testing new hooks or targeting.");
  }

  // Next week plan (template)
  const nextWeekPlan = [
    "Focus content on top-performing product categories.",
    "Test 2 new hooks for the best-selling product.",
    "Increase posting frequency on best platform by 20%.",
    "Review and pause underperforming posts (CTR < 0.5%).",
  ];

  return {
    period: { from: fromStr, to: toStr },
    summary: analytics.summary,
    topPosts,
    insights,
    nextWeekPlan,
  };
}