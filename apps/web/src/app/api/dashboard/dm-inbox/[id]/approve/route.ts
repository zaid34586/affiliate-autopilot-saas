import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dmMessages } from "@aa/db";
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

    if (dm.status !== "draft" && dm.status !== "queued") {
      return NextResponse.json({ error: "DM cannot be approved in current status" }, { status: 400 });
    }

    // If mode is auto, send immediately; if semi, just mark as approved
    if (dm.approvalMode === "auto") {
      // TODO: Send DM immediately
      await db
        .update(dmMessages)
        .set({
          status: "sent",
          sentAt: new Date(),
        })
        .where(eq(dmMessages.id, id));
    } else {
      await db
        .update(dmMessages)
        .set({
          status: "approved",
        })
        .where(eq(dmMessages.id, id));
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Approve DM error:", e);
    return NextResponse.json({ error: "Failed to approve DM" }, { status: 500 });
  }
}