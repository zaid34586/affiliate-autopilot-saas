// Phase 5 Module A — Publish cron.
// Finds scheduled posts ready to publish, respects daily caps & quiet hours.
// Vercel Cron sends GET; POST works too — both are authorized via CRON_SECRET
// and run the same job (see src/lib/cron-auth.ts).
import { db } from "@/lib/db";
import { autopilotConfig, posts, connections, videos } from "@aa/db";
import { and, eq, isNull, lt, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { publishVideoPost } from "@/lib/publisher";
import { isQuietHours, checkDailyPostCap } from "@/lib/scheduler/jobs";
import { cronGuard } from "@/lib/cron-auth";

export const maxDuration = 60; // publish can be quick

export async function GET(req: Request) {
  return runPublishCron(req);
}

export async function POST(req: Request) {
  return runPublishCron(req);
}

async function runPublishCron(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

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

          // Atomic claim: scheduled -> publishing. The guarded update returns
          // a row ONLY if this run won the race, so concurrent cron runs can
          // never double-publish the same post.
          const claimed = await db
            .update(posts)
            .set({ status: "publishing", updatedAt: new Date() })
            .where(and(eq(posts.id, post.id), eq(posts.status, "scheduled")))
            .returning({ id: posts.id });
          if (claimed.length === 0) continue; // claimed by another run

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
            // Pre-publish failures (e.g. transient connection errors) are
            // thrown, not recorded — release the claim so a later run retries.
            console.error(`Publish failed for post ${post.id}:`, e);
            await db
              .update(posts)
              .set({ status: "scheduled", updatedAt: new Date() })
              .where(and(eq(posts.id, post.id), eq(posts.status, "publishing")));
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