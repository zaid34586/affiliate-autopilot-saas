/**
 * Phase 3 — shared cron authorization for ALL /api/cron/* routes.
 *
 * Vercel Cron issues GET requests (with `Authorization: Bearer <CRON_SECRET>`
 * when CRON_SECRET is set), so every cron route must treat GET and POST the
 * same way: authorize, then do the real work. Previously most routes only did
 * work on POST, so scheduled crons never ran in production.
 *
 * Rules:
 * - One shared secret: CRON_SECRET (per-route `*_CRON_SECRET` vars removed).
 * - Comparison is constant-time (timing-safe) and length-mismatch safe.
 * - Fail closed: in production a missing CRON_SECRET is a 503, never an
 *   implicit allow. Local development without a secret is allowed.
 */
import crypto from "crypto";
import { NextResponse } from "next/server";

export interface CronAuthFailure {
  ok: false;
  status: 401 | 503;
  error: string;
}

export type CronAuthResult = { ok: true } | CronAuthFailure;

/** Constant-time string compare (returns false on length mismatch, never throws). */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Extract the provided cron secret from `Authorization: Bearer …` or `x-cron-secret`. */
export function extractProvidedSecret(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  const bearer =
    authHeader && /^Bearer\s+/i.test(authHeader)
      ? authHeader.replace(/^Bearer\s+/i, "").trim()
      : null;
  const header = req.headers.get("x-cron-secret")?.trim() || null;
  return bearer || header;
}

/**
 * Authorize a cron request. Pure decision — routes render the failure as
 * `NextResponse.json({ error: auth.error }, { status: auth.status })`.
 */
export function authorizeCron(req: Request): CronAuthResult {
  const secret = process.env.CRON_SECRET?.trim();

  if (secret) {
    const provided = extractProvidedSecret(req);
    if (provided && timingSafeEqualStr(provided, secret)) return { ok: true };
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  // Fail closed: production must never run unauthenticated crons.
  if (process.env.NODE_ENV === "production") {
    return { ok: false, status: 503, error: "CRON_SECRET not configured" };
  }

  return { ok: true }; // local development only
}

/**
 * Convenience guard for route handlers: returns the 401/503 response when the
 * request is NOT authorized, or null when it is. Usage:
 *
 *   const guard = cronGuard(req);
 *   if (guard) return guard;
 */
export function cronGuard(req: Request): NextResponse | null {
  const auth = authorizeCron(req);
  if (auth.ok) return null;
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}
