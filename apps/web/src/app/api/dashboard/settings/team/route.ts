import { auth } from "@/auth";
import { db } from "@/lib/db";
import { workspaceMembers, users } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getUserRoleInWorkspace } from "@/lib/auth-utils";
import { inviteMember, getTeamStats } from "@/lib/teams/invites";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId;

  try {
    const members = await db
      .select({
        id: workspaceMembers.id,
        email: users.email,
        name: users.name,
        role: workspaceMembers.role,
        invitedAt: workspaceMembers.invitedAt,
        status: workspaceMembers.status,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name,
        role: m.role,
        invitedAt: m.invitedAt?.toISOString(),
        status: m.status,
      })),
      stats: await getTeamStats(workspaceId),
    });
  } catch (e) {
    console.error("Fetch team members error:", e);
    return NextResponse.json({ error: "Failed to fetch team members" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId;

  try {
    const body = await req.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role required" }, { status: 400 });
    }

    const actorRole = await getUserRoleInWorkspace(workspaceId, session.user.id);
    if (!actorRole || !["owner", "admin"].includes(actorRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const result = await inviteMember({
      workspaceId,
      email,
      role,
      actorUserId: session.user.id,
      actorRole,
      actorName: session.user.name ?? null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.errors?.join(", ") || "Invite failed" }, { status: 400 });
    }

    return NextResponse.json({ success: true, emailSent: result.emailSent });
  } catch (e) {
    console.error("Invite member error:", e);
    return NextResponse.json({ error: "Failed to invite member" }, { status: 500 });
  }
}