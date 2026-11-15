/**
 * Phase 7 — Status Check Cron
 * POST /api/cron/status-check
 *
 * Probes all integration endpoints, updates health, auto-opens/resolves incidents.
 */

import { NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/status/status";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }

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
