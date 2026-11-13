import { auth } from "@/auth";
import { db } from "@/lib/db";
import { QuotaExceededError, enqueueVideoRender } from "@/lib/video/enqueue";
import { VIDEO_MODES, type VideoMode } from "@/lib/video/scripts";
import { runRenderLoop } from "@/lib/video/worker";
import { videos } from "@aa/db";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { after } from "next/server";

/**
 * GET  /api/dashboard/videos — render queue list (newest first).
 * POST /api/dashboard/videos — enqueue a render: { productId, mode }.
 *   Quota + circuit breaker enforced; after() kicks the worker so local/demo
 *   renders start immediately (cron endpoint covers external workers).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const rows = await db
      .select({
        id: videos.id,
        title: videos.title,
        mode: videos.mode,
        provider: videos.provider,
        renderStatus: videos.renderStatus,
        progressPct: videos.progressPct,
        failureReason: videos.failureReason,
        retryCount: videos.retryCount,
        durationSec: videos.durationSec,
        costUsd: videos.costUsd,
        createdAt: videos.createdAt,
        startedAt: videos.startedAt,
        finishedAt: videos.finishedAt,
        hasFile: videos.storageKey,
        hasThumb: videos.thumbnailKey,
      })
      .from(videos)
      .where(eq(videos.workspaceId, workspaceId))
      .orderBy(desc(videos.createdAt))
      .limit(50);

    return NextResponse.json({
      videos: rows.map((v) => ({
        ...v,
        hasFile: Boolean(v.hasFile),
        hasThumb: Boolean(v.hasThumb),
      })),
    });
  } catch (e) {
    console.error("List videos error:", e);
    return NextResponse.json({ error: "Failed to list videos" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const body = await req.json();
    const mode = body?.mode as VideoMode;
    const productId = body?.productId as string | undefined;

    if (!VIDEO_MODES.includes(mode)) {
      return NextResponse.json(
        { error: "Invalid mode. Supported modes: showcase, listicle." },
        { status: 400 }
      );
    }
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const result = await enqueueVideoRender({ workspaceId, productId, mode });

    // Start rendering right after the response (fits within route maxDuration).
    after(async () => {
      try {
        await runRenderLoop({ maxJobs: 10, concurrency: 10 });
      } catch (e) {
        console.error("Render loop error:", e);
      }
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: e.message,
          reason: e.decision.reason,
          upsell: e.decision.upsell,
        },
        { status: 403 }
      );
    }
    console.error("Enqueue video error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to enqueue video" },
      { status: 500 }
    );
  }
}
