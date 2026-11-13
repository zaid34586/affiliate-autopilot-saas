import { auth } from "@/auth";
import { db } from "@/lib/db";
import { videos } from "@aa/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isPublishPlatform } from "@/lib/publisher/types";
import { publishVideoPost } from "@/lib/publisher";

/**
 * POST /api/dashboard/videos/[id]/post — manually publish a finished render.
 * Body: { platform: "instagram" | "youtube" }.
 * Enforces that the video is done, then runs the publish flow and records
 * the attempt on `posts` (mode = "manual").
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;
  const { id: videoId } = await params;

  try {
    const body = await req.json();
    const platform = body?.platform as string | undefined;

    if (!platform || !isPublishPlatform(platform)) {
      return NextResponse.json(
        { error: "platform is required (instagram | youtube)." },
        { status: 400 }
      );
    }

    // Verify the video belongs to this workspace and is finished.
    const videoRows = await db
      .select({ id: videos.id, renderStatus: videos.renderStatus, storageKey: videos.storageKey })
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.workspaceId, workspaceId)))
      .limit(1);

    const video = videoRows[0];
    if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    if (video.renderStatus !== "done" || !video.storageKey) {
      return NextResponse.json(
        { error: "This video has not finished rendering yet." },
        { status: 409 }
      );
    }

    // Run the publish; result always stored on posts (mode = manual).
    const result = await publishVideoPost({
      workspaceId,
      videoId,
      platform,
      mode: "manual",
    });

    const statusCode = result.status === "published" ? 200 : 409;
    return NextResponse.json(
      {
        success: result.status === "published",
        postId: result.postId,
        status: result.status,
        sandbox: result.sandbox,
        permalink: result.permalink,
        error: result.error,
      },
      { status: statusCode }
    );
  } catch (e) {
    if (e instanceof Error && e.name === "PublishNotAvailableError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error("Manual post error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to publish" },
      { status: 500 }
    );
  }
}