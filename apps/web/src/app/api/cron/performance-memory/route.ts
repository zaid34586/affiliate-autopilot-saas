/**
 * Phase 6 — Performance Memory Cron
 * POST /api/cron/performance-memory
 * Syncs recent post/video performance to vector embeddings for semantic search
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@aa/db";
import { syncPostPerformanceToMemory, syncVideoPerformanceToMemory } from "@/lib/analytics/performance-memory";

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
      const postsSynced = await syncPostPerformanceToMemory(workspaceId, 30);
      const videosSynced = await syncVideoPerformanceToMemory(workspaceId, 30);

      results.push({
        workspaceId,
        postsSynced,
        videosSynced,
        total: postsSynced + videosSynced,
      });
    }

    const totalPosts = results.reduce((sum, r) => sum + r.postsSynced, 0);
    const totalVideos = results.reduce((sum, r) => sum + r.videosSynced, 0);

    return NextResponse.json({
      success: true,
      workspacesProcessed: results.length,
      totalPostsSynced: totalPosts,
      totalVideosSynced: totalVideos,
      totalSynced: totalPosts + totalVideos,
      results,
    });
  } catch (error) {
    console.error("Performance memory cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 },
    );
  }
}