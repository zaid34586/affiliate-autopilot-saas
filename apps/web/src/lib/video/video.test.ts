import { describe, expect, it } from "vitest";
import { clipPromptHash } from "./clip-cache";
import {
  PLAN_DAILY_RENDER_CAP,
  PLAN_VIDEO_QUOTA_MONTHLY,
  TOPUP_PACK,
} from "./constants";
import { chooseProvider } from "./providers/resolve";
import { extractVideoUrl } from "./providers/veo";
import { evaluateQuota, type QuotaInput } from "./quota";

const base: QuotaInput = {
  plan: "pro",
  usedThisMonth: 5,
  rendersToday: 2,
  platformSpendTodayUsd: 4,
  creditsBalance: 0,
  provider: "platform_pool",
};

describe("evaluateQuota", () => {
  it("allows a render within plan quota", () => {
    const d = evaluateQuota(base);
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.source).toBe("plan");
  });

  it("denies when monthly quota is exhausted (no credits) with top-up upsell", () => {
    const d = evaluateQuota({ ...base, usedThisMonth: PLAN_VIDEO_QUOTA_MONTHLY.pro });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.reason).toBe("monthly_quota_exceeded");
      expect(d.upsell.topupPack.videos).toBe(TOPUP_PACK.videos);
      expect(d.upsell.topupPack.priceUsd).toBe(19);
      expect(d.message).toContain("top-up");
    }
  });

  it("falls back to top-up credits after monthly quota", () => {
    const d = evaluateQuota({
      ...base,
      usedThisMonth: PLAN_VIDEO_QUOTA_MONTHLY.pro,
      creditsBalance: 3,
    });
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.source).toBe("topup");
  });

  it("enforces daily render cap before quota", () => {
    const d = evaluateQuota({ ...base, rendersToday: PLAN_DAILY_RENDER_CAP.pro });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe("daily_render_cap");
  });

  it("trips the daily $ circuit breaker for platform-pool renders", () => {
    const d = evaluateQuota({ ...base, platformSpendTodayUsd: 25 });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe("daily_spend_circuit_breaker");
  });

  it("BYOK renders bypass the platform-pool spend breaker but still count daily cap", () => {
    const byok = evaluateQuota({ ...base, provider: "byok", platformSpendTodayUsd: 999 });
    expect(byok.allowed).toBe(true);
    const byokDaily = evaluateQuota({
      ...base,
      provider: "byok",
      rendersToday: PLAN_DAILY_RENDER_CAP.pro,
    });
    expect(byokDaily.allowed).toBe(false);
  });

  it("free plan = 2 trial videos then deny", () => {
    const free = { ...base, plan: "free" as const, rendersToday: 0, platformSpendTodayUsd: 0 };
    expect(evaluateQuota({ ...free, usedThisMonth: 1 }).allowed).toBe(true);
    const d = evaluateQuota({ ...free, usedThisMonth: 2 });
    expect(d.allowed).toBe(false);
  });
});

describe("chooseProvider", () => {
  it("prefers BYOK key over platform pool", () => {
    const c = chooseProvider({ byokKey: "user-key", platformKey: "pool-key", allowMock: false });
    expect(c).toEqual({ mode: "byok", apiKey: "user-key", providerId: "veo" });
  });

  it("uses platform pool when no BYOK", () => {
    const c = chooseProvider({ byokKey: null, platformKey: "pool-key", allowMock: false });
    expect(c.mode).toBe("platform_pool");
    expect(c.providerId).toBe("veo");
  });

  it("falls back to mock only when allowed", () => {
    const c = chooseProvider({ byokKey: "", platformKey: null, allowMock: true });
    expect(c).toEqual({ mode: "mock", providerId: "mock" });
    expect(() =>
      chooseProvider({ byokKey: null, platformKey: null, allowMock: false })
    ).toThrowError(/not configured/i);
  });
});

describe("clipPromptHash (clip cache)", () => {
  const key = { provider: "veo", prompt: "hero shot of a red sneaker", durationSec: 6, aspect: "9:16" };

  it("is stable for identical inputs", () => {
    expect(clipPromptHash(key)).toBe(clipPromptHash({ ...key }));
  });

  it("changes when any input changes", () => {
    const h = clipPromptHash(key);
    expect(clipPromptHash({ ...key, prompt: "other" })).not.toBe(h);
    expect(clipPromptHash({ ...key, aspect: "1:1" })).not.toBe(h);
    expect(clipPromptHash({ ...key, durationSec: 8 })).not.toBe(h);
    expect(clipPromptHash({ ...key, provider: "kling" })).not.toBe(h);
  });
});

describe("extractVideoUrl (Veo operation parsing)", () => {
  it("parses generatedSamples[].video.uri", () => {
    const url = extractVideoUrl({
      done: true,
      response: { generatedSamples: [{ video: { uri: "https://example.com/a.mp4" } }] },
    });
    expect(url).toBe("https://example.com/a.mp4");
  });

  it("parses generatedVideos[].video.uri", () => {
    const url = extractVideoUrl({
      response: { generatedVideos: [{ video: { uri: "https://example.com/b.mp4" } }] },
    });
    expect(url).toBe("https://example.com/b.mp4");
  });

  it("returns undefined when no video present", () => {
    expect(extractVideoUrl({ response: {} })).toBeUndefined();
    expect(extractVideoUrl({})).toBeUndefined();
  });
});
