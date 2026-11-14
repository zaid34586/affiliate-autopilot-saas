/**
 * Phase 7 — Public Changelog API
 * GET /api/public/changelog - Get published changelog entries
 */

import { NextResponse } from "next/server";
import { getPublishedChangelog } from "@/lib/help/changelog";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const entries = await getPublishedChangelog(limit);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Public changelog error:", error);
    return NextResponse.json({ error: "Failed to fetch changelog" }, { status: 500 });
  }
}