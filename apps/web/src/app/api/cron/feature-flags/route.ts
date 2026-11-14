/**
 * Phase 7 — Feature Flags Cron
 * POST /api/cron/feature-flags
 * Initializes default feature flags (runs on deploy)
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { initializeDefaultFlags } from "@/lib/feature-flags/feature-flags";

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Also allow in development
  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }

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