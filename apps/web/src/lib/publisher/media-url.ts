/**
 * Phase 4 S6 — Signed public media URLs.
 * Instagram's Content Publish API makes Meta's servers download the video, so
 * the file needs a public (but unguessable, expiring) URL. We sign
 * `videoId.expiry` with HMAC-SHA256 (AUTH_SECRET) — no auth cookie needed,
 * no directory listing, auto-expires. R2 public URLs swap in later.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_TTL_SEC = 6 * 3600; // signed links live at most 6 hours

function secret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s) throw new Error("AUTH_SECRET is not configured — cannot sign media URLs.");
  return s;
}

function hmac(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Sign a public URL for one rendered video (expires in ttlSec, capped at 6h). */
export function signMediaUrl(opts: {
  baseUrl: string;
  videoId: string;
  ttlSec?: number;
}): string {
  const ttl = Math.min(Math.max(60, opts.ttlSec ?? 3600), MAX_TTL_SEC);
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = hmac(`${opts.videoId}.${exp}`);
  const base = opts.baseUrl.replace(/\/+$/, "");
  return `${base}/api/public/media/${opts.videoId}?exp=${exp}&sig=${sig}`;
}

/** Verify a signed media request. Constant-time compare; false on any tamper/expiry. */
export function verifyMediaSignature(
  videoId: string,
  expParam: string | null,
  sigParam: string | null
): boolean {
  if (!videoId || !expParam || !sigParam) return false;
  const exp = Number(expParam);
  if (!Number.isInteger(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  if (exp > Math.floor(Date.now() / 1000) + MAX_TTL_SEC + 60) return false;

  const expected = Buffer.from(hmac(`${videoId}.${exp}`));
  const provided = Buffer.from(sigParam);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/** Public base URL for this deployment (Vercel provides VERCEL_URL). */
export function publicBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}
