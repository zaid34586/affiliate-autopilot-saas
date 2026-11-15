/**
 * Phase 7 — Knowledge Base API
 * POST /api/dashboard/knowledge/search - search chunks { query, limit? }
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/knowledge/knowledge";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { query?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const hits = await searchKnowledge(
      session.user.workspaceId,
      body.query,
      Math.min(20, Math.max(1, body.limit ?? 6)),
    );
    return NextResponse.json({ hits });
  } catch (error) {
    console.error("Knowledge search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
