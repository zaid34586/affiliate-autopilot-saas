/**
 * Phase 6 — Video Remix API
 * POST /api/dashboard/videos/[id]/remix - Create remix of winning video for new product
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { createVideoRemixJob, canRemixVideo } from "@/lib/video/video-remix";
import { RemixInput } from "@/lib/video/video-remix-core";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { id } = await params;

  let body: { newProductId: string; adaptations?: RemixInput["adaptations"] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { newProductId, adaptations } = body;

  if (!newProductId) {
    return NextResponse.json({ error: "newProductId required" }, { status: 400 });
  }

  // Check if video can be remixed
  const check = await canRemixVideo(workspaceId, id);
  if (!check.canRemix) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  try {
    const result = await createVideoRemixJob({
      workspaceId,
      sourceVideoId: id,
      newProductId,
      adaptations,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      videoId: result.newVideoId,
      contentId: result.newContentId,
      message: `Remix job created for ${result.plan?.newProductTitle}`,
      plan: result.plan,
    });
  } catch (error) {
    console.error("Video remix error:", error);
    return NextResponse.json({ error: "Failed to create remix job" }, { status: 500 });
  }
}