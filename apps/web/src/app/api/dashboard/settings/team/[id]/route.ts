import { auth } from "@/auth";
import { db } from "@/lib/db";
import { workspaceMembers } from "@aa/db";
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
    const requester = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, session.user.id)))
      .limit(1);

    if (!requester.length || requester[0].role !== "owner") {
      return NextResponse.json({ error: "Only owner can change roles" }, { status: 403 });
    }

    const body = await req.json();
    const { role } = body;

    if (!["owner", "admin", "editor", "analyst", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const target = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.id, id), eq(workspaceMembers.workspaceId, workspaceId)))
      .limit(1);

    if (!target.length) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (target[0].role === "owner" && role !== "owner") {
      return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 });
    }

    await db
      .update(workspaceMembers)
      .set({ role: role as "owner" | "admin" | "editor" | "analyst" | "viewer" })
      .where(eq(workspaceMembers.id, id));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Update member role error:", e);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
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
    const requester = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, session.user.id)))
      .limit(1);

    if (!requester.length || !["owner", "admin"].includes(requester[0].role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const target = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.id, id), eq(workspaceMembers.workspaceId, workspaceId)))
      .limit(1);

    if (!target.length) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (target[0].role === "owner") {
      return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
    }

    if (target[0].userId === session.user.id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    await db.delete(workspaceMembers).where(eq(workspaceMembers.id, id));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Remove member error:", e);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}