import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { authorizeCron, extractProvidedSecret, timingSafeEqualStr } from "./cron-auth";

/** Next.js types NODE_ENV as readonly — assign through a cast in tests. */
function setEnv(key: string, value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
}

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://app.example.com/api/cron/publish", { headers });
}

describe("timingSafeEqualStr", () => {
  it("matches equal strings", () => {
    expect(timingSafeEqualStr("s3cret", "s3cret")).toBe(true);
  });

  it("rejects different values and lengths without throwing", () => {
    expect(timingSafeEqualStr("s3cret", "s3cref")).toBe(false);
    expect(timingSafeEqualStr("s3cret", "s3")).toBe(false);
    expect(timingSafeEqualStr("", "")).toBe(true);
    expect(timingSafeEqualStr("", "x")).toBe(false);
  });
});

describe("extractProvidedSecret", () => {
  it("reads Bearer token (case-insensitive scheme, trimmed)", () => {
    expect(extractProvidedSecret(req({ authorization: "Bearer abc" }))).toBe("abc");
    expect(extractProvidedSecret(req({ authorization: "bearer  abc  " }))).toBe("abc");
  });

  it("falls back to x-cron-secret", () => {
    expect(extractProvidedSecret(req({ "x-cron-secret": "abc" }))).toBe("abc");
  });

  it("prefers Bearer over x-cron-secret and returns null when absent", () => {
    expect(
      extractProvidedSecret(req({ authorization: "Bearer one", "x-cron-secret": "two" }))
    ).toBe("one");
    expect(extractProvidedSecret(req())).toBeNull();
    expect(extractProvidedSecret(req({ authorization: "Basic dXNlcjpwdw==" }))).toBeNull();
  });
});

describe("authorizeCron", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "prod-secret";
    setEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    setEnv("NODE_ENV", "test");
  });

  it("accepts the correct secret via Bearer or x-cron-secret", () => {
    expect(authorizeCron(req({ authorization: "Bearer prod-secret" })).ok).toBe(true);
    expect(authorizeCron(req({ "x-cron-secret": "prod-secret" })).ok).toBe(true);
  });

  it("rejects wrong/missing secrets with 401 (never throws)", () => {
    const wrong = authorizeCron(req({ authorization: "Bearer nope" }));
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.status).toBe(401);

    const missing = authorizeCron(req());
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe(401);

    // Length mismatch must not blow up timingSafeEqual.
    const short = authorizeCron(req({ "x-cron-secret": "x" }));
    expect(short.ok).toBe(false);
  });

  it("trims the configured secret", () => {
    process.env.CRON_SECRET = "  spaced  ";
    expect(authorizeCron(req({ "x-cron-secret": "spaced" })).ok).toBe(true);
  });

  it("fails closed in production when CRON_SECRET is unset (503)", () => {
    delete process.env.CRON_SECRET;
    const res = authorizeCron(req());
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(503);
      expect(res.error).toContain("CRON_SECRET");
    }
  });

  it("allows unauthenticated requests in development only", () => {
    delete process.env.CRON_SECRET;
    setEnv("NODE_ENV", "development");
    expect(authorizeCron(req()).ok).toBe(true);
    setEnv("NODE_ENV", "production");
    expect(authorizeCron(req()).ok).toBe(false);
  });

  it("treats an empty CRON_SECRET as unset", () => {
    process.env.CRON_SECRET = "   ";
    const res = authorizeCron(req());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(503); // production
  });
});
