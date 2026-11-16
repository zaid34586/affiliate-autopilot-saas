// Phase 5 Module A — DM Triggers cron (runs every 2 min).
// Processes incoming comments/DMs, matches keyword triggers, sends auto-replies.
// Triggered by Vercel Cron: "*/2 * * * *"
import { db } from "@/lib/db";
import { autopilotConfig, dmTriggers } from "@aa/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { pollYouTubeComments } from "@/lib/webhooks/youtube-comments";

const CRON_SECRET = process.env.DM_TRIGGERS_CRON_SECRET?.trim();

export const maxDuration = 30;

export async function POST(req: Request) {
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (CRON_SECRET) {
    if (provided !== CRON_SECRET) {
      return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DM_TRIGGERS_CRON_SECRET not configured" }, { status: 503 });
  }

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

export async function GET() {
  return NextResponse.json({ ok: true, service: "dm-triggers-cron" });
}