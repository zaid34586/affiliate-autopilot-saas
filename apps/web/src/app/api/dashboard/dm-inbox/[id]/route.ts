import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dmMessages } from "@aa/db";
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
    const { body: newBody, status } = body;

    const updateData: Record<string, unknown> = {};
    if (newBody !== undefined) updateData.body = newBody;
    if (status !== undefined) updateData.status = status;

    await db
      .update(dmMessages)
      .set(updateData)
      .where(and(eq(dmMessages.id, id), eq(dmMessages.workspaceId, session.user.workspaceId)));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Update DM error:", e);
    return NextResponse.json({ error: "Failed to update DM" }, { status: 500 });
  }
}