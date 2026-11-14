/**
 * GET/POST /api/dashboard/dm-blocklist — manage blocklist.
 */
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dmBlocklist } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const list = await db
      .select()
      .from(dmBlocklist)
      .where(eq(dmBlocklist.workspaceId, session.user.workspaceId))
      .orderBy(dmBlocklist.createdAt);
    return NextResponse.json({ blocklist: list });
  } catch (e) {
    console.error("List blocklist error:", e);
    return NextResponse.json({ error: "Failed to load blocklist" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const handle = typeof body.handle === "string" ? body.handle.trim() : "";
  const platform = typeof body.platform === "string" ? body.platform : null;
  const reason = typeof body.reason === "string" ? body.reason : null;

  if (!handle) {
    return NextResponse.json({ error: "Handle is required" }, { status: 400 });
  }

  try {
    const [row] = await db
      .insert(dmBlocklist)
      .values({
        workspaceId: session.user.workspaceId,
        handle: handle.startsWith("@") ? handle.slice(1) : handle,
        platform,
        reason,
      })
      .onConflictDoNothing()
      .returning();

    return NextResponse.json({ blocklist: row ?? null }, { status: 201 });
  } catch (e) {
    console.error("Add to blocklist error:", e);
    return NextResponse.json({ error: "Failed to add" }, { status: 500 });
  }
}