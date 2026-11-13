// Phase 5 Module A — Publish cron (runs every 30 min during active hours).
// Finds scheduled posts ready to publish, respects daily caps & quiet hours.
// Triggered by Vercel Cron: "*/30 * * * *"
import { db } from "@/lib/db";
import { autopilotConfig, posts, connections, videos } from "@aa/db";
import { and, eq, isNull, lt, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { publishVideoPost } from "@/lib/publisher";
import { isQuietHours, checkDailyPostCap } from "@/lib/scheduler/jobs";

const CRON_SECRET = process.env.PUBLISH_CRON_SECRET?.trim();

export const maxDuration = 60; // publish can be quick

export async function POST(req: Request) {
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (CRON_SECRET) {
    if (provided !== CRON_SECRET) {
      return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "PUBLISH_CRON_SECRET not configured" }, { status: 503 });
  }

  try {
    const now = new Date();
    const activeConfigs = await db
      .select({
        workspaceId: autopilotConfig.workspaceId,
        dailyPostLimits: autopilotConfig.dailyPostLimits,
        activePlatforms: autopilotConfig.activePlatforms,
        quietHours: autopilotConfig.quietHours,
        paused: autopilotConfig.paused,
      })
      .from(autopilotConfig)
      .where(eq(autopilotConfig.paused, false));

    let totalPublished = 0;
    let totalSkipped = 0;

    for (const cfg of activeConfigs) {
      // Skip if in quiet hours
      if (isQuietHours(cfg.quietHours as { from: string; to: string }, now)) {
        totalSkipped++;
        continue;
      }

      // Find scheduled posts for active platforms
      const platformArray = (cfg.activePlatforms as string[]) ?? [];
      if (platformArray.length === 0) continue;

      const dailyLimits = (cfg.dailyPostLimits as Record<string, number>) ?? {};

      for (const platform of platformArray) {
        const limit = dailyLimits[platform] ?? 5;
        const capCheck = await checkDailyPostCap(cfg.workspaceId, platform, limit, now);
        if (!capCheck.allowed) continue;

        // Find next scheduled post for this platform
        const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const duePosts = await db
          .select({
            id: posts.id,
            videoId: posts.videoId,
            platform: posts.platform,
          })
          .from(posts)
          .where(
            and(
              eq(posts.workspaceId, cfg.workspaceId),
              eq(posts.platform, platform),
              eq(posts.status, "scheduled"),
              // Only publish if scheduledAt <= now (or null = ASAP)
              sql`(${posts.scheduledAt} IS NULL OR ${posts.scheduledAt} <= ${now})`
            )
          )
          .orderBy(posts.scheduledAt)
          .limit(capCheck.allowed ? limit - capCheck.used : 0);

        for (const post of duePosts) {
          if (!post.videoId) continue;

          // Verify video is rendered
          const [video] = await db
            .select({ renderStatus: videos.renderStatus, storageKey: videos.storageKey })
            .from(videos)
            .where(eq(videos.id, post.videoId))
            .limit(1);

          if (!video || video.renderStatus !== "done" || !video.storageKey) {
            // Video not ready — skip for now
            continue;
          }

          // Check connection exists
          const [conn] = await db
            .select({ id: connections.id })
            .from(connections)
            .where(
              and(
                eq(connections.workspaceId, cfg.workspaceId),
                eq(connections.provider, platform),
                eq(connections.status, "active")
              )
            )
            .limit(1);

          if (!conn) {
            // No connection — mark post as failed
            await db
              .update(posts)
              .set({
                status: "failed",
                error: `No active ${platform} connection`,
                updatedAt: new Date(),
              })
              .where(eq(posts.id, post.id));
            continue;
          }

          // Publish!
          try {
            const result = await publishVideoPost({
              workspaceId: cfg.workspaceId,
              videoId: post.videoId,
              platform: platform as "instagram" | "youtube",
              mode: "auto",
            });

            if (result.status === "published") {
              totalPublished++;
            } else {
              totalSkipped++;
            }
          } catch (e) {
            console.error(`Publish failed for post ${post.id}:`, e);
            totalSkipped++;
          }
        }
      }
    }

    return NextResponse.json({ ok: true, published: totalPublished, skipped: totalSkipped });
  } catch (e) {
    console.error("Publish cron error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Publish cron failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "publish-cron" });
}