// Phase 5 Module C — Thinking Engine cron (daily self-reflection).
// Writes one journal entry per character per day (idempotent).
// Triggered by Vercel Cron: "0 5 * * *" (after the 04:00 scheduler).
import { db } from "@/lib/db";
import { characters } from "@aa/db";
import { NextResponse } from "next/server";
import { runDailyReflection } from "@/lib/character/thinking";

const CRON_SECRET = process.env.THINKING_CRON_SECRET?.trim();

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
      { error: "THINKING_CRON_SECRET not configured" },
      { status: 503 },
    );
  }

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

export async function GET() {
  return NextResponse.json({ ok: true, service: "thinking-cron" });
}
