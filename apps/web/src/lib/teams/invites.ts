/**
 * Phase 7 — Team Invites Orchestration.
 *
 * Invite emails (via email transport), pending → active acceptance
 * (auto-activate when invited user signs up), resend, revoke.
 */

import { db } from "@/lib/db";
import { workspaceMembers, workspaces, users } from "@aa/db";
import { eq, and, sql, count } from "drizzle-orm";
import { sendEmail } from "@/lib/email/email";
import {
  validateInvite,
  canAssignRole,
  canManageMember,
  generateInviteToken,
  isValidRole,
  Role,
} from "./roles-core";

// ───────────────────────── INVITE ─────────────────────────

/**
 * Send the invitation email for an existing pending membership.
 * Called by the team POST route after inserting the membership row.
 */
export async function sendInviteEmail(input: {
  email: string;
  role: string;
  workspaceId: string;
  inviterName?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const [ws] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://affiliateautopilot.app").replace(/\/$/, "");
  const workspaceName = ws?.name || "a workspace";
  const inviter = input.inviterName || "A teammate";

  const subject = `${inviter} invited you to ${workspaceName} on Affiliate Autopilot`;
  const bodyMd = [
    `${inviter} has invited you to join **${workspaceName}** as **${input.role}**.`,
    "",
    "Sign up (or log in) with this email address to accept the invitation — it activates automatically.",
    "",
    `Role: ${input.role}`,
  ].join("\n");

  const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<h1 style="font-size:20px">${subject}</h1>
<p>${bodyMd.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>
<p><a href="${appUrl}/signup" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Accept invitation</a></p>
<p style="font-size:12px;color:#888">Invitation valid for the email address: ${input.email}</p>
</div>`;

  const result = await sendEmail({
    to: input.email,
    subject,
    html,
    text: bodyMd + `\n\nAccept: ${appUrl}/signup`,
  });

  if (!result.ok) {
    console.error("Invite email failed:", result.error);
    return { ok: false, error: result.error };
  }
  return { ok: true };
}

/**
 * Validate + create a pending membership + send invite email.
 * Shared by the team POST route (keeps route thin).
 */
export async function inviteMember(input: {
  workspaceId: string;
  email: string;
  role: string;
  actorUserId: string;
  actorRole: string | null | undefined;
  actorName?: string | null;
}): Promise<{ ok: boolean; errors?: string[]; member?: unknown; emailSent?: boolean }> {
  const validation = validateInvite({
    email: input.email,
    role: input.role,
    workspaceId: input.workspaceId,
    actorRole: input.actorRole,
  });
  if (!validation.valid) return { ok: false, errors: validation.errors };

  const email = input.email.toLowerCase();

  // Find or create user
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
  } else {
    const [newUser] = await db
      .insert(users)
      .values({ email, authProvider: "invite" })
      .returning({ id: users.id });
    userId = newUser.id;
  }

  // Already a member?
  const [existingMember] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);

  if (existingMember) {
    if (existingMember.status === "revoked") {
      // Re-invite: reactivate pending
      await db
        .update(workspaceMembers)
        .set({ role: input.role as Role, status: "pending", invitedAt: new Date() })
        .where(eq(workspaceMembers.id, existingMember.id));
    } else {
      return { ok: false, errors: ["User already a member"] };
    }
  } else {
    await db.insert(workspaceMembers).values({
      workspaceId: input.workspaceId,
      userId,
      role: input.role as Role,
      status: "pending",
    });
  }

  const invite = await sendInviteEmail({
    email,
    role: input.role,
    workspaceId: input.workspaceId,
    inviterName: input.actorName,
  });

  return { ok: true, emailSent: invite.ok };
}

// ───────────────────────── ACCEPTANCE ─────────────────────────

/**
 * Auto-activate pending memberships for a user (called at signup/first login).
 * The invited person accepts simply by signing up with the invited email.
 */
export async function activatePendingMemberships(userId: string): Promise<number> {
  const result = await db
    .update(workspaceMembers)
    .set({ status: "active" })
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.status, "pending")))
    .returning({ id: workspaceMembers.id });

  return result.length;
}

// ───────────────────────── REVOKE / RESEND ─────────────────────────

export async function revokeInvite(workspaceId: string, memberId: string): Promise<{ ok: boolean; error?: string }> {
  const [target] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1);

  if (!target) return { ok: false, error: "Member not found" };
  if (target.role === "owner") return { ok: false, error: "Cannot revoke owner" };

  await db
    .update(workspaceMembers)
    .set({ status: "revoked" })
    .where(eq(workspaceMembers.id, memberId));

  return { ok: true };
}

/** Re-send the invite email for a pending member. */
export async function resendInviteEmail(
  workspaceId: string,
  memberId: string,
  inviterName?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const [member] = await db
    .select({
      id: workspaceMembers.id,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      email: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1);

  if (!member) return { ok: false, error: "Member not found" };
  if (member.status === "active") return { ok: false, error: "Member already active" };

  const sent = await sendInviteEmail({
    email: member.email,
    role: member.role,
    workspaceId,
    inviterName,
  });

  return sent.ok ? { ok: true } : { ok: false, error: sent.error };
}

// ───────────────────────── ROLE CHANGE (validated) ─────────────────────────

export async function changeMemberRole(input: {
  workspaceId: string;
  memberId: string;
  newRole: string;
  actorUserId: string;
  actorRole: string | null | undefined;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isValidRole(input.newRole)) return { ok: false, error: "Invalid role" };
  if (!input.actorRole || !isValidRole(input.actorRole)) return { ok: false, error: "Unknown actor" };

  const [target] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.id, input.memberId), eq(workspaceMembers.workspaceId, input.workspaceId)))
    .limit(1);

  if (!target) return { ok: false, error: "Member not found" };
  if (!canManageMember(input.actorRole, target.role as Role)) {
    return { ok: false, error: "Cannot manage a member with equal or higher role" };
  }
  if (!canAssignRole(input.actorRole, input.newRole)) {
    return { ok: false, error: "Cannot assign a role at or above your own" };
  }

  await db
    .update(workspaceMembers)
    .set({ role: input.newRole })
    .where(eq(workspaceMembers.id, input.memberId));

  return { ok: true };
}

// ───────────────────────── STATS ─────────────────────────

export async function getTeamStats(workspaceId: string) {
  const rows = await db
    .select({ role: workspaceMembers.role, status: workspaceMembers.status, n: count() })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .groupBy(workspaceMembers.role, workspaceMembers.status);

  const byRole: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byRole[r.role] = (byRole[r.role] || 0) + Number(r.n);
    byStatus[r.status] = (byStatus[r.status] || 0) + Number(r.n);
    total += Number(r.n);
  }

  return { total, byRole, byStatus };
}
