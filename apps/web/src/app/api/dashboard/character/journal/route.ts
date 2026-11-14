/**
 * GET  /api/dashboard/character/journal — recent journal entries (newest first).
 * POST /api/dashboard/character/journal — run/refresh today's reflection
 *      (idempotent per day: created=true if new, false if updated).
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { listThoughts, runDailyReflection } from "@/lib/character/thinking";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const entries = await listThoughts(session.user.workspaceId);
    return NextResponse.json({ entries });
  } catch (e) {
    console.error("List journal error:", e);
    return NextResponse.json(
      { error: "Failed to load journal" },
      { status: 500 },
    );
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const entry = await runDailyReflection(session.user.workspaceId);
    return NextResponse.json({ entry }, { status: entry.created ? 201 : 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to reflect";
    const status = msg.includes("character") ? 404 : 500;
    if (status === 500) console.error("Run reflection error:", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
