import { describe, expect, it } from "vitest";
import { buildDailyThought, type ThinkingContext } from "./thinking-core";

function ctx(over: Partial<ThinkingContext> = {}): ThinkingContext {
  return {
    characterName: "fit_ajju",
    niche: "fitness",
    yesterday: { impressions: 8400, clicks: 180, conversions: 2, revenue: 24.5 },
    last7: { impressions: 52000, clicks: 1400, conversions: 8, revenue: 120, posts: 18 },
    autopilotLevel: "semi",
    paused: false,
    topProduct: { title: "Resistance Bands Pro", aiScore: 87 },
    previousThought: "Yesterday we pushed the top product and saw a conversion.",
    ...over,
  };
}

describe("buildDailyThought — pure deterministic engine", () => {
  it("no data → honest empty entry, decision to publish/resume, low confidence", () => {
    const r = buildDailyThought(
      ctx({
        yesterday: { impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
        last7: { impressions: 0, clicks: 0, conversions: 0, revenue: 0, posts: 0 },
        topProduct: { title: "Resistance Bands Pro", aiScore: 87 },
        paused: false,
      }),
    );
    expect(r.engine).toBe("rules-v1");
    expect(r.thoughtText).toContain("Nothing to reflect on yet");
    expect(r.decision).toContain("Publish the first post");
    expect(r.confidence).toBeLessThan(30);
    expect(r.reasoning.length).toBeGreaterThanOrEqual(2);
  });

  it("no data + paused → decision to resume autopilot", () => {
    const r = buildDailyThought(
      ctx({
        yesterday: { impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
        last7: { impressions: 0, clicks: 0, conversions: 0, revenue: 0, posts: 0 },
        topProduct: null,
        paused: true,
      }),
    );
    expect(r.decision).toContain("Resume autopilot");
  });

  it("yesterday active, CTR under 1% → hook test decision", () => {
    const r = buildDailyThought(
      ctx({
        yesterday: { impressions: 2000, clicks: 10, conversions: 0, revenue: 0 }, // 0.5% CTR
      }),
    );
    expect(r.decision).toContain("stronger opening hook");
    expect(r.confidence).toBeGreaterThanOrEqual(55);
  });

  it("yesterday had conversion → double down on that product", () => {
    const r = buildDailyThought(
      ctx({
        yesterday: { impressions: 3000, clicks: 80, conversions: 1, revenue: 40 },
      }),
    );
    expect(r.decision).toContain("give");
    expect(r.decision).toContain("Resistance Bands Pro");
    expect(r.confidence).toBeGreaterThanOrEqual(70);
  });

  it("yesterday quiet but week has data → resume cadence", () => {
    const r = buildDailyThought(
      ctx({
        yesterday: { impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
      }),
    );
    expect(r.decision).toContain("Publish today to restore the cadence");
    expect(r.confidence).toBeGreaterThanOrEqual(35);
    expect(r.confidence).toBeLessThanOrEqual(55);
  });

  it("paused autopilot is always called out in reasoning", () => {
    const r = buildDailyThought(ctx({ paused: true }));
    expect(r.reasoning.join(" ")).toContain("paused");
  });

  it("reasoning always cites real numbers from context", () => {
    const r = buildDailyThought(ctx());
    const all = r.reasoning.join(" ");
    // reasoning may cite yesterday or last7 numbers — at least one real figure must appear
    expect(all).toMatch(/8,?400|180|1,400|52,?000|8|18/);
  });

  it("never invents earnings claims in thought text", () => {
    const r = buildDailyThought(
      ctx({ yesterday: { impressions: 1000, clicks: 20, conversions: 0, revenue: 0 } }),
    );
    expect(r.thoughtText).not.toMatch(/(will earn|guaranteed|risk-free|projected)/i);
  });

  it("confidence is integer 0–100", () => {
    for (const y of [
      { impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
      { impressions: 500, clicks: 5, conversions: 0, revenue: 0 },
      { impressions: 10000, clicks: 500, conversions: 5, revenue: 200 },
    ]) {
      const r = buildDailyThought(ctx({ yesterday: y }));
      expect(Number.isInteger(r.confidence)).toBe(true);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(100);
    }
  });

  it("idempotent: same context → identical output", () => {
    const c = ctx({ yesterday: { impressions: 4000, clicks: 60, conversions: 1, revenue: 15 } });
    const a = buildDailyThought(c);
    const b = buildDailyThought(c);
    expect(a.thoughtText).toBe(b.thoughtText);
    expect(a.decision).toBe(b.decision);
    expect(a.confidence).toBe(b.confidence);
    expect(a.reasoning).toEqual(b.reasoning);
  });

  it("continuity bullet appears when previousThought exists", () => {
    const r = buildDailyThought(ctx({ previousThought: "yesterday's note" }));
    expect(r.reasoning.join(" ")).toContain("Continuity");
  });
});