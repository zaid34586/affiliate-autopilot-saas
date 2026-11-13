import { auth } from "@/auth";
import { db } from "@/lib/db";
import { videos } from "@aa/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/** GET /api/dashboard/videos/[id] — render status for progress polling. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;
  const { id } = await params;

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
        renderLog: videos.renderLog,
        createdAt: videos.createdAt,
        startedAt: videos.startedAt,
        finishedAt: videos.finishedAt,
        hasFile: videos.storageKey,
        hasThumb: videos.thumbnailKey,
      })
      .from(videos)
      .where(and(eq(videos.id, id), eq(videos.workspaceId, workspaceId)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    const v = rows[0];
    return NextResponse.json({
      video: { ...v, hasFile: Boolean(v.hasFile), hasThumb: Boolean(v.hasThumb) },
    });
  } catch (e) {
    console.error("Get video error:", e);
    return NextResponse.json({ error: "Failed to fetch video" }, { status: 500 });
  }
}
