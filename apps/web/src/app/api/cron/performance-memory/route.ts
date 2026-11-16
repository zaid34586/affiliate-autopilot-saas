/**
 * Phase 6 — Performance Memory Cron
 * Syncs recent post/video performance to vector embeddings for semantic search.
 * GET (Vercel Cron default) and POST both run the job; both are authorized
 * with the shared CRON_SECRET (see src/lib/cron-auth.ts).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@aa/db";
import { syncPostPerformanceToMemory, syncVideoPerformanceToMemory } from "@/lib/analytics/performance-memory";
import { cronGuard } from "@/lib/cron-auth";

export async function GET(req: Request) {
  return runPerformanceMemoryCron(req);
}

export async function POST(req: Request) {
  return runPerformanceMemoryCron(req);
}

async function runPerformanceMemoryCron(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

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