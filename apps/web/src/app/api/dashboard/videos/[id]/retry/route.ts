import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkRenderQuota, consumeTopupCredit } from "@/lib/video/credits";
import { requeueVideo } from "@/lib/video/queue";
import { videos } from "@aa/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { runRenderLoop } from "@/lib/video/worker";

/**
 * POST /api/dashboard/videos/[id]/retry — manual re-render of a failed video.
 * Quota is re-checked (a failed render refunded its top-up credit, so the
 * retry must pass the same quota gate as a fresh enqueue).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;
  const { id } = await params;

  try {
    const rows = await db
      .select({ id: videos.id, provider: videos.provider, renderStatus: videos.renderStatus })
      .from(videos)
      .where(and(eq(videos.id, id), eq(videos.workspaceId, workspaceId)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    if (rows[0].renderStatus !== "failed") {
      return NextResponse.json(
        { error: "Only failed videos can be retried." },
        { status: 400 }
      );
    }

    const provider = rows[0].provider === "byok" ? "byok" : "platform_pool";
    const check = await checkRenderQuota(workspaceId, provider);
    if (!check.decision.allowed) {
      return NextResponse.json(
        { error: check.decision.message, reason: check.decision.reason, upsell: check.decision.upsell },
        { status: 403 }
      );
    }

    if (check.chargeCredit && !(await consumeTopupCredit(workspaceId, id))) {
      return NextResponse.json(
        {
          error: "Video credits ran out. Buy the 10-video top-up pack ($19) or upgrade your plan.",
          reason: "monthly_quota_exceeded",
        },
        { status: 403 }
      );
    }

    const ok = await requeueVideo(id, workspaceId);
    if (!ok) {
      return NextResponse.json({ error: "Video is not in a retryable state." }, { status: 409 });
    }

    after(async () => {
      try {
        await runRenderLoop({ maxJobs: 10, concurrency: 10 });
      } catch (e) {
        console.error("Render loop error (retry):", e);
      }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Retry video error:", e);
    return NextResponse.json({ error: "Failed to retry video" }, { status: 500 });
  }
}
