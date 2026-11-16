/**
 * Phase 4 — Email Verification Tests (policy + signed tokens)
 */

import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import {
  isEmailVerificationRequired,
  signEmailVerificationToken,
  verifyEmailVerificationToken,
  buildVerificationEmail,
} from "./email-verification";

const SECRET = "test-secret-for-email-verification";

describe("isEmailVerificationRequired", () => {
  it("is opt-in (default off)", () => {
    expect(isEmailVerificationRequired(undefined)).toBe(false);
    expect(isEmailVerificationRequired(null)).toBe(false);
    expect(isEmailVerificationRequired("")).toBe(false);
    expect(isEmailVerificationRequired("false")).toBe(false);
    expect(isEmailVerificationRequired("garbage")).toBe(false);
  });

  it("accepts explicit true in any case / with whitespace", () => {
    expect(isEmailVerificationRequired("true")).toBe(true);
    expect(isEmailVerificationRequired("TRUE")).toBe(true);
    expect(isEmailVerificationRequired(" True ")).toBe(true);
  });
});

describe("verification tokens", () => {
  it("round-trips a valid token", async () => {
    const token = await signEmailVerificationToken("user-123", { secret: SECRET });
    const payload = await verifyEmailVerificationToken(token, { secret: SECRET });
    expect(payload).toEqual({ userId: "user-123" });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signEmailVerificationToken("user-123", { secret: SECRET });
    expect(await verifyEmailVerificationToken(token, { secret: "other-secret" })).toBeNull();
  });

  it("rejects tampered payloads", async () => {
    const token = await signEmailVerificationToken("user-123", { secret: SECRET });
    const [header, , sig] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ purpose: "email-verify", sub: "attacker" }),
    ).toString("base64url");
    const forged = `${header}.${forgedPayload}.${sig}`;
    expect(await verifyEmailVerificationToken(forged, { secret: SECRET })).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await signEmailVerificationToken("user-123", {
      secret: SECRET,
      ttlSeconds: -10,
    });
    expect(await verifyEmailVerificationToken(token, { secret: SECRET })).toBeNull();
  });

  it("rejects tokens with the wrong purpose", async () => {
    const token = await new SignJWT({ purpose: "something-else" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyEmailVerificationToken(token, { secret: SECRET })).toBeNull();
  });

  it("rejects garbage input", async () => {
    expect(await verifyEmailVerificationToken("not-a-jwt", { secret: SECRET })).toBeNull();
    expect(await verifyEmailVerificationToken("", { secret: SECRET })).toBeNull();
  });
});

describe("buildVerificationEmail", () => {
  it("embeds the signed link in url, html and text", () => {
    const { url, html, text, subject } = buildVerificationEmail(
      "https://example.com/",
      "abc.def.ghi",
    );
    expect(url).toBe("https://example.com/api/auth/verify-email?token=abc.def.ghi");
    expect(html).toContain(url);
    expect(text).toContain(url);
    expect(subject).toContain("Verify your email");
  });

  it("normalizes a trailing slash on appUrl", () => {
    const { url } = buildVerificationEmail("https://example.com", "abc");
    expect(url).toBe("https://example.com/api/auth/verify-email?token=abc");
  });
});
