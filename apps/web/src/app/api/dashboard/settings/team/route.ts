import { auth } from "@/auth";
import { db } from "@/lib/db";
import { workspaceMembers, users } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

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

    // Check if user is owner/admin
    const requester = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, session.user.id)))
      .limit(1);

    if (!requester.length || !["owner", "admin"].includes(requester[0].role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Find or create user
    const targetUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    let userId: string;
    if (!targetUser.length) {
      const [newUser] = await db
        .insert(users)
        .values({ email: email.toLowerCase(), authProvider: "invite" })
        .returning({ id: users.id });
      userId = newUser.id;
    } else {
      userId = targetUser[0].id;
    }

    // Check if already a member
    const existing = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);

    if (existing.length) {
      return NextResponse.json({ error: "User already a member" }, { status: 400 });
    }

    await db.insert(workspaceMembers).values({
      workspaceId,
      userId,
      role: role as "owner" | "admin" | "editor" | "analyst" | "viewer",
      status: "pending",
    });

    // TODO: Send invitation email

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Invite member error:", e);
    return NextResponse.json({ error: "Failed to invite member" }, { status: 500 });
  }
}