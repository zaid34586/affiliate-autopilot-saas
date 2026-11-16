import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createOAuthState,
  verifyOAuthState,
  setStateCookie,
  getStateCookie,
  clearStateCookie,
  generatePkceVerifier,
} from "./oauth-state";

describe("OAuth state (HMAC-signed JWT)", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "unit-test-secret";
  });
  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it("round-trips workspace + provider + nonce", async () => {
    const { state, nonce } = await createOAuthState("ws-1", "youtube");
    const verified = await verifyOAuthState(state);
    expect(verified).not.toBeNull();
    expect(verified!.workspaceId).toBe("ws-1");
    expect(verified!.provider).toBe("youtube");
    expect(verified!.nonce).toBe(nonce);
  });

  it("rejects a forged/tampered state", async () => {
    const { state } = await createOAuthState("ws-1", "youtube");
    // Flip a payload character (still base64-ish, signature breaks).
    const forged = state.slice(0, 10) + (state[10] === "A" ? "B" : "A") + state.slice(11);
    expect(await verifyOAuthState(forged)).toBeNull();
    expect(await verifyOAuthState("not-a-jwt")).toBeNull();
    expect(await verifyOAuthState("")).toBeNull();
  });

  it("rejects a state signed with a different secret", async () => {
    const { state } = await createOAuthState("ws-1", "youtube");
    process.env.AUTH_SECRET = "other-secret";
    expect(await verifyOAuthState(state)).toBeNull();
  });

  it("rejects an expired state (<= 10 min validity)", async () => {
    const { state } = await createOAuthState("ws-1", "youtube");
    const verified = await verifyOAuthState(state);
    expect(verified!.exp! - verified!.iat!).toBeLessThanOrEqual(600);
    // Expired tokens: craft one with exp in the past using the same secret.
    const { SignJWT } = await import("jose");
    const expired = await new SignJWT({
      workspaceId: "ws-1",
      provider: "youtube",
      nonce: "n",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 1200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 600)
      .sign(new TextEncoder().encode("unit-test-secret"));
    expect(await verifyOAuthState(expired)).toBeNull();
  });

  it("fails without AUTH_SECRET", async () => {
    delete process.env.AUTH_SECRET;
    await expect(createOAuthState("ws-1", "x")).rejects.toThrow(/AUTH_SECRET/);
  });

  it("PKCE verifier produces a valid S256 challenge", async () => {
    const { verifier, challenge } = await generatePkceVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).not.toContain("=");
    expect(challenge).not.toContain("+");
    expect(challenge).not.toContain("/");
    const crypto = await import("crypto");
    const expected = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(challenge).toBe(expected);
    // Two calls differ
    const second = await generatePkceVerifier();
    expect(second.verifier).not.toBe(verifier);
  });
});

describe("OAuth state cookie", () => {
  it("sets / reads / clears the nonce cookie", () => {
    const setHeaders = new Headers();
    setStateCookie(setHeaders, "nonce-abc");
    const cookie = setHeaders.get("set-cookie")!;
    expect(cookie).toContain("oauth_state_nonce=nonce-abc");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");

    const req = new Request("http://x/", { headers: { cookie: "oauth_state_nonce=nonce-abc" } });
    expect(getStateCookie(req)).toBe("nonce-abc");

    const clearHeaders = new Headers();
    clearStateCookie(clearHeaders);
    expect(clearHeaders.get("set-cookie")).toContain("Max-Age=0");
  });

  it("returns null when the cookie is absent", () => {
    const req = new Request("http://x/");
    expect(getStateCookie(req)).toBeNull();
  });
});
