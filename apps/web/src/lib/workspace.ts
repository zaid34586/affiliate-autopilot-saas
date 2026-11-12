import "server-only";
import { eq } from "drizzle-orm";
import { autopilotConfig, workspaceMembers, workspaces, characters, brandProfiles } from "@aa/db";
import { db } from "./db";

export type Workspace = typeof workspaces.$inferSelect;

/**
 * User ka workspace lao — na mile toh turant bana do
 * (signup + OAuth dono ke baad automatic).
 */
export async function getOrCreateWorkspace(userId: string): Promise<Workspace> {
  const existing = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userId))
    .limit(1);

  if (existing[0]) return existing[0];

  return createWorkspace(userId, "My Workspace");
}

export async function createWorkspace(userId: string, name: string): Promise<Workspace> {
  const [ws] = await db
    .insert(workspaces)
    .values({ name, ownerUserId: userId })
    .returning();

  if (!ws) throw new Error("workspace create nahi hua");

  // owner membership + autopilot default config ek saath
  await db.insert(workspaceMembers).values({
    workspaceId: ws.id,
    userId,
    role: "owner",
  });

  await db.insert(autopilotConfig).values({
    workspaceId: ws.id,
    level: "manual",
  });

  return ws;
}

/**
 * Onboarding ke baad: brand profile + character create
 * (character ka naam = primary social handle).
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
