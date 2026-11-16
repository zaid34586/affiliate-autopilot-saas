// Phase 5 Module A — DM Triggers cron.
// Processes incoming comments/DMs, matches keyword triggers, sends auto-replies,
// and polls YouTube comments (Google never pushes them).
// Vercel Cron sends GET; POST works too — both are authorized via CRON_SECRET
// and run the same job (see src/lib/cron-auth.ts).
import { db } from "@/lib/db";
import { autopilotConfig, dmTriggers } from "@aa/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { pollYouTubeComments } from "@/lib/webhooks/youtube-comments";
import { cronGuard } from "@/lib/cron-auth";

export const maxDuration = 30;

export async function GET(req: Request) {
  return runDmTriggers(req);
}

export async function POST(req: Request) {
  return runDmTriggers(req);
}

async function runDmTriggers(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

  try {
    const activeConfigs = await db
      .select({
        workspaceId: autopilotConfig.workspaceId,
      })
      .from(autopilotConfig)
      .where(eq(autopilotConfig.paused, false));

    let totalProcessed = 0;

    for (const cfg of activeConfigs) {
      // Get active keyword triggers for this workspace
      const triggers = await db
        .select()
        .from(dmTriggers)
        .where(
          and(
            eq(dmTriggers.workspaceId, cfg.workspaceId),
            eq(dmTriggers.enabled, true)
          )
        );

      if (triggers.length === 0) continue;

      // Character lookup happens in the reply senders (webhook-db /
      // youtube-comments); this cron only counts pending trigger work.
      totalProcessed += triggers.length;
    }

    // YouTube comments are never pushed by Google — poll them here instead
    // (see src/lib/webhooks/youtube-comments.ts). Idempotent, safe to re-run.
    let youtubePoll = null;
    try {
      youtubePoll = await pollYouTubeComments();
      totalProcessed += youtubePoll.comments;
    } catch (e) {
      console.error("YouTube comment poll failed:", e);
    }

    return NextResponse.json({ ok: true, processed: totalProcessed, youtubePoll });
  } catch (e) {
    console.error("DM triggers cron error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "DM triggers cron failed" },
      { status: 500 }
    );
  }
}