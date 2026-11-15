/**
 * Phase 8 — Admin Auth Utilities.
 * 
 * Platform-level admin checks (separate from workspace roles).
 */

import { auth } from "@/auth";

/** Comma-separated list of platform admin emails from env */
function getPlatformAdminEmails(): string[] {
  const raw = process.env.PLATFORM_ADMIN_EMAILS || "";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/** Check if current session user is a platform admin */
export async function isPlatformAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.email) return false;
  const admins = getPlatformAdminEmails();
  return admins.includes(session.user.email.toLowerCase());
}

/** Middleware helper - throws if not platform admin */
export async function requirePlatformAdmin(): Promise<void> {
  const admin = await isPlatformAdmin();
  if (!admin) {
    throw new Error("Platform admin access required");
  }
}

/** Get current platform admin status (for UI) */
export async function getPlatformAdminStatus(): Promise<{ isAdmin: boolean; email?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { isAdmin: false };
  const admins = getPlatformAdminEmails();
  return { isAdmin: admins.includes(session.user.email.toLowerCase()), email: session.user.email };
}