/**
 * Phase 1 done-condition: connect → callback flow end-to-end with mocked
 * provider endpoints (fetch), mocked session, and mocked DB.
 *
 * Covers: provider parsing (1.1), signed state + nonce cookie (1.3),
 * token encryption on write (1.4), PKCE for X (1.5), allow-list validation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks (hoisted by vi.mock) ────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  session: { user: { workspaceId: "ws-1", email: "a@b.com" } } as unknown,
  insertValues: [] as unknown[],
  onConflict: [] as unknown[],
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => mocks.session),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn((v: unknown) => {
        mocks.insertValues.push(v);
        return {
          onConflictDoUpdate: vi.fn((opts: unknown) => {
            mocks.onConflict.push(opts);
            return Promise.resolve([]);
          }),
        };
      }),
    })),
  },
}));

import { POST as connectPOST } from "@/app/api/auth/connect/route";
import { GET as callbackGET } from "@/app/api/auth/callback/route";
import { decryptToken } from "@/lib/crypto/secrets";

const KEY = Buffer.alloc(32, 9).toString("base64");

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OAuth connect → callback flow (mocked providers)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertValues = [];
    mocks.onConflict = [];
    process.env.AUTH_SECRET = "e2e-secret";
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
    process.env.NEXTAUTH_URL = "https://app.example.com";
    process.env.YOUTUBE_CLIENT_ID = "yt-client";
    process.env.YOUTUBE_CLIENT_SECRET = "yt-secret";
    process.env.X_CLIENT_ID = "x-client";
    process.env.X_CLIENT_SECRET = "x-secret";

    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of [
      "AUTH_SECRET",
      "TOKEN_ENCRYPTION_KEY",
      "NEXTAUTH_URL",
      "YOUTUBE_CLIENT_ID",
      "YOUTUBE_CLIENT_SECRET",
      "X_CLIENT_ID",
      "X_CLIENT_SECRET",
      "FACEBOOK_CLIENT_ID",
    ]) {
      delete process.env[k];
    }
  });

  async function runConnect(provider: string) {
    const req = new Request("https://app.example.com/api/auth/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const res = await connectPOST(req as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    const setCookie = res.headers.get("set-cookie") ?? "";
    return { url: new URL(body.url), setCookie };
  }

  function extractState(url: URL) {
    return url.searchParams.get("state")!;
  }

  function nonceFromCookie(setCookie: string): string {
    const m = /oauth_state_nonce=([^;]+)/.exec(setCookie);
    expect(m).toBeTruthy();
    return m![1];
  }

  async function runCallback(provider: string, opts: {
    code?: string | null;
    state?: string | null;
    nonce?: string | null;
  }) {
    const params = new URLSearchParams();
    if (opts.code !== null && opts.code !== undefined) params.set("code", opts.code);
    if (opts.state !== null && opts.state !== undefined) params.set("state", opts.state);
    const headers: Record<string, string> = {};
    if (opts.nonce) headers.cookie = `oauth_state_nonce=${opts.nonce}`;
    const req = new Request(
      `https://app.example.com/api/auth/callback/${provider}?${params.toString()}`,
      { headers }
    );
    return callbackGET(req as never);
  }

  it("connect returns a signed provider URL + nonce cookie (offline only for Google)", async () => {
    const { url, setCookie } = await runConnect("youtube");
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    expect(url.searchParams.get("client_id")).toBe("yt-client");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBeTruthy();
    // Google supports offline access — it should be requested.
    expect(url.searchParams.get("access_type")).toBe("offline");
    // Redirect URI is built from NEXTAUTH_URL consistently.
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/auth/callback/youtube"
    );
    expect(nonceFromCookie(setCookie)).toBeTruthy();

    // A provider without offline support must NOT get access_type=offline.
    process.env.FACEBOOK_CLIENT_ID = "fb-client";
    const { url: fbUrl } = await runConnect("facebook");
    expect(fbUrl.searchParams.get("access_type")).toBeNull();
    expect(fbUrl.searchParams.get("prompt")).toBeNull();
  });

  it("rejects unknown providers (allow-list)", async () => {
    const req = new Request("https://app.example.com/api/auth/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "evilcorp" }),
    });
    const res = await connectPOST(req as never);
    expect(res.status).toBe(400);
  });

  it("requires a session for connect", async () => {
    mocks.session = null;
    const req = new Request("https://app.example.com/api/auth/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "youtube" }),
    });
    const res = await connectPOST(req as never);
    expect(res.status).toBe(401);
    mocks.session = { user: { workspaceId: "ws-1", email: "a@b.com" } };
  });

  it("full flow: valid state + nonce → tokens encrypted → connection upserted", async () => {
    const { url, setCookie } = await runConnect("youtube");
    const state = extractState(url);
    const nonce = nonceFromCookie(setCookie);

    // Mock provider token endpoint + account info endpoint.
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "yt-access-token-plain",
          refresh_token: "yt-refresh-token-plain",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/youtube.upload",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ id: "UC channel-1", snippet: { title: "My Channel" } }],
        })
      );

    const res = await runCallback("youtube", { code: "auth-code", state, nonce });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("connected=youtube");

    // Token exchange hit the provider with our redirect_uri.
    const [tokenCall] = fetchMock.mock.calls;
    expect(String(tokenCall[0])).toBe("https://oauth2.googleapis.com/token");
    const tokenBody = String(tokenCall[1].body);
    expect(tokenBody).toContain("code=auth-code");
    expect(tokenBody).toContain("yt-client");

    // Connection stored with ENCRYPTED tokens (not plaintext).
    expect(mocks.insertValues).toHaveLength(1);
    const row = mocks.insertValues[0] as Record<string, unknown>;
    expect(row.workspaceId).toBe("ws-1");
    expect(row.provider).toBe("youtube");
    expect(row.accountId).toBe("UC channel-1");
    expect(row.accessTokenEnc).not.toBe("yt-access-token-plain");
    expect(row.refreshTokenEnc).not.toBe("yt-refresh-token-plain");
    expect(await decryptToken(row.accessTokenEnc as string)).toBe(
      "yt-access-token-plain"
    );
    expect(await decryptToken(row.refreshTokenEnc as string)).toBe(
      "yt-refresh-token-plain"
    );
    // Expiry derived from expires_in.
    const exp = row.tokenExpiresAt as Date;
    expect(exp.getTime()).toBeGreaterThan(Date.now());

    // onConflict targets (workspaceId, provider) — needs the unique index (0028).
    expect(mocks.onConflict).toHaveLength(1);
    const conflict = mocks.onConflict[0] as { target: unknown[] };
    expect(conflict.target).toHaveLength(2);
  });

  it("rejects state for another workspace (hijack attempt)", async () => {
    const { url, setCookie } = await runConnect("youtube");
    const state = extractState(url);
    const nonce = nonceFromCookie(setCookie);

    // Attacker swaps the session to a different workspace.
    mocks.session = { user: { workspaceId: "ws-VICTIM", email: "x@y.z" } };
    const res = await runCallback("youtube", { code: "c", state, nonce });
    expect(res.headers.get("location")).toContain("error=unauthorized");
    expect(mocks.insertValues).toHaveLength(0);
    mocks.session = { user: { workspaceId: "ws-1", email: "a@b.com" } };
  });

  it("rejects missing nonce cookie (CSRF)", async () => {
    const { url } = await runConnect("youtube");
    const state = extractState(url);
    const res = await runCallback("youtube", { code: "c", state, nonce: null });
    expect(res.headers.get("location")).toContain("error=invalid_state");
    expect(mocks.insertValues).toHaveLength(0);
  });

  it("rejects tampered state", async () => {
    const { url, setCookie } = await runConnect("youtube");
    const state = extractState(url);
    const nonce = nonceFromCookie(setCookie);
    const tampered =
      state.slice(0, 8) + (state[8] === "A" ? "B" : "A") + state.slice(9);
    const res = await runCallback("youtube", { code: "c", state: tampered, nonce });
    expect(res.headers.get("location")).toContain("error=invalid_state");
    expect(mocks.insertValues).toHaveLength(0);
  });

  it("rejects provider mismatch in state", async () => {
    const { url, setCookie } = await runConnect("youtube");
    const state = extractState(url);
    const nonce = nonceFromCookie(setCookie);
    // Same state, different callback path.
    const res = await runCallback("facebook", { code: "c", state, nonce });
    expect(res.headers.get("location")).toContain("error=provider_mismatch");
    expect(mocks.insertValues).toHaveLength(0);
  });

  it("clears the state cookie on both success and failure", async () => {
    const { url, setCookie } = await runConnect("youtube");
    const state = extractState(url);
    const nonce = nonceFromCookie(setCookie);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "t", expires_in: 60 }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: "ch", snippet: {} }] }));
    const ok = await runCallback("youtube", { code: "c", state, nonce });
    expect(ok.headers.get("set-cookie") ?? "").toContain("Max-Age=0");

    const bad = await runCallback("youtube", { code: "c", state: null, nonce: null });
    expect(bad.headers.get("set-cookie") ?? "").toContain("Max-Age=0");
  });

  it("X provider gets a real PKCE challenge (no hardcoded verifier)", async () => {
    const { url } = await runConnect("x");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const challenge = url.searchParams.get("code_challenge");
    expect(challenge).toBeTruthy();
    expect(challenge!.length).toBeGreaterThanOrEqual(43);
    // No "challenge" hardcoded verifier leaked into the URL.
    expect(url.searchParams.get("code_verifier")).toBeNull();
  });

  it("provider errors are surfaced before state checks", async () => {
    const res = await runCallback("youtube", {
      code: null,
      state: null,
      nonce: null,
    });
    expect(res.headers.get("location")).toContain("error=missing_params");
  });
});
