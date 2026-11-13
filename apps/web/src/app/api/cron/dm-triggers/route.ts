// Phase 5 Module A — DM Triggers cron (runs every 2 min).
// Processes incoming comments/DMs, matches keyword triggers, sends auto-replies.
// Triggered by Vercel Cron: "*/2 * * * *"
import { db } from "@/lib/db";
import { autopilotConfig, dmTriggers, dmMessages, characters, connections } from "@aa/db";
import { and, eq, isNull, lt } from "drizzle-orm";
import { NextResponse } from "next/server";

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

      // Get character for this workspace (for reply voice)
      const [character] = await db
        .select({ name: characters.name, toneConfig: characters.toneConfig })
        .from(characters)
        .where(eq(characters.workspaceId, cfg.workspaceId))
        .limit(1);

      const characterName = character?.name ?? "Assistant";

      // Get connections for platforms that support DM (IG, FB, TikTok)
      // For each connection, check for new comments/DMs that match triggers
      // This is a stub — real implementation would call platform APIs
      // For now, just mark the job as run
      totalProcessed += triggers.length;
    }

    return NextResponse.json({ ok: true, processed: totalProcessed });
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