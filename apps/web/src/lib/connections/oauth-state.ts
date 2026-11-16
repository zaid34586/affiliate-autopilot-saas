/**
 * OAuth State Management - secure state parameter for OAuth flows.
 * Uses HMAC-SHA256 for integrity and a cookie for CSRF protection.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const STATE_TTL_SECONDS = 600; // 10 minutes
const STATE_COOKIE_NAME = "oauth_state_nonce";

interface OAuthStatePayload extends JWTPayload {
  workspaceId: string;
  provider: string;
  nonce: string;
  pkceVerifier?: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is required for OAuth state signing");
  }
  return new TextEncoder().encode(secret);
}

export async function createOAuthState(
  workspaceId: string,
  provider: string,
  pkceVerifier?: string
): Promise<{ state: string; nonce: string }> {
  const nonce = crypto.randomUUID();
  const payload: OAuthStatePayload = {
    workspaceId,
    provider,
    nonce,
    pkceVerifier,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(payload.iat!)
    .setExpirationTime(payload.exp!)
    .sign(getSecretKey());

  return { state: token, nonce };
}

export async function verifyOAuthState(state: string): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(state, getSecretKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as OAuthStatePayload;
  } catch {
    return null;
  }
}

export function setStateCookie(headers: Headers, nonce: string): void {
  const isProd = process.env.NODE_ENV === "production";
  const cookie = `${STATE_COOKIE_NAME}=${nonce}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${STATE_TTL_SECONDS}${isProd ? "; Secure" : ""}`;
  headers.append("Set-Cookie", cookie);
}

export function getStateCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const stateCookie = cookies.find((c) => c.startsWith(`${STATE_COOKIE_NAME}=`));
  if (!stateCookie) return null;

  return stateCookie.split("=")[1] || null;
}

export function clearStateCookie(headers: Headers): void {
  const isProd = process.env.NODE_ENV === "production";
  const cookie = `${STATE_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? "; Secure" : ""}`;
  headers.append("Set-Cookie", cookie);
}

export async function generatePkceVerifier(): Promise<{ verifier: string; challenge: string }> {
  const verifier = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const challengeBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(challengeBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return { verifier, challenge };
}