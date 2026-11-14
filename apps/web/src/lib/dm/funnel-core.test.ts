import { describe, expect, it } from "vitest";
import {
  matchTrigger,
  findMatchingFunnel,
  renderStepTemplate,
  checkStepConditions,
  checkAntiSpam,
  type FunnelStep,
  type ConversationState,
} from "./funnel-core";

describe("matchTrigger", () => {
  it("exact match", () => {
    expect(matchTrigger("what is the price?", { keywords: { set: ["price"], semantic: false } })).toEqual({
      matched: true,
      keyword: "price",
    });
  });

  it("semantic match - price variants", () => {
    const trigger = { keywords: { set: ["price"], semantic: true } };
    expect(matchTrigger("kitne ka hai?", trigger).matched).toBe(true);
    expect(matchTrigger("how much does it cost?", trigger).matched).toBe(true);
    expect(matchTrigger("what is the rate?", trigger).matched).toBe(true);
  });

  it("semantic match - buy variants", () => {
    const trigger = { keywords: { set: ["buy"], semantic: true } };
    expect(matchTrigger("I want to purchase this", trigger).matched).toBe(true);
    expect(matchTrigger("order karna hai", trigger).matched).toBe(true);
  });

  it("semantic match - link variants", () => {
    const trigger = { keywords: { set: ["link"], semantic: true } };
    expect(matchTrigger("send me the link", trigger).matched).toBe(true);
    expect(matchTrigger("link do", trigger).matched).toBe(true);
  });

  it("no match", () => {
    expect(matchTrigger("hello world", { keywords: { set: ["price"], semantic: true } })).toEqual({
      matched: false,
      keyword: null,
    });
  });

  it("multiple keywords - first match wins", () => {
    const trigger = { keywords: { set: ["price", "buy"], semantic: true } };
    expect(matchTrigger("how much to buy?", trigger).keyword).toBe("price");
  });
});

function expectMatchTrigger(text: string, trigger: { keywords: { set: string[]; semantic: boolean } }) {
  return matchTrigger(text, trigger);
}

describe("findMatchingFunnel", () => {
  const triggers = [
    { id: "t1", keywords: { set: ["price"], semantic: true }, funnelId: "f1" },
    { id: "t2", keywords: { set: ["buy"], semantic: true }, funnelId: "f2" },
    { id: "t3", keywords: { set: ["link"], semantic: true }, funnelId: null }, // no funnel
  ];

  it("returns funnel for matching trigger", () => {
    const r = findMatchingFunnel("kitne ka hai?", triggers);
    expect(r.matched).toBe(true);
    expect(r.funnelId).toBe("f1");
    expect(r.triggerId).toBe("t1");
  });

  it("skips trigger without funnel", () => {
    const r = findMatchingFunnel("send me the link", triggers);
    expect(r.matched).toBe(false);
  });

  it("no match returns null", () => {
    const r = findMatchingFunnel("hello there", triggers);
    expect(r.matched).toBe(false);
    expect(r.funnelId).toBeNull();
  });
});

describe("renderStepTemplate", () => {
  const ctx = {
    productTitle: "Resistance Bands",
    linkUrl: "https://go.affiliateautopilot.app/abc123",
    characterName: "fit_ajju",
    recipientHandle: "fan_rohan",
    price: "$29",
  };

  it("replaces all variables", () => {
    const template = "Hey {{handle}}, check {{product}} at {{link}} from {{name}} for {{price}}";
    const r = renderStepTemplate(template, ctx);
    expect(r).toBe("Hey fan_rohan, check Resistance Bands at https://go.affiliateautopilot.app/abc123 from fit_ajju for $29");
  });

  it("missing variable becomes empty", () => {
    const r = renderStepTemplate("{{missing}}", {});
    expect(r).toBe("");
  });

  it("handle strips @", () => {
    const r = renderStepTemplate("Hi {{handle}}", { recipientHandle: "@rohan" });
    expect(r).toBe("Hi rohan");
  });
});

describe("checkStepConditions", () => {
  it("empty conditions = true", () => {
    expect(checkStepConditions({}, {})).toBe(true);
  });

  it("sentiment match", () => {
    expect(checkStepConditions({ sentiment: "positive" }, { sentiment: "positive" })).toBe(true);
    expect(checkStepConditions({ sentiment: "positive" }, { sentiment: "negative" })).toBe(false);
  });

  it("hasLink check", () => {
    expect(checkStepConditions({ hasLink: true }, { linkUrl: "http://x" })).toBe(true);
    expect(checkStepConditions({ hasLink: true }, {})).toBe(false);
    expect(checkStepConditions({ hasLink: false }, {})).toBe(true);
  });

  it("hasProduct check", () => {
    expect(checkStepConditions({ hasProduct: true }, { productId: "123" })).toBe(true);
    expect(checkStepConditions({ hasProduct: true }, {})).toBe(false);
  });

  it("multiple conditions all must pass", () => {
    expect(
      checkStepConditions(
        { sentiment: "positive", hasLink: true },
        { sentiment: "positive", linkUrl: "x" },
      ),
    ).toBe(true);
    expect(
      checkStepConditions(
        { sentiment: "positive", hasLink: true },
        { sentiment: "negative", linkUrl: "x" },
      ),
    ).toBe(false);
  });
});

describe("checkAntiSpam", () => {
  const baseParams = {
    workspaceId: "ws1",
    platform: "instagram",
    recipientHandle: "fan_rohan",
    funnelId: "f1",
    dailyCaps: [{ platform: "instagram", day: "2026-11-14", sentCount: 5, limit: 50 }],
    blocklist: [],
    existingConversation: null,
    funnelDailyCap: 100,
    funnelSentToday: 0,
    globalSentToday: 0,
  };

  it("allows clean send", () => {
    expect(checkAntiSpam(baseParams)).toEqual({ allowed: true, reason: "OK" });
  });

  it("blocks blocklisted handle", () => {
    const r = checkAntiSpam({
      ...baseParams,
      blocklist: [{ handle: "fan_rohan", platform: null }],
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("blocklisted");
  });

  it("blocks blocklisted handle on specific platform", () => {
    const r = checkAntiSpam({
      ...baseParams,
      blocklist: [{ handle: "fan_rohan", platform: "instagram" }],
    });
    expect(r.allowed).toBe(false);
  });

  it("allows if blocklisted on different platform", () => {
    const r = checkAntiSpam({
      ...baseParams,
      platform: "youtube",
      blocklist: [{ handle: "fan_rohan", platform: "instagram" }],
    });
    expect(r.allowed).toBe(true);
  });

  it("blocks active conversation", () => {
    const conv: ConversationState = {
      conversationId: "c1",
      funnelId: "f1",
      recipientHandle: "fan_rohan",
      platform: "instagram",
      currentStepIndex: 1,
      status: "active",
      lastSentAt: null,
      nextStepAt: null,
      context: {},
    };
    const r = checkAntiSpam({ ...baseParams, existingConversation: conv });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("active funnel conversation");
  });

  it("blocks completed conversation", () => {
    const conv: ConversationState = {
      conversationId: "c1",
      funnelId: "f1",
      recipientHandle: "fan_rohan",
      platform: "instagram",
      currentStepIndex: 1,
      status: "completed",
      lastSentAt: null,
      nextStepAt: null,
      context: {},
    };
    const r = checkAntiSpam({ ...baseParams, existingConversation: conv });
    expect(r.allowed).toBe(false);
  });

  it("blocks when funnel daily cap reached", () => {
    const r = checkAntiSpam({ ...baseParams, funnelSentToday: 100, funnelDailyCap: 100 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("Funnel daily cap");
  });

  it("blocks when platform daily cap reached", () => {
    const r = checkAntiSpam({
      ...baseParams,
      dailyCaps: [{ platform: "instagram", day: "2026-11-14", sentCount: 50, limit: 50 }],
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("Platform daily cap");
  });
});