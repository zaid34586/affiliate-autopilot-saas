/**
 * Phase 8 — Admin API: Jobs & Queue Monitoring
 * GET /api/admin/jobs - Queue stats, stuck jobs, worker health
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { videos, posts, optimizerDecisions, autopilotConfig } from "@aa/db";
import { eq, and, desc, asc, sql, count, gte, lte } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "overview"; // overview|stuck|workers

  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  if (type === "stuck") {
    const stuckVideos = await db
      .select({
        id: videos.id,
        workspaceId: videos.workspaceId,
        status: videos.renderStatus,
        mode: videos.mode,
        createdAt: videos.createdAt,
        error: videos.failureReason,
      })
      .from(videos)
      .where(and(eq(videos.renderStatus, "rendering"), lte(videos.finishedAt, fiveMinsAgo)))
      .orderBy(asc(videos.finishedAt))
      .limit(50);

    const stuckPosts = await db
      .select({
        id: posts.id,
        workspaceId: posts.workspaceId,
        status: posts.status,
        platform: posts.platform,
        createdAt: posts.createdAt,
        error: posts.error,
      })
      .from(posts)
      .where(and(eq(posts.status, "publishing"), lte(posts.updatedAt, fiveMinsAgo)))
      .orderBy(asc(posts.updatedAt))
      .limit(50);

    return NextResponse.json({ stuckVideos, stuckPosts });
  }

  // Overview
  const [
    videoQueue,
    postQueue,
    optimizerQueue,
    autopilotStatus,
    recentErrors,
  ] = await Promise.all([
    // Video queue by status
    db
      .select({
        status: videos.renderStatus,
        count: count(),
      })
      .from(videos)
      .groupBy(videos.renderStatus),
    
    // Post queue by status
    db
      .select({
        status: posts.status,
        count: count(),
      })
      .from(posts)
      .groupBy(posts.status),
    
    // Optimizer decisions pending
    db
      .select({
        count: count(),
      })
      .from(optimizerDecisions)
      .where(eq(optimizerDecisions.executed, false)),
    
    // Autopilot configs
    db
      .select({
        level: autopilotConfig.level,
        paused: autopilotConfig.paused,
        count: count(),
      })
      .from(autopilotConfig)
      .groupBy(autopilotConfig.level, autopilotConfig.paused),
    
    // Recent errors (last hour)
    db
      .select({
        id: videos.id,
        mode: videos.mode,
        error: videos.failureReason,
        createdAt: videos.createdAt,
      })
      .from(videos)
      .where(and(gte(videos.createdAt, hourAgo), sql`${videos.failureReason} IS NOT NULL`))
      .orderBy(desc(videos.createdAt))
      .limit(20),
  ]);

  return NextResponse.json({
    videoQueue: videoQueue.reduce((acc, v) => ({ ...acc, [v.status]: v.count }), {}),
    postQueue: postQueue.reduce((acc, v) => ({ ...acc, [v.status]: v.count }), {}),
    pendingOptimizerDecisions: optimizerQueue[0]?.count || 0,
    autopilotConfigs: autopilotStatus,
    recentErrors,
    timestamp: new Date().toISOString(),
  });
}