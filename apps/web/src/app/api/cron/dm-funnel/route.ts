// Phase 5 Module D — DM Funnel cron (runs every 2 min).
// Processes incoming comments/DMs, matches triggers, starts/runs funnels.
// Triggered by Vercel Cron: "*/2 * * * *"
import { db } from "@/lib/db";
import { autopilotConfig, characters } from "@aa/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  loadFunnels,
  loadTriggersWithFunnels,
  loadActiveConversations,
  loadBlocklist,
  loadDailyCaps,
  countFunnelSentToday,
  countWorkspaceSentToday,
  getOrCreateConversation,
  executeFunnelStep,
  findMatchingFunnel,
  checkAntiSpam,
  type ConversationState,
} from "@/lib/dm/funnel";

const CRON_SECRET = process.env.DM_TRIGGERS_CRON_SECRET?.trim();

export const maxDuration = 60;

export async function POST(req: Request) {
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (CRON_SECRET) {
    if (provided !== CRON_SECRET) {
      return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "DM_TRIGGERS_CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  try {
    const activeConfigs = await db
      .select({ workspaceId: autopilotConfig.workspaceId })
      .from(autopilotConfig)
      .where(eq(autopilotConfig.paused, false));

    let totalFunnelsStarted = 0;
    let totalStepsSent = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const cfg of activeConfigs) {
      const workspaceId = cfg.workspaceId;

      try {
        // Load all data for this workspace
        const [funnels, triggers, conversations, blocklist, dailyCaps] =
          await Promise.all([
            loadFunnels(workspaceId),
            loadTriggersWithFunnels(workspaceId),
            loadActiveConversations(workspaceId),
            loadBlocklist(workspaceId),
            loadDailyCaps(workspaceId),
          ]);

        if (funnels.length === 0 && triggers.length === 0) continue;

        const funnelsById = new Map(funnels.map((f) => [f.id, f]));
        const triggersWithFunnels = triggers.filter((t) => t.funnelId);

        // 1. Process active conversations — send next steps if due
        for (const conv of conversations) {
          const funnel = funnelsById.get(conv.funnelId);
          if (!funnel) continue;

          // Check anti-spam for continuing conversation
          const funnelSent = await countFunnelSentToday(workspaceId, conv.funnelId);
          const workspaceSent = await countWorkspaceSentToday(workspaceId);
          const triggerForFunnel = triggersWithFunnels.find((t) => t.funnelId === conv.funnelId);
          const funnelDailyCap = triggerForFunnel?.dailyCap ?? 100;

          const spamCheck = checkAntiSpam({
            workspaceId,
            platform: conv.platform,
            recipientHandle: conv.recipientHandle,
            funnelId: conv.funnelId,
            dailyCaps,
            blocklist,
            existingConversation: conv,
            funnelDailyCap,
            funnelSentToday: funnelSent,
            globalSentToday: workspaceSent,
          });

          if (!spamCheck.allowed) {
            totalSkipped++;
            // Could pause the conversation here
            continue;
          }

          // Execute next step
          const result = await executeFunnelStep(
            workspaceId,
            funnel,
            conv,
            conv.context.triggerKeyword as string ?? "funnel",
            (triggerForFunnel?.mode ?? "semi") as "manual" | "semi" | "auto",
          );

          if ("dmId" in result) {
            totalStepsSent++;
            await incrementDailyCap(workspaceId, conv.platform);
          } else if (result.error !== "No more steps" && result.error !== "Funnel completed (condition skip)") {
            errors.push(`${conv.conversationId}: ${result.error}`);
          }
        }

        // 2. Check for NEW trigger matches (simulated — real impl would call platform APIs)
        // This is a stub: in production, you'd fetch new comments/DMs from each platform
        // and run findMatchingFunnel on each. For now, we just note the capability.

        // Example of how it would work (commented out):
        /*
        for (const trigger of triggersWithFunnels) {
          // For each platform connection, fetch new comments since last check
          // For each comment, run findMatchingFunnel(comment.text, [trigger])
          // If matched, call getOrCreateConversation + executeFunnelStep
        }
        */

        totalFunnelsStarted += funnels.length; // placeholder
      } catch (e) {
        errors.push(`${workspaceId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      funnelsStarted: totalFunnelsStarted,
      stepsSent: totalStepsSent,
      skipped: totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("DM funnel cron error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "DM funnel cron failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "dm-funnel-cron" });
}

async function incrementDailyCap(workspaceId: string, platform: string) {
  const today = new Date().toISOString().split("T")[0];
  const { db } = await import("@/lib/db");
  const { dmDailyCaps } = await import("@aa/db");
  const { eq, and } = await import("drizzle-orm");

  const [existing] = await db
    .select()
    .from(dmDailyCaps)
    .where(
      and(
        eq(dmDailyCaps.workspaceId, workspaceId),
        eq(dmDailyCaps.platform, platform),
        eq(dmDailyCaps.day, today),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(dmDailyCaps)
      .set({ sentCount: existing.sentCount + 1, updatedAt: new Date() })
      .where(eq(dmDailyCaps.id, existing.id));
  } else {
    await db.insert(dmDailyCaps).values({
      workspaceId,
      platform,
      day: today,
      sentCount: 1,
      limit: 50,
    });
  }
}