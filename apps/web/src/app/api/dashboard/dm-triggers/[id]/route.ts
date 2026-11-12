import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dmTriggers } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PATCH(
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
    const body = await req.json();
    const { keywords, replyTemplate, mode, cooldownHours, dailyCap, enabled } = body;

    const updateData: Record<string, unknown> = {};
    if (keywords) updateData.keywords = keywords;
    if (replyTemplate) updateData.replyTemplate = replyTemplate;
    if (mode) updateData.mode = mode;
    if (cooldownHours) updateData.cooldownHours = cooldownHours;
    if (dailyCap) updateData.dailyCap = dailyCap;
    if (typeof enabled === "boolean") updateData.enabled = enabled;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await db
      .update(dmTriggers)
      .set(updateData)
      .where(and(eq(dmTriggers.id, id), eq(dmTriggers.workspaceId, workspaceId)));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Update DM trigger error:", e);
    return NextResponse.json({ error: "Failed to update trigger" }, { status: 500 });
  }
}

export async function DELETE(
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
    await db
      .delete(dmTriggers)
      .where(and(eq(dmTriggers.id, id), eq(dmTriggers.workspaceId, workspaceId)));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete DM trigger error:", e);
    return NextResponse.json({ error: "Failed to delete trigger" }, { status: 500 });
  }
}