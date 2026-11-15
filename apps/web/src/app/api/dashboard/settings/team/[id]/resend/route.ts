/**
 * Phase 7 — Resend Invite API
 * POST /api/dashboard/settings/team/[id]/resend - re-send invitation email
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getUserRoleInWorkspace } from "@/lib/auth-utils";
import { resendInviteEmail } from "@/lib/teams/invites";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const actorRole = await getUserRoleInWorkspace(workspaceId, session.user.id);
  if (!actorRole || !["owner", "admin"].includes(actorRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await resendInviteEmail(workspaceId, id, session.user.name ?? null);
    if (!result.ok) {
      const status = result.error === "Member not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Resend invite error:", error);
    return NextResponse.json({ error: "Failed to resend invite" }, { status: 500 });
  }
}
