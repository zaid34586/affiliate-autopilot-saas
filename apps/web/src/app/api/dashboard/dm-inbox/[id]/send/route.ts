import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dmMessages, connections } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId;
  const { id } = await params;

  try {
    const msg = await db
      .select()
      .from(dmMessages)
      .where(and(eq(dmMessages.id, id), eq(dmMessages.workspaceId, workspaceId)))
      .limit(1);

    if (!msg.length) {
      return NextResponse.json({ error: "DM not found" }, { status: 404 });
    }

    const dm = msg[0];

    if (dm.status !== "approved" && dm.status !== "queued" && dm.status !== "draft") {
      return NextResponse.json({ error: "DM cannot be sent in current status" }, { status: 400 });
    }

    // Get connection for platform
    const conn = await db
      .select()
      .from(connections)
      .where(and(eq(connections.workspaceId, workspaceId), eq(connections.provider, dm.platform)))
      .limit(1);

    if (!conn.length || conn[0].status !== "active") {
      return NextResponse.json({ error: "No active connection for platform" }, { status: 400 });
    }

    // TODO: Implement actual DM sending per platform
    // This is a placeholder - real implementation would use platform APIs
    // For now, simulate sending

    await db
      .update(dmMessages)
      .set({
        status: "sent",
        sentAt: new Date(),
      })
      .where(eq(dmMessages.id, id));

    // Log audit
    // await db.insert(jobsAudit).values({ ... });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Send DM error:", e);
    return NextResponse.json({ error: "Failed to send DM" }, { status: 500 });
  }
}