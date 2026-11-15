/**
 * Phase 7 — Team Roles Core Tests
 */

import { describe, it, expect } from "vitest";
import {
  can,
  permissionsFor,
  isValidRole,
  canAssignRole,
  canManageMember,
  validateInvite,
  canTransitionMembership,
  generateInviteToken,
  ROLE_PERMISSIONS,
  ROLE_RANK,
  ROLES,
} from "./roles-core";

describe("can (permission matrix)", () => {
  it("owner has everything", () => {
    expect(can("owner", "workspace:delete")).toBe(true);
    expect(can("owner", "billing:manage")).toBe(true);
    expect(can("owner", "team:change_role")).toBe(true);
    expect(can("owner", "content:create")).toBe(true);
  });

  it("admin has team/content but not workspace:delete or billing", () => {
    expect(can("admin", "team:invite")).toBe(true);
    expect(can("admin", "team:remove")).toBe(true);
    expect(can("admin", "content:publish")).toBe(true);
    expect(can("admin", "workspace:delete")).toBe(false);
    expect(can("admin", "billing:manage")).toBe(false);
    expect(can("admin", "team:change_role")).toBe(false);
  });

  it("editor creates content but no team/admin powers", () => {
    expect(can("editor", "content:create")).toBe(true);
    expect(can("editor", "video:render")).toBe(true);
    expect(can("editor", "content:publish")).toBe(true);
    expect(can("editor", "analytics:read")).toBe(true);
    expect(can("editor", "team:invite")).toBe(false);
    expect(can("editor", "settings:edit")).toBe(false);
    expect(can("editor", "audit:read")).toBe(false);
    expect(can("editor", "content:delete")).toBe(false);
  });

  it("analyst reads analytics but cannot create content", () => {
    expect(can("analyst", "analytics:read")).toBe(true);
    expect(can("analyst", "content:read")).toBe(true);
    expect(can("analyst", "content:create")).toBe(false);
    expect(can("analyst", "dm:send")).toBe(false);
    expect(can("analyst", "video:render")).toBe(false);
  });

  it("viewer only reads", () => {
    expect(can("viewer", "content:read")).toBe(true);
    expect(can("viewer", "settings:read")).toBe(true);
    expect(can("viewer", "content:create")).toBe(false);
    expect(can("viewer", "analytics:read")).toBe(false);
    expect(can("viewer", "dm:send")).toBe(false);
  });

  it("rejects unknown/null roles", () => {
    expect(can(null, "content:read")).toBe(false);
    expect(can(undefined, "content:read")).toBe(false);
    expect(can("superuser", "content:read")).toBe(false);
    expect(can("", "content:read")).toBe(false);
  });

  it("permission sets are strictly nested by rank (viewer ⊂ analyst ⊂ editor ⊂ admin ⊂ owner)", () => {
    const viewer = new Set(ROLE_PERMISSIONS.viewer);
    const analyst = new Set(ROLE_PERMISSIONS.analyst);
    const editor = new Set(ROLE_PERMISSIONS.editor);
    const admin = new Set(ROLE_PERMISSIONS.admin);
    const owner = new Set(ROLE_PERMISSIONS.owner);

    for (const p of viewer) expect(analyst.has(p)).toBe(true);
    for (const p of analyst) expect(editor.has(p)).toBe(true);
    for (const p of editor) expect(admin.has(p)).toBe(true);
    for (const p of admin) expect(owner.has(p)).toBe(true);
  });
});

describe("permissionsFor", () => {
  it("returns a copy of the permission list", () => {
    const perms = permissionsFor("editor");
    expect(Array.isArray(perms)).toBe(true);
    expect(perms).toContain("video:render");
    perms.push("workspace:delete"); // mutating result must not affect matrix
    expect(can("editor", "workspace:delete")).toBe(false);
  });
});

describe("isValidRole", () => {
  it("accepts all valid roles", () => {
    for (const r of ROLES) expect(isValidRole(r)).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isValidRole("root")).toBe(false);
    expect(isValidRole("Owner")).toBe(false);
    expect(isValidRole(null)).toBe(false);
    expect(isValidRole(123)).toBe(false);
  });
});

describe("canAssignRole", () => {
  it("owner can assign any role", () => {
    for (const r of ROLES) expect(canAssignRole("owner", r)).toBe(true);
  });

  it("admin can assign admin and below (not owner)", () => {
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "editor")).toBe(true);
    expect(canAssignRole("admin", "owner")).toBe(false);
  });

  it("editor cannot assign roles", () => {
    expect(canAssignRole("editor", "viewer")).toBe(false);
  });
});

describe("canManageMember", () => {
  it("owner manages everyone except other owners", () => {
    expect(canManageMember("owner", "admin")).toBe(true);
    expect(canManageMember("owner", "viewer")).toBe(true);
    expect(canManageMember("owner", "owner")).toBe(false);
  });

  it("admin manages below only", () => {
    expect(canManageMember("admin", "editor")).toBe(true);
    expect(canManageMember("admin", "admin")).toBe(false);
    expect(canManageMember("admin", "owner")).toBe(false);
  });

  it("editor manages nobody", () => {
    expect(canManageMember("editor", "viewer")).toBe(false);
  });
});

describe("validateInvite", () => {
  const base = { email: "a@b.com", role: "editor", workspaceId: "ws1", actorRole: "admin" };

  it("accepts a valid invite", () => {
    const r = validateInvite(base);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("rejects invalid email", () => {
    expect(validateInvite({ ...base, email: "not-an-email" }).valid).toBe(false);
    expect(validateInvite({ ...base, email: "" }).valid).toBe(false);
  });

  it("rejects invalid role", () => {
    expect(validateInvite({ ...base, role: "root" }).valid).toBe(false);
  });

  it("rejects owner invite (transfer ownership instead)", () => {
    const r = validateInvite({ ...base, actorRole: "owner", role: "owner" });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain("Owner");
  });

  it("rejects privilege escalation (admin assigning owner)", () => {
    const r = validateInvite({ ...base, role: "owner", actorRole: "admin" });
    expect(r.valid).toBe(false);
  });

  it("rejects editor inviting anyone", () => {
    const r = validateInvite({ ...base, actorRole: "editor", role: "viewer" });
    expect(r.valid).toBe(false);
  });

  it("requires workspace", () => {
    expect(validateInvite({ ...base, workspaceId: "" }).valid).toBe(false);
  });
});

describe("canTransitionMembership", () => {
  it("pending → active / revoked allowed", () => {
    expect(canTransitionMembership("pending", "active")).toBe(true);
    expect(canTransitionMembership("pending", "revoked")).toBe(true);
  });

  it("active → revoked allowed, active → pending blocked", () => {
    expect(canTransitionMembership("active", "revoked")).toBe(true);
    expect(canTransitionMembership("active", "pending")).toBe(false);
  });

  it("revoked → pending (re-invite) allowed", () => {
    expect(canTransitionMembership("revoked", "pending")).toBe(true);
    expect(canTransitionMembership("revoked", "active")).toBe(false);
  });
});

describe("generateInviteToken", () => {
  it("generates 32-char hex", () => {
    expect(generateInviteToken()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("unique across calls", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateInviteToken()));
    expect(tokens.size).toBe(50);
  });
});

describe("ROLE_RANK", () => {
  it("orders roles correctly", () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.editor);
    expect(ROLE_RANK.editor).toBeGreaterThan(ROLE_RANK.analyst);
    expect(ROLE_RANK.analyst).toBeGreaterThan(ROLE_RANK.viewer);
  });
});
