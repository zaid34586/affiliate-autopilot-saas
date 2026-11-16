/**
 * Phase 7 — Status Check Cron
 *
 * Probes all integration endpoints, updates health, auto-opens/resolves incidents.
 * GET (Vercel Cron default) and POST both run the checks; both are authorized
 * with the shared CRON_SECRET (see src/lib/cron-auth.ts).
 */

import { NextResponse } from "next/server";
import { cronGuard } from "@/lib/cron-auth";
import { runHealthChecks } from "@/lib/status/status";

export async function GET(req: Request) {
  return runStatusCheckCron(req);
}

export async function POST(req: Request) {
  return runStatusCheckCron(req);
}

async function runStatusCheckCron(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

  try {
    const results = await runHealthChecks();
    const failing = results.filter((r) => !r.ok).map((r) => r.provider);

    return NextResponse.json({
      success: true,
      checked: results.length,
      failing,
    });
  } catch (error) {
    console.error("Status check cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 },
    );
  }
}
