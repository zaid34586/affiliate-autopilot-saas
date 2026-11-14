/**
 * Phase 6 — Video Remix Cron
 * POST /api/cron/video-remix
 * Auto-creates remixes from optimizer decisions and high-performing videos
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, videos, optimizerDecisions, products, postPerformance, contents } from "@aa/db";
import { eq, and, desc, sql, gte, sum } from "drizzle-orm";
import { createVideoRemixJob, canRemixVideo } from "@/lib/video/video-remix";

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Also allow in development
  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }

  try {
    // Get all workspaces
    const allWorkspaces = await db.select({ id: workspaces.id }).from(workspaces);
    
    const results = [];

    for (const { id: workspaceId } of allWorkspaces) {
      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      try {
        // 1. Process optimizer "remix" decisions
        const remixDecisions = await db
          .select()
          .from(optimizerDecisions)
          .where(and(
            eq(optimizerDecisions.workspaceId, workspaceId),
            eq(optimizerDecisions.decisionType, "remix"),
            eq(optimizerDecisions.executed, false)
          ))
          .limit(5);

        for (const decision of remixDecisions) {
          try {
            const check = await canRemixVideo(workspaceId, decision.targetId);
            if (!check.canRemix) {
              skipped++;
              continue;
            }

            // Find a high-scoring product different from the original
            const [originalPost] = await db
              .select({ videoId: videos.id, productId: contents.productId })
              .from(videos)
              .leftJoin(contents, eq(contents.id, videos.contentId))
              .where(eq(videos.id, decision.targetId))
              .limit(1);

            if (!originalPost?.videoId) {
              skipped++;
              continue;
            }

            // Get a different high-scoring product
            const [newProduct] = await db
              .select({ id: products.id })
              .from(products)
              .where(and(
                eq(products.workspaceId, workspaceId),
                eq(products.status, "active"),
                originalPost.productId ? sql`${products.id} != ${originalPost.productId}` : sql`1=1`
              ))
              .orderBy(desc(products.aiScore))
              .limit(1);

            if (!newProduct) {
              skipped++;
              continue;
            }

            const result = await createVideoRemixJob({
              workspaceId,
              sourceVideoId: originalPost.videoId,
              newProductId: newProduct.id,
            });

            if (result.success) {
              created++;
              // Mark optimizer decision as executed
              await db
                .update(optimizerDecisions)
                .set({
                  executed: true,
                  executedAt: new Date(),
                  result: { remixVideoId: result.newVideoId, remixContentId: result.newContentId },
                })
                .where(eq(optimizerDecisions.id, decision.id));
            } else {
              errors.push(`Remix failed for decision ${decision.id}: ${result.error}`);
            }
          } catch (e) {
            errors.push(`Decision ${decision.id}: ${e instanceof Error ? e.message : "Unknown error"}`);
          }
        }

        // 2. Auto-remix top performing videos (if no optimizer decisions)
        if (created === 0) {
          const topVideos = await db
            .select({
              videoId: videos.id,
              format: videos.mode,
              revenue: sum(postPerformance.revenue),
            })
            .from(videos)
            .leftJoin(postPerformance, eq(postPerformance.videoId, videos.id))
            .where(and(
              eq(videos.workspaceId, workspaceId),
              eq(videos.renderStatus, "done"),
              gte(videos.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
            ))
            .groupBy(videos.id, videos.mode)
            .orderBy(desc(sum(postPerformance.revenue)))
            .limit(3);

          for (const { videoId } of topVideos) {
            if (created >= 2) break; // Limit to 2 auto-remixes per workspace per run

            const check = await canRemixVideo(workspaceId, videoId);
            if (!check.canRemix) continue;

            // Find a different high-scoring product
            const [originalVideo] = await db
              .select({ contentId: videos.contentId, productId: contents.productId })
              .from(videos)
              .leftJoin(contents, eq(contents.id, videos.contentId))
              .where(eq(videos.id, videoId))
              .limit(1);

            if (!originalVideo?.productId) continue;

            const [newProduct] = await db
              .select({ id: products.id })
              .from(products)
              .where(and(
                eq(products.workspaceId, workspaceId),
                eq(products.status, "active"),
                sql`${products.id} != ${originalVideo.productId}`
              ))
              .orderBy(desc(products.aiScore))
              .limit(1);

            if (!newProduct) continue;

            const result = await createVideoRemixJob({
              workspaceId,
              sourceVideoId: videoId,
              newProductId: newProduct.id,
              adaptations: { hookStyle: "benefit-focused", ctaStyle: "direct" }, // Auto-adapt for remix
            });

            if (result.success) {
              created++;
            }
          }
        }

        results.push({
          workspaceId,
          created,
          skipped,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (e) {
        results.push({
          workspaceId,
          created: 0,
          skipped: 0,
          errors: [e instanceof Error ? e.message : "Workspace error"],
        });
      }
    }

    const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

    return NextResponse.json({
      success: true,
      workspacesProcessed: results.length,
      totalRemixesCreated: totalCreated,
      totalSkipped,
      results,
    });
  } catch (error) {
    console.error("Video remix cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 },
    );
  }
}