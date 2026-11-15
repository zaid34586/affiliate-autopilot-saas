/**
 * Phase 7 — Team Roles Core (pure logic).
 *
 * Permission matrix for workspace roles + invite rules.
 * Roles: owner > admin > editor > analyst > viewer
 */

// ───────────────────────── ROLES ─────────────────────────

export type Role = "owner" | "admin" | "editor" | "analyst" | "viewer";

export const ROLES: Role[] = ["owner", "admin", "editor", "analyst", "viewer"];

/** Higher number = more authority. */
export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  analyst: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

// ───────────────────────── PERMISSIONS ─────────────────────────

export type Permission =
  // content
  | "content:read"
  | "content:create"
  | "content:edit"
  | "content:delete"
  | "content:publish"
  // videos
  | "video:render"
  | "video:delete"
  // dm engine
  | "dm:send"
  | "dm:config"
  // analytics
  | "analytics:read"
  // settings
  | "settings:read"
  | "settings:edit"
  | "billing:manage"
  | "brand:edit"
  // team
  | "team:invite"
  | "team:remove"
  | "team:change_role"
  // admin surfaces
  | "audit:read"
  | "feature_flags:manage"
  | "help:manage"
  | "incidents:manage"
  | "referrals:settings"
  | "emails:manage"
  // dangerous
  | "workspace:delete";

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
    "content:read", "content:create", "content:edit", "content:delete", "content:publish",
    "video:render", "video:delete",
    "dm:send", "dm:config",
    "analytics:read",
    "settings:read", "settings:edit", "billing:manage", "brand:edit",
    "team:invite", "team:remove", "team:change_role",
    "audit:read", "feature_flags:manage", "help:manage", "incidents:manage",
    "referrals:settings", "emails:manage",
    "workspace:delete",
  ],
  admin: [
    "content:read", "content:create", "content:edit", "content:delete", "content:publish",
    "video:render", "video:delete",
    "dm:send", "dm:config",
    "analytics:read",
    "settings:read", "settings:edit", "brand:edit",
    "team:invite", "team:remove",
    "audit:read", "feature_flags:manage", "help:manage", "incidents:manage",
    "referrals:settings", "emails:manage",
  ],
  editor: [
    "content:read", "content:create", "content:edit", "content:publish",
    "video:render",
    "dm:send",
    "analytics:read",
    "settings:read",
  ],
  analyst: [
    "content:read",
    "analytics:read",
    "settings:read",
  ],
  viewer: ["content:read", "settings:read"],
};

/** Does a role have a permission? */
export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role || !(role in ROLE_PERMISSIONS)) return false;
  return ROLE_PERMISSIONS[role as Role].includes(permission);
}

/** List all permissions for a role (for UI). */
export function permissionsFor(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

// ───────────────────────── ROLE CHANGES ─────────────────────────

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

/**
 * Can `actorRole` assign `targetRole` to someone?
 * Only owner and admin can assign, and only strictly below their own rank
 * (owner can assign any role; admin cannot assign owner or admin).
 */
export function canAssignRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return ROLE_RANK[targetRole] < ROLE_RANK[actorRole];
  return false; // editor / analyst / viewer cannot assign roles
}

/**
 * Can `actorRole` manage (change role / remove) `targetRole`?
 * Only owner and admin, and only strictly below their own rank.
 */
export function canManageMember(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "owner") return targetRole !== "owner"; // only one owner
  if (actorRole === "admin") return ROLE_RANK[targetRole] < ROLE_RANK[actorRole];
  return false;
}

// ───────────────────────── INVITES ─────────────────────────

export interface InviteInput {
  email: string;
  role: string;
  workspaceId: string;
  actorRole: string | null | undefined;
}

export interface InviteValidation {
  valid: boolean;
  errors: string[];
}

/** Validate an invite before creating it. */
export function validateInvite(input: InviteInput): InviteValidation {
  const errors: string[] = [];

  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push("Valid email required");
  }
  if (!isValidRole(input.role)) {
    errors.push("Invalid role");
  } else if (!input.actorRole || !isValidRole(input.actorRole)) {
    errors.push("Unknown actor role");
  } else if (input.role === "owner") {
    errors.push("Owner role cannot be invited (transfer ownership instead)");
  } else if (!canAssignRole(input.actorRole as Role, input.role as Role)) {
    errors.push(`Role ${input.actorRole} cannot assign role ${input.role}`);
  }
  if (!input.workspaceId) errors.push("Workspace required");

  return { valid: errors.length === 0, errors };
}

/** Status transitions for membership. */
export function canTransitionMembership(from: string, to: string): boolean {
  const allowed: Record<string, string[]> = {
    pending: ["active", "revoked"],
    active: ["revoked"],
    revoked: ["pending"], // re-invite
  };
  return (allowed[from] || []).includes(to);
}

/** Generate a token for invite links (random hex, 32 chars). */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
