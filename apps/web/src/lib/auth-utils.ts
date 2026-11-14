/**
 * Phase 7 — Auth Utilities.
 * 
 * Helper functions for authentication and authorization.
 */

import { db } from "@/lib/db";
import { workspaceMembers } from "@aa/db";
import { eq, and } from "drizzle-orm";

/**
 * Get user's role in a workspace
 */
export async function getUserRoleInWorkspace(
  workspaceId: string,
  userId: string,
): Promise<"owner" | "admin" | "editor" | "analyst" | "viewer" | null> {
  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);

  return member?.role as "owner" | "admin" | "editor" | "analyst" | "viewer" | null;
}

/**
 * Check if user has required role in workspace
 */
export async function requireRole(
  workspaceId: string,
  userId: string,
  allowedRoles: Array<"owner" | "admin" | "editor" | "analyst" | "viewer">,
): Promise<boolean> {
  const role = await getUserRoleInWorkspace(workspaceId, userId);
  return role !== null && allowedRoles.includes(role);
}

/**
 * Middleware helper to check admin access
 */
export async function requireAdminAccess(workspaceId: string, userId: string): Promise<boolean> {
  return requireRole(workspaceId, userId, ["owner", "admin"]);
}

/**
 * Middleware helper to check owner access
 */
export async function requireOwnerAccess(workspaceId: string, userId: string): Promise<boolean> {
  return requireRole(workspaceId, userId, ["owner"]);
}