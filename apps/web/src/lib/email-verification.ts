/**
 * Phase 4 — Email verification: policy + signed tokens + email content.
 *
 * Tokens are jose HS256 JWTs signed with AUTH_SECRET (same pattern as
 * lib/connections/oauth-state.ts). Pure logic — no DB/transport access —
 * so everything here is unit-testable.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const VERIFY_TTL_SECONDS = 24 * 60 * 60; // 24 ghante

interface VerifyPayload extends JWTPayload {
  purpose: "email-verify";
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is required for email verification tokens");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Is email verification enforced at signup/login?
 *
 * Explicit opt-in via REQUIRE_EMAIL_VERIFICATION=true. Default is OFF so a
 * deployment without an email transport (RESEND_API_KEY) can never lock
 * users out — flip it on together with Resend (owner decision).
 */
export function isEmailVerificationRequired(flag?: string | null): boolean {
  return (flag ?? "").trim().toLowerCase() === "true";
}

/** Same, reading process.env directly (used by auth + actions). */
export function emailVerificationRequiredFromEnv(): boolean {
  return isEmailVerificationRequired(process.env.REQUIRE_EMAIL_VERIFICATION);
}

export async function signEmailVerificationToken(
  userId: string,
  opts: { secret?: string; ttlSeconds?: number } = {},
): Promise<string> {
  const key = opts.secret ? new TextEncoder().encode(opts.secret) : getSecretKey();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + (opts.ttlSeconds ?? VERIFY_TTL_SECONDS);

  return await new SignJWT({ purpose: "email-verify" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(key);
}

export async function verifyEmailVerificationToken(
  token: string,
  opts: { secret?: string } = {},
): Promise<{ userId: string } | null> {
  try {
    const key = opts.secret ? new TextEncoder().encode(opts.secret) : getSecretKey();
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    const p = payload as VerifyPayload;
    if (p.purpose !== "email-verify") return null;
    if (typeof p.sub !== "string" || !p.sub) return null;
    return { userId: p.sub };
  } catch {
    return null;
  }
}

export function buildVerificationEmail(
  appUrl: string,
  token: string,
): { url: string; subject: string; html: string; text: string } {
  const base = appUrl.replace(/\/$/, "");
  const url = `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "Verify your email — Affiliate Autopilot";
  const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<h1 style="font-size:20px">${subject}</h1>
<p>Welcome aboard! Click the button below to verify your email address and activate your account.</p>
<p><a href="${url}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Verify email</a></p>
<p style="font-size:12px;color:#888">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
</div>`;
  const text = `Verify your email to activate your account:\n${url}\n\nThis link expires in 24 hours.`;
  return { url, subject, html, text };
}
