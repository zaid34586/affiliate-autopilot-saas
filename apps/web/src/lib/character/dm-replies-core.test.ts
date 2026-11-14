import { describe, expect, it } from "vitest";
import {
  buildDmSuggestion,
  classifyDmIntent,
  type DmSuggestionInput,
} from "./dm-replies-core";

const LINK = "https://go.affiliateautopilot.app/abc123";

function input(overrides: Partial<DmSuggestionInput> = {}): DmSuggestionInput {
  return {
    triggerKeyword: "link",
    currentBody: "Thanks for your interest! Here's the link: {{link}}",
    recipientHandle: "@rohan_fit",
    characterName: "fit_ajju",
    niche: "fitness",
    productTitle: "Resistance Bands Pro",
    linkUrl: LINK,
    ...overrides,
  };
}

describe("classifyDmIntent", () => {
  it("detects buy intent from trigger keyword", () => {
    expect(classifyDmIntent(input({ triggerKeyword: "price" }))).toBe("buy_intent");
    expect(classifyDmIntent(input({ triggerKeyword: "kitne ka" }))).toBe("buy_intent");
    expect(classifyDmIntent(input({ triggerKeyword: "buy" }))).toBe("buy_intent");
  });

  it("detects negative and abusive triggers first", () => {
    expect(classifyDmIntent(input({ triggerKeyword: "scam" }))).toBe("negative");
    expect(classifyDmIntent(input({ triggerKeyword: "idiot" }))).toBe("negative");
    expect(classifyDmIntent(input({ triggerKeyword: "unsubscribe" }))).toBe("negative");
  });

  it("detects questions and thanks", () => {
    expect(classifyDmIntent(input({ triggerKeyword: "how" }))).toBe("question");
    expect(classifyDmIntent(input({ triggerKeyword: "kaise" }))).toBe("question");
    expect(classifyDmIntent(input({ triggerKeyword: "thanks" }))).toBe("thanks");
  });

  it("falls back to general", () => {
    expect(classifyDmIntent(input({ triggerKeyword: "hello" }))).toBe("general");
    expect(classifyDmIntent(input({ triggerKeyword: null, currentBody: "hi" }))).toBe("general");
  });
});

describe("buildDmSuggestion — guardrails", () => {
  it("includes the real tracked link on buy intent", () => {
    const r = buildDmSuggestion(input({ triggerKeyword: "price" }));
    expect(r.intent).toBe("buy_intent");
    expect(r.reply).toContain(LINK);
    expect(r.engine).toBe("rules-v1");
  });

  it("never quotes a price even on buy intent", () => {
    const r = buildDmSuggestion(input({ triggerKeyword: "price" }));
    expect(r.reply).not.toMatch(/\$\d/);
    expect(r.reply.toLowerCase()).toContain("don't quote numbers");
  });

  it("does NOT invent a link when there is no tracked link", () => {
    const r = buildDmSuggestion(input({ linkUrl: null }));
    expect(r.reply).not.toContain("http");
    expect(r.reply).not.toContain("go.affiliateautopilot.app");
    expect(r.reasons.join(" ")).toContain("none was invented");
  });

  it("strips dollar figures if the product title contained one", () => {
    const r = buildDmSuggestion(
      input({ triggerKeyword: "buy", productTitle: "Course for $49" }),
    );
    expect(r.reply).not.toMatch(/\$\d/);
    expect(r.reasons.join(" ")).toContain("never quoted");
  });

  it("negative trigger gets a polite decline, no link, no pitch", () => {
    const r = buildDmSuggestion(input({ triggerKeyword: "scam" }));
    expect(r.intent).toBe("negative");
    expect(r.reply).not.toContain(LINK);
    expect(r.reply.toLowerCase()).not.toContain("buy");
  });

  it("abusive trigger gets a brief close, no pitch", () => {
    const r = buildDmSuggestion(input({ triggerKeyword: "idiot" }));
    expect(r.intent).toBe("negative");
    expect(r.reply).not.toContain(LINK);
    expect(r.reasons.join(" ")).toContain("Abusive");
  });

  it("character name appears in the reply", () => {
    const r = buildDmSuggestion(input());
    expect(r.reply).toContain("fit_ajju");
  });

  it("recipient handle is used without double @", () => {
    const r = buildDmSuggestion(input({ recipientHandle: "rohan_fit" }));
    expect(r.reply).toContain("rohan_fit");
    expect(r.reply).not.toContain("@rohan_fit");
  });

  it("replies never exceed 500 characters", () => {
    const r = buildDmSuggestion(
      input({ triggerKeyword: "price", productTitle: "X".repeat(600) }),
    );
    expect(r.reply.length).toBeLessThanOrEqual(500);
  });

  it("never echoes ALL-CAPS shouting", () => {
    const r = buildDmSuggestion(
      input({ triggerKeyword: "link", currentBody: "SEND ME THE LINK RIGHT NOW PLEASE" }),
    );
    expect(r.reply).not.toContain("RIGHT NOW");
  });

  it("no income or guarantee claims in any suggestion", () => {
    const triggers = ["price", "how", "thanks", "hello", "scam", "buy"];
    for (const t of triggers) {
      const r = buildDmSuggestion(input({ triggerKeyword: t }));
      const low = r.reply.toLowerCase();
      expect(low).not.toContain("guaranteed");
      expect(low).not.toContain("you will earn");
      expect(low).not.toContain("risk-free");
      expect(low).not.toContain("100%");
    }
  });

  it("every suggestion carries at least one reasoning bullet", () => {
    const triggers = ["price", "how", "thanks", "hello", "scam"];
    for (const t of triggers) {
      const r = buildDmSuggestion(input({ triggerKeyword: t }));
      expect(r.reasons.length).toBeGreaterThanOrEqual(1);
      expect(r.reply.length).toBeGreaterThan(20);
    }
  });

  it("question intent includes link when available", () => {
    const r = buildDmSuggestion(input({ triggerKeyword: "how to use" }));
    expect(r.intent).toBe("question");
    expect(r.reply).toContain(LINK);
  });
});
