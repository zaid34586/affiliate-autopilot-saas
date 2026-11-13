import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  PLAN_DAILY_RENDER_CAP,
  PLAN_DAILY_SPEND_CAP_USD,
  PLAN_VIDEO_QUOTA_MONTHLY,
  TOPUP_PACK,
} from "@/lib/video/constants";
import { getRenderUsage } from "@/lib/video/credits";
import { resolveProviderChoice } from "@/lib/video/providers";
import { workspaces, videos } from "@aa/db";
import { and, count, eq, sum } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/dashboard/videos/budget — cost & quota dashboard data:
 * plan limits, usage vs caps, circuit-breaker state, cost per finished
 * reel, credits balance, and provider mode (mock / byok / platform pool).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const [ws] = await db
      .select({ plan: workspaces.plan, creditsBalance: workspaces.creditsBalance })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const usage = await getRenderUsage(workspaceId);
    const choice = await resolveProviderChoice(workspaceId);

    // Cost stats for finished (done) reels — real recorded cost_usd values.
    const [doneRow] = await db
      .select({
        doneCount: count(),
        totalCost: sum(videos.costUsd),
        totalDurationSec: sum(videos.durationSec),
      })
      .from(videos)
      .where(and(eq(videos.workspaceId, workspaceId), eq(videos.renderStatus, "done")));

    const doneCount = Number(doneRow?.doneCount ?? 0);
    const totalCostUsd = Number(doneRow?.totalCost ?? 0);
    const avgCostUsd = doneCount > 0 ? totalCostUsd / doneCount : null;

    const monthlyLimit = PLAN_VIDEO_QUOTA_MONTHLY[ws.plan];
    const dailyRenderCap = PLAN_DAILY_RENDER_CAP[ws.plan];
    const dailySpendCap = PLAN_DAILY_SPEND_CAP_USD[ws.plan];

    // Circuit breaker: tripped only when platform-pool renders hit the $ cap.
    const breakerTripped = usage.platformSpendTodayUsd >= dailySpendCap;

    return NextResponse.json({
      plan: ws.plan,
      providerMode: choice.mode, // "mock" | "byok" | "platform_pool"
      monthly: {
        used: usage.usedThisMonth,
        limit: monthlyLimit,
        remaining: Math.max(0, monthlyLimit - usage.usedThisMonth),
      },
      today: {
        renders: usage.rendersToday,
        renderCap: dailyRenderCap,
        spendUsd: Number(usage.platformSpendTodayUsd.toFixed(4)),
        spendCapUsd: dailySpendCap,
        breakerTripped,
      },
      creditsBalance: ws.creditsBalance,
      cost: {
        doneCount,
        totalUsd: Number(totalCostUsd.toFixed(4)),
        avgUsd: avgCostUsd !== null ? Number(avgCostUsd.toFixed(4)) : null,
      },
      topupPack: TOPUP_PACK,
    });
  } catch (e) {
    console.error("Video budget error:", e);
    return NextResponse.json({ error: "Failed to load budget" }, { status: 500 });
  }
}
