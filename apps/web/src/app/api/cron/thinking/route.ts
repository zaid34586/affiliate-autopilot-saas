// Phase 5 Module C — Thinking Engine cron (daily self-reflection).
// Writes one journal entry per character per day (idempotent).
// Vercel Cron sends GET; POST works too — both are authorized via CRON_SECRET
// and run the same job (see src/lib/cron-auth.ts).
import { db } from "@/lib/db";
import { characters } from "@aa/db";
import { NextResponse } from "next/server";
import { runDailyReflection } from "@/lib/character/thinking";
import { cronGuard } from "@/lib/cron-auth";

export const maxDuration = 60;

export async function GET(req: Request) {
  return runThinkingCron(req);
}

export async function POST(req: Request) {
  return runThinkingCron(req);
}

async function runThinkingCron(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

  try {
    const all = await db
      .select({ workspaceId: characters.workspaceId })
      .from(characters);

    let reflected = 0;
    let failed = 0;

    for (const row of all) {
      try {
        await runDailyReflection(row.workspaceId);
        reflected += 1;
      } catch (e) {
        // A single workspace failing (e.g. missing config) must not
        // stop the rest — count and continue.
        failed += 1;
        console.error(`Thinking reflection failed for ${row.workspaceId}:`, e);
      }
    }

    return NextResponse.json({ ok: true, reflected, failed });
  } catch (e) {
    console.error("Thinking cron error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Thinking cron failed" },
      { status: 500 },
    );
  }
}
