/**
 * Phase 7 — Email Lifecycle Cron
 *
 * Daily: run welcome/activation/trial-ending/winback pipeline.
 * Honors send window (9 AM – 8 PM) and per-template cooldowns.
 * GET (Vercel Cron default) and POST both run the pipeline; both are
 * authorized with the shared CRON_SECRET (see src/lib/cron-auth.ts).
 */

import { NextResponse } from "next/server";
import { runEmailLifecycle } from "@/lib/email/email";
import { inSendWindow, DEFAULT_SEND_WINDOW } from "@/lib/email/email-core";
import { cronGuard } from "@/lib/cron-auth";

export async function GET(req: Request) {
  return runEmailLifecycleCron(req);
}

export async function POST(req: Request) {
  return runEmailLifecycleCron(req);
}

async function runEmailLifecycleCron(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

  try {
    const now = new Date();

    // Send window guard: hold sends outside 9 AM – 8 PM server-local
    if (!inSendWindow(now, DEFAULT_SEND_WINDOW)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "outside send window",
      });
    }

    const outcomes = await runEmailLifecycle();

    const summary = {
      sent: outcomes.filter((o) => o.status === "sent").length,
      failed: outcomes.filter((o) => o.status === "failed").length,
      skipped: outcomes.filter((o) => o.status === "skipped").length,
      unsubscribed: outcomes.filter((o) => o.status === "unsubscribed").length,
      byTemplate: {} as Record<string, number>,
    };
    for (const o of outcomes) {
      if (o.template && o.status === "sent") {
        summary.byTemplate[o.template] = (summary.byTemplate[o.template] || 0) + 1;
      }
    }

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("Email lifecycle cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 },
    );
  }
}
