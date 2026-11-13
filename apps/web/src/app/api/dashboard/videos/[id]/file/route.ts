import { auth } from "@/auth";
import { db } from "@/lib/db";
import { videos } from "@aa/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { absolutePath } from "@/lib/video/storage";

/**
 * GET /api/dashboard/videos/[id]/file?type=final|thumb
 * Streams the rendered reel or thumbnail (storage key comes from the DB row —
 * never from user input). R2-backed URLs swap in behind this route later.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;
  const { id } = await params;

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") === "thumb" ? "thumb" : "final";

    const rows = await db
      .select({ storageKey: videos.storageKey, thumbnailKey: videos.thumbnailKey, status: videos.renderStatus })
      .from(videos)
      .where(and(eq(videos.id, id), eq(videos.workspaceId, workspaceId)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const relKey = type === "thumb" ? rows[0].thumbnailKey : rows[0].storageKey;
    if (!relKey) {
      return NextResponse.json(
        { error: `No ${type === "thumb" ? "thumbnail" : "video"} available yet (status: ${rows[0].status}).` },
        { status: 404 }
      );
    }

    const abs = absolutePath(relKey);
    const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": type === "thumb" ? "image/jpeg" : "video/mp4",
        "Cache-Control": "private, max-age=3600",
        ...(type === "final" ? { "Accept-Ranges": "none" } : {}),
      },
    });
  } catch (e) {
    console.error("Stream video file error:", e);
    return NextResponse.json({ error: "Failed to stream file" }, { status: 500 });
  }
}
