import { describe, expect, it } from "vitest";
import {
  buildDiscussReply,
  classifyIntent,
  type DiscussContext,
} from "./discuss-core";

function ctx(overrides: Partial<DiscussContext> = {}): DiscussContext {
  return {
    characterName: "fit_ajju",
    niche: "fitness",
    tone: "friendly",
    autopilotLevel: "semi",
    paused: false,
    last7: { impressions: 12000, clicks: 340, conversions: 4, revenue: 42.5 },
    postsLast7: 5,
    topProducts: [
      {
        title: "Resistance Bands Pro",
        aiScore: 87,
        commissionValue: "8",
        commissionType: "percentage",
      },
      {
        title: "Yoga Mat",
        aiScore: 74,
        commissionValue: "5",
        commissionType: "percentage",
      },
    ],
    lastJournal: null,
    ...overrides,
  };
}

describe("classifyIntent", () => {
  it("recognises what-to-post questions (English + Hinglish)", () => {
    expect(classifyIntent("kal kya post karein?")).toBe("what_to_post");
    expect(classifyIntent("What should I post tomorrow?")).toBe(
      "what_to_post",
    );
    expect(classifyIntent("give me a video idea")).toBe("what_to_post");
  });

  it("recognises earnings questions", () => {
    expect(classifyIntent("how much did we earn?")).toBe("earnings");
    expect(classifyIntent("kitna kamaya is week?")).toBe("earnings");
    expect(classifyIntent("report my revenue")).toBe("earnings");
  });

  it("recognises performance questions", () => {
    expect(classifyIntent("how was performance this week?")).toBe(
      "performance",
    );
    expect(classifyIntent("post chala kaisa?")).toBe("performance");
    expect(classifyIntent("show me the clicks stats")).toBe("performance");
  });

  it("recognises strategy and how-to questions", () => {
    expect(classifyIntent("growth strategy banao")).toBe("strategy");
    expect(classifyIntent("how does autopilot work?")).toBe("how_to");
    expect(classifyIntent("autopilot level kaise set karein")).toBe("how_to");
  });

  it("falls back to general", () => {
    expect(classifyIntent("hello there")).toBe("general");
    expect(classifyIntent("")).toBe("general");
  });
});

describe("buildDiscussReply", () => {
  it("answers what-to-post with the top-scored product + reasoning + 3 suggestions", () => {
    const r = buildDiscussReply(ctx(), "kal kya post karein?");
    expect(r.intent).toBe("what_to_post");
    expect(r.engine).toBe("rules-v1");
    expect(r.reply).toContain("Resistance Bands Pro");
    expect(r.reasoning.length).toBeGreaterThanOrEqual(3);
    expect(r.suggestions).toHaveLength(3);
  });

  it("performance answer uses only real numbers from context", () => {
    const r = buildDiscussReply(ctx(), "how did performance look?");
    expect(r.reply).toContain("12,000");
    expect(r.reply).toContain("340");
    expect(r.reply).toContain("4 conversions");
  });

  it("never fabricates earnings when there are none", () => {
    const r = buildDiscussReply(
      ctx({
        last7: { impressions: 500, clicks: 12, conversions: 0, revenue: 0 },
      }),
      "what did we earn?",
    );
    expect(r.intent).toBe("earnings");
    expect(r.reply).toContain("No conversions recorded");
    // no dollar figure in a zero-data earnings answer
    expect(r.reply).not.toMatch(/\$\d/);
  });

  it("reports actual revenue when conversions exist", () => {
    const r = buildDiscussReply(ctx(), "revenue this week?");
    expect(r.reply).toContain("$42.50");
    expect(r.reply.toLowerCase()).not.toContain("will earn");
  });

  it("performance with zero data refuses to guess numbers", () => {
    const r = buildDiscussReply(
      ctx({
        last7: { impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
        postsLast7: 0,
      }),
      "views kaise the?",
    );
    expect(r.reply).toContain("No synced analytics yet");
    expect(r.reply).not.toMatch(/\d+% CTR/);
  });

  it("paused autopilot is called out in what-to-post reasoning", () => {
    const r = buildDiscussReply(ctx({ paused: true }), "what to post next?");
    expect(r.reasoning.join(" ")).toContain("paused");
  });

  it("no active products → honest fallback, no invented product", () => {
    const r = buildDiscussReply(ctx({ topProducts: [] }), "kal kya post karein?");
    expect(r.reply).toContain("don't have an active product");
    expect(r.reply).not.toContain("Resistance Bands");
  });

  it("how-to explains all four autopilot levels", () => {
    const r = buildDiscussReply(ctx(), "how does autopilot work?");
    expect(r.reply).toContain("Manual");
    expect(r.reply).toContain("Semi");
    expect(r.reply).toContain("Full");
    expect(r.reply).toContain("Fire-and-forget");
  });

  it("every answer carries at least one reasoning bullet", () => {
    const messages = [
      "kal kya post karein?",
      "how was performance?",
      "what did we earn?",
      "growth strategy",
      "how to setup autopilot",
      "hello",
    ];
    for (const m of messages) {
      const r = buildDiscussReply(ctx(), m);
      expect(r.reasoning.length).toBeGreaterThanOrEqual(1);
      expect(r.reply.length).toBeGreaterThan(20);
    }
  });
});
