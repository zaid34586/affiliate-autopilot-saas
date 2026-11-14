/**
 * DELETE /api/dashboard/dm-blocklist/[id] — remove from blocklist.
 */
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dmBlocklist } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    await db
      .delete(dmBlocklist)
      .where(and(eq(dmBlocklist.id, id), eq(dmBlocklist.workspaceId, session.user.workspaceId)));
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Remove from blocklist error:", e);
    return NextResponse.json({ error: "Failed to remove" }, { status: 500 });
  }
}