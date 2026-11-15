/**
 * Phase 7 — Public Status Page API
 * GET /api/public/status - overall status, integration health, incidents
 */

import { NextResponse } from "next/server";
import { getStatusPage } from "@/lib/status/status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getStatusPage();
    return NextResponse.json(status, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
    });
  } catch (error) {
    console.error("Status page error:", error);
    return NextResponse.json({ error: "Failed to load status" }, { status: 500 });
  }
}
