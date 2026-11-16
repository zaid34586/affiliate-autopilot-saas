/**
 * Phase 7 — Feature Flags Cron
 * Initializes default feature flags (runs on deploy/daily).
 * GET (Vercel Cron default) and POST both run the job; both are authorized
 * with the shared CRON_SECRET (see src/lib/cron-auth.ts).
 */

import { NextResponse } from "next/server";
import { cronGuard } from "@/lib/cron-auth";
import { initializeDefaultFlags } from "@/lib/feature-flags/feature-flags";

export async function GET(req: Request) {
  return runFeatureFlagsCron(req);
}

export async function POST(req: Request) {
  return runFeatureFlagsCron(req);
}

async function runFeatureFlagsCron(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

  try {
    await initializeDefaultFlags();
    return NextResponse.json({ success: true, message: "Default feature flags initialized" });
  } catch (error) {
    console.error("Feature flags init error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Initialization failed" },
      { status: 500 },
    );
  }
}