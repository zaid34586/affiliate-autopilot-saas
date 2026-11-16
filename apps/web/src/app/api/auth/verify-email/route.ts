/**
 * Phase 4 — Email verification endpoint (public).
 * GET /api/auth/verify-email?token=<jose-hs256>
 *
 * Marks the user verified (idempotent) and redirects to /login with a
 * status flag the login page renders as a notice.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users } from "@aa/db";
import { db } from "@/lib/db";
import { verifyEmailVerificationToken } from "@/lib/email-verification";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  const payload = token ? await verifyEmailVerificationToken(token) : null;
  if (!payload) {
    return NextResponse.redirect(new URL("/login?verify=failed", req.url));
  }

  try {
    await db
      .update(users)
      .set({ emailVerified: true, emailVerifiedAt: new Date() })
      .where(eq(users.id, payload.userId));
  } catch (err) {
    console.error("Email verify error:", err);
    return NextResponse.redirect(new URL("/login?verify=failed", req.url));
  }

  return NextResponse.redirect(new URL("/login?verify=success", req.url));
}
