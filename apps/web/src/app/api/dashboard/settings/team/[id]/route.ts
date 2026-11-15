import { auth } from "@/auth";
import { db } from "@/lib/db";
import { workspaceMembers } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getUserRoleInWorkspace } from "@/lib/auth-utils";
import { changeMemberRole, revokeInvite } from "@/lib/teams/invites";

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
    const actorRole = await getUserRoleInWorkspace(workspaceId, session.user.id);
    if (!actorRole) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    const body = await req.json();
    const { role } = body;

    const result = await changeMemberRole({
      workspaceId,
      memberId: id,
      newRole: role,
      actorUserId: session.user.id,
      actorRole,
    });

    if (!result.ok) {
      const status = result.error === "Member not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

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
    const actorRole = await getUserRoleInWorkspace(workspaceId, session.user.id);
    if (!actorRole || !["owner", "admin"].includes(actorRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const [target] = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.id, id), eq(workspaceMembers.workspaceId, workspaceId)))
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (target.role === "owner") {
      return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
    }

    if (target.userId === session.user.id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    // Admins cannot remove other admins (only owner can)
    if (actorRole === "admin" && target.role === "admin") {
      return NextResponse.json({ error: "Only the owner can remove an admin" }, { status: 403 });
    }

    // Pending invite → revoke; active member → remove entirely
    if (target.status === "pending") {
      const rev = await revokeInvite(workspaceId, id);
      if (!rev.ok) return NextResponse.json({ error: rev.error }, { status: 400 });
    } else {
      await db.delete(workspaceMembers).where(eq(workspaceMembers.id, id));
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Remove member error:", e);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}