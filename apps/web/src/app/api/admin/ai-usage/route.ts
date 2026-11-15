/**
 * Phase 8 — Admin API: AI Usage & Costs
 * GET /api/admin/ai-usage - Per workspace, per feature AI costs + margin alerts
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { 
  workspaces, 
  users, 
  analyticsDaily, 
  videos, 
  posts, 
  characters,
  subscriptions 
} from "@aa/db";
import { eq, and, desc, sql, sum, count, gte, lte } from "drizzle-orm";

// Estimated cost per operation (in USD cents)
const AI_COSTS = {
  // Video generation (Veo)
  video_render: 500, // $5 per render (estimate)
  video_remix: 200,  // $2 per remix
  voice_clone: 100,  // $1 per clone
  tts: 10,           // $0.10 per TTS
  
  // Content generation (OpenAI)
  post_generate: 5,  // $0.05 per post
  script_generate: 8, // $0.08 per script
  hook_generate: 2,  // $0.02 per hook
  caption_generate: 2,
  dm_sequence_generate: 3,
  carousel_generate: 4,
  email_generate: 3,
  
  // Image/character
  character_generate: 10,
  scene_generate: 5,
  
  // Copilot
  copilot_chat: 3,
  optimizer_decision: 2,
  
  // WhatsApp/DM
  dm_reply: 1,
} as const;

// Plan enum values from schema
const PLAN_VALUES = ["free", "starter", "pro", "agency"] as const;
type PlanValue = (typeof PLAN_VALUES)[number];

// Plan to estimated monthly revenue (cents)
const PLAN_REVENUE: Record<PlanValue, number> = {
  free: 0,
  starter: 1900,  // $19
  pro: 4900,      // $49
  agency: 9900,   // $99
};

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") || "30")));
  const workspaceId = searchParams.get("workspaceId");
  const type = searchParams.get("type") || "overview"; // overview|by-workspace|by-feature|alerts

  const since = new Date();
  since.setDate(since.getDate() - days);

  const wsWhere = workspaceId ? eq(workspaces.id, workspaceId) : undefined;

  if (type === "by-workspace") {
    return getByWorkspace(since, wsWhere);
  }
  if (type === "by-feature") {
    return getByFeature(since, wsWhere);
  }
  if (type === "alerts") {
    return getMarginAlerts(since, wsWhere);
  }
  return getOverview(since, wsWhere);
}

async function getOverview(since: Date, wsWhere?: any) {
  const [
    totalVideoRenders,
    totalVideoRemixes,
    totalPostsGenerated,
    workspacesWithUsage,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(videos)
      .where(and(gte(videos.createdAt, since), wsWhere ? eq(videos.workspaceId, wsWhere) : undefined))
      .catch(() => [{ count: 0 }]),
    db
      .select({ count: count() })
      .from(videos)
      .where(and(eq(videos.mode, "remix"), gte(videos.createdAt, since), wsWhere ? eq(videos.workspaceId, wsWhere) : undefined))
      .catch(() => [{ count: 0 }]),
    db
      .select({ count: count() })
      .from(posts)
      .where(and(gte(posts.createdAt, since), wsWhere ? eq(posts.workspaceId, wsWhere) : undefined))
      .catch(() => [{ count: 0 }]),
    db
      .select({ count: count() })
      .from(workspaces)
      .where(wsWhere),
  ]);

  const estimatedCostCents = 
    (totalVideoRenders[0]?.count || 0) * AI_COSTS.video_render +
    (totalVideoRemixes[0]?.count || 0) * AI_COSTS.video_remix +
    (totalPostsGenerated[0]?.count || 0) * AI_COSTS.post_generate;

  const estimatedRevenueCents = workspacesWithUsage[0]?.count * 4900; // rough $49/mo average

  return NextResponse.json({
    periodDays: Math.ceil((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24)),
    summary: {
      totalEstimatedCostUsd: Math.round(estimatedCostCents / 100 * 100) / 100,
      totalEstimatedRevenueUsd: Math.round(estimatedRevenueCents / 100 * 100) / 100,
      marginPercent: estimatedRevenueCents > 0 
        ? Math.round(((estimatedRevenueCents - estimatedCostCents) / estimatedRevenueCents) * 100 * 100) / 100
        : 0,
      workspacesTracked: workspacesWithUsage[0]?.count || 0,
    },
    breakdown: {
      videoRenders: { count: totalVideoRenders[0]?.count || 0, costPerUnit: AI_COSTS.video_render / 100, totalCost: ((totalVideoRenders[0]?.count || 0) * AI_COSTS.video_render) / 100 },
      videoRemixes: { count: totalVideoRemixes[0]?.count || 0, costPerUnit: AI_COSTS.video_remix / 100, totalCost: ((totalVideoRemixes[0]?.count || 0) * AI_COSTS.video_remix) / 100 },
      postsGenerated: { count: totalPostsGenerated[0]?.count || 0, costPerUnit: AI_COSTS.post_generate / 100, totalCost: ((totalPostsGenerated[0]?.count || 0) * AI_COSTS.post_generate) / 100 },
    },
  });
}

async function getByWorkspace(since: Date, wsWhere?: any) {
  const rows = await db
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      plan: workspaces.plan,
      ownerEmail: users.email,
      videoRenders: sql<number>`(
        select count(*) from ${videos} 
        where ${videos.workspaceId} = ${workspaces.id} 
        and ${videos.createdAt} >= ${since}
      )::int`,
      videoRemixes: sql<number>`(
        select count(*) from ${videos} 
        where ${videos.workspaceId} = ${workspaces.id} 
        and ${videos.mode} = 'remix'
        and ${videos.createdAt} >= ${since}
      )::int`,
      postsGenerated: sql<number>`(
        select count(*) from ${posts} 
        where ${posts.workspaceId} = ${workspaces.id} 
        and ${posts.createdAt} >= ${since}
      )::int`,
      subscriptionAmount: sql<number>`(
        select amount_cents from ${subscriptions} 
        where ${subscriptions.workspaceId} = ${workspaces.id} 
        and ${subscriptions.status} = 'active'
        order by created_at desc limit 1
      )::int`,
    })
    .from(workspaces)
    .leftJoin(users, eq(workspaces.ownerUserId, users.id))
    .where(wsWhere)
    .orderBy(desc(workspaces.createdAt))
    .limit(200);

  // Calculate per-workspace costs
  const withCosts = rows.map((r) => {
    const costCents = 
      (r.videoRenders || 0) * AI_COSTS.video_render +
      (r.videoRemixes || 0) * AI_COSTS.video_remix +
      (r.postsGenerated || 0) * AI_COSTS.post_generate;
    const revenueCents = r.subscriptionAmount || PLAN_REVENUE[r.plan as PlanValue] || 0;
    
    return {
      ...r,
      estimatedCostUsd: Math.round(costCents / 100 * 100) / 100,
      estimatedRevenueUsd: Math.round(revenueCents / 100 * 100) / 100,
      marginPercent: revenueCents > 0 
        ? Math.round(((revenueCents - costCents) / revenueCents) * 100 * 100) / 100
        : 0,
    };
  });

  return NextResponse.json({ workspaces: withCosts });
}

async function getByFeature(since: Date, wsWhere?: any) {
  const [
    videoRenders,
    videoRemixes,
    postsGen,
  ] = await Promise.all([
    db
      .select({
        workspaceId: videos.workspaceId,
        count: count(),
        costCents: sql<number>`count(*) * ${AI_COSTS.video_render}`,
      })
      .from(videos)
      .where(and(gte(videos.createdAt, since), wsWhere ? eq(videos.workspaceId, wsWhere) : undefined))
      .groupBy(videos.workspaceId)
      .catch(() => []),
    db
      .select({
        workspaceId: videos.workspaceId,
        count: count(),
        costCents: sql<number>`count(*) * ${AI_COSTS.video_remix}`,
      })
      .from(videos)
      .where(and(eq(videos.mode, "remix"), gte(videos.createdAt, since), wsWhere ? eq(videos.workspaceId, wsWhere) : undefined))
      .groupBy(videos.workspaceId)
      .catch(() => []),
    db
      .select({
        workspaceId: posts.workspaceId,
        count: count(),
        costCents: sql<number>`count(*) * ${AI_COSTS.post_generate}`,
      })
      .from(posts)
      .where(and(gte(posts.createdAt, since), wsWhere ? eq(posts.workspaceId, wsWhere) : undefined))
      .groupBy(posts.workspaceId)
      .catch(() => []),
  ]);

  return NextResponse.json({
    videoRenders,
    videoRemixes,
    postsGenerated: postsGen,
  });
}

async function getMarginAlerts(since: Date, wsWhere?: any) {
  const rows = await db
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      plan: workspaces.plan,
      ownerEmail: users.email,
      videoRenders: sql<number>`(
        select count(*) from ${videos} 
        where ${videos.workspaceId} = ${workspaces.id} 
        and ${videos.createdAt} >= ${since}
      )::int`,
      videoRemixes: sql<number>`(
        select count(*) from ${videos} 
        where ${videos.workspaceId} = ${workspaces.id} 
        and ${videos.mode} = 'remix'
        and ${videos.createdAt} >= ${since}
      )::int`,
      postsGenerated: sql<number>`(
        select count(*) from ${posts} 
        where ${posts.workspaceId} = ${workspaces.id} 
        and ${posts.createdAt} >= ${since}
      )::int`,
      subscriptionAmount: sql<number>`(
        select amount_cents from ${subscriptions} 
        where ${subscriptions.workspaceId} = ${workspaces.id} 
        and ${subscriptions.status} = 'active'
        order by created_at desc limit 1
      )::int`,
    })
    .from(workspaces)
    .leftJoin(users, eq(workspaces.ownerUserId, users.id))
    .where(wsWhere);

  const alerts = rows
    .map((r) => {
      const costCents = 
        (r.videoRenders || 0) * AI_COSTS.video_render +
        (r.videoRemixes || 0) * AI_COSTS.video_remix +
        (r.postsGenerated || 0) * AI_COSTS.post_generate;
      const revenueCents = r.subscriptionAmount || PLAN_REVENUE[r.plan as PlanValue] || 0;
      const margin = revenueCents > 0 ? ((revenueCents - costCents) / revenueCents) * 100 : -100;
      
      return {
        workspaceId: r.workspaceId,
        workspaceName: r.workspaceName,
        plan: r.plan,
        ownerEmail: r.ownerEmail,
        costUsd: Math.round(costCents / 100 * 100) / 100,
        revenueUsd: Math.round(revenueCents / 100 * 100) / 100,
        marginPercent: Math.round(margin * 100) / 100,
        isAlert: margin < 30, // Alert if margin < 30%
      };
    })
    .filter((a) => a.isAlert)
    .sort((a, b) => a.marginPercent - b.marginPercent);

  return NextResponse.json({ alerts });
}