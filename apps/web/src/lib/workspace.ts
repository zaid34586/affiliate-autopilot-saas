import "server-only";
import { eq, and, sql } from "drizzle-orm";
import { autopilotConfig, workspaceMembers, workspaces, characters, brandProfiles } from "@aa/db";
import { db } from "./db";

export type Workspace = typeof workspaces.$inferSelect;

/**
 * User ka workspace lao — na mile toh turant bana do
 * (automatic after both signup and OAuth).
 *
 * Order:
 * 1. Owned workspace (personal default)
 * 2. Active team membership (invited-only users land in the team workspace)
 * 3. Create one (advisory-locked to avoid duplicate rows on concurrent calls)
 */
export async function getOrCreateWorkspace(userId: string): Promise<Workspace> {
  const existing = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userId))
    .limit(1);

  if (existing[0]) return existing[0];

  // Invited-only user: no owned workspace, but an active membership.
  const [memberRow] = await db
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.status, "active")))
    .orderBy(workspaceMembers.invitedAt)
    .limit(1);

  if (memberRow) return memberRow.workspace;

  return createWorkspace(userId, "My Workspace");
}

export async function createWorkspace(userId: string, name: string): Promise<Workspace> {
  // Serialize concurrent first-time creations for the same user:
  // without the lock, two parallel requests both passed the SELECT and
  // inserted two workspaces (no unique index on owner_user_id in prod).
  return await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const [again] = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerUserId, userId))
      .limit(1);
    if (again) return again;

    const [ws] = await tx
      .insert(workspaces)
      .values({ name, ownerUserId: userId })
      .returning();

    if (!ws) throw new Error("workspace create nahi hua");

    // owner membership + autopilot default config ek saath
    await tx.insert(workspaceMembers).values({
      workspaceId: ws.id,
      userId,
      role: "owner",
      status: "active",
    });

    await tx.insert(autopilotConfig).values({
      workspaceId: ws.id,
      level: "manual",
    });

    return ws;
  });
}

/**
 * After onboarding: create the brand profile + character
 * (the character's name = the primary social handle).
 */
export async function setupWorkspaceIdentity(
  workspaceId: string,
  input: {
    niche: string;
    audience?: string;
    tone?: string;
    handle: string;
  },
) {
  await db
    .insert(brandProfiles)
    .values({
      workspaceId,
      niche: input.niche,
      audienceDesc: input.audience ?? null,
      tone: input.tone ?? "friendly",
    })
    .onConflictDoNothing();

  await db
    .insert(characters)
    .values({
      workspaceId,
      name: input.handle,
      aliases: [],
      bio: `${input.handle} — AI affiliate persona (${input.niche})`,
    })
    .onConflictDoNothing();
}
