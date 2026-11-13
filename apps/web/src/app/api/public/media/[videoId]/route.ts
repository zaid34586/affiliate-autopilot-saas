import { db } from "@/lib/db";
import { videos } from "@aa/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { verifyMediaSignature } from "@/lib/publisher/media-url";
import { absolutePath } from "@/lib/video/storage";

/**
 * GET /api/public/media/[videoId]?exp=&sig= — signed, unauthenticated file
 * access for Instagram's Content Publish API (Meta downloads the video from
 * this URL). Signature + expiry are verified with HMAC; no session required,
 * no path traversal (id comes from the DB row). R2 public URLs replace this
 * when storage moves off local FS.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;
  const url = new URL(req.url);
  const exp = url.searchParams.get("exp");
  const sig = url.searchParams.get("sig");

  if (!verifyMediaSignature(videoId, exp, sig)) {
    return NextResponse.json({ error: "Invalid or expired signature" }, { status: 403 });
  }

  try {
    const rows = await db
      .select({ storageKey: videos.storageKey, status: videos.renderStatus })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    const relKey = rows[0]?.storageKey;
    if (!relKey || rows[0]?.status !== "done") {
      return NextResponse.json({ error: "Video not available" }, { status: 404 });
    }

    const stream = Readable.toWeb(createReadStream(absolutePath(relKey))) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "none",
      },
    });
  } catch (e) {
    console.error("Public media stream error:", e);
    return NextResponse.json({ error: "Failed to stream file" }, { status: 500 });
  }
}
