/**
 * Phase 4 — Admin API: user status.
 * PATCH /api/admin/users/[id]
 *   { action: "suspend" | "reactivate" | "revoke-sessions" }
 *
 * suspend         → users.status = 'suspended' + bump token_version
 *                   (every live session is revoked immediately)
 * reactivate      → users.status = 'active'
 * revoke-sessions → bump token_version only (sign out everywhere)
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { users } from "@aa/db";
import { eq, sql } from "drizzle-orm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action;
  if (action !== "suspend" && action !== "reactivate" && action !== "revoke-sessions") {
    return NextResponse.json(
      { error: "Unknown action — use suspend | reactivate | revoke-sessions" },
      { status: 400 },
    );
  }

  try {
    const set =
      action === "suspend"
        ? { status: "suspended", tokenVersion: sql`${users.tokenVersion} + 1` }
        : action === "reactivate"
          ? { status: "active" }
          : { tokenVersion: sql`${users.tokenVersion} + 1` };

    const [updated] = await db
      .update(users)
      .set(set)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        status: users.status,
        tokenVersion: users.tokenVersion,
      });

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (err) {
    console.error("Admin user PATCH error:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
