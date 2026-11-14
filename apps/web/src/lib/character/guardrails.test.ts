import { describe, expect, it } from "vitest";
import { buildDiscussReply, type DiscussContext } from "./discuss-core";
import { buildCommentReply } from "./replies-core";
import { buildDmSuggestion, type DmSuggestionInput } from "./dm-replies-core";

/**
 * Phase 5 Module C — Personality guardrails.
 *
 * Cross-engine adversarial suite: whatever the user throws at the
 * character (chat question, comment, DM), it must NEVER:
 *   1. project or promise earnings / future money
 *   2. claim results are guaranteed or risk-free
 *   3. fabricate numbers that were not in the provided context
 *   4. invent a link that was not provided
 *   5. quote a price
 *   6. present itself as a human or invent testimonials
 *   7. carry a fake "live" label (engine must stay rules-v1)
 *
 * These are invariants, not per-branch tests — if a future edit breaks
 * one anywhere, this suite should catch it.
 */

// ───────────────────────── shared contexts ─────────────────────────

const discussCtx = (over: Partial<DiscussContext> = {}): DiscussContext => ({
  characterName: "fit_ajju",
  niche: "fitness",
  tone: "friendly",
  autopilotLevel: "semi",
  paused: false,
  last7: { impressions: 12000, clicks: 340, conversions: 4, revenue: 42.5 },
  postsLast7: 5,
  topProducts: [
    { title: "Resistance Bands Pro", aiScore: 87, commissionValue: "8", commissionType: "percentage" },
  ],
  lastJournal: null,
  ...over,
});

const dmCtx = (over: Partial<DmSuggestionInput> = {}): DmSuggestionInput => ({
  triggerKeyword: "link",
  currentBody: "Here is the link: {{link}}",
  recipientHandle: "@fan_rohan",
  characterName: "fit_ajju",
  niche: "fitness",
  productTitle: "Resistance Bands Pro",
  linkUrl: "https://go.affiliateautopilot.app/abc123",
  ...over,
});

const CHAT_MESSAGES = [
  "kal kya post karein?",
  "how was performance?",
  "what did we earn?",
  "kitna kamaya hoga agle month?",
  "growth strategy banao",
  "how to setup autopilot",
  "guaranteed income milega kya?",
  "hello",
  "promise karo 10x hoga",
  "give me 100% results",
];

const COMMENT_BODIES = [
  "love this, great video!",
  "kitne ka hai ye?",
  "worst product, scam hai",
  "you are an idiot",
  "PLEASE ANSWER ME NOW",
  "will this make me rich?",
  "promise me it works",
  "random neutral comment",
  "show me guaranteed results",
  "how much do I need to pay?",
];

const DM_TRIGGERS = ["price", "how", "thanks", "hello", "scam", "buy", "link", "guaranteed", "100% result", "kitna kam"];

// ───────────────────────── 1+2. no money promises ─────────────────────────

const MONEY_PROMISE = /(you('| wi)ll (earn|make|get)|guaranteed|risk[- ]free|passive income|100% (profit|return|result)|earn \$|make \$\d|profits? (are |will )?assured)/i;

describe("guardrail: never promises money or results", () => {
  it("chat replies never promise earnings or guaranteed results", () => {
    for (const msg of CHAT_MESSAGES) {
      const r = buildDiscussReply(discussCtx(), msg);
      expect(r.reply, `chat: ${msg}`).not.toMatch(MONEY_PROMISE);
      for (const line of r.reasoning) {
        expect(line, `reasoning: ${msg}`).not.toMatch(MONEY_PROMISE);
      }
    }
  });

  it("chat replies with zero data never contain a dollar figure", () => {
    const broke = discussCtx({
      last7: { impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
      postsLast7: 0,
      topProducts: [],
    });
    for (const msg of CHAT_MESSAGES) {
      const r = buildDiscussReply(broke, msg);
      // earnings intent in a zero-data workspace must not print any $
      if (msg.includes("earn") || msg.includes("kamaya")) {
        expect(r.reply, `zero-data earnings: ${msg}`).not.toMatch(/\$\d/);
      }
    }
  });

  it("comment replies never promise money or results", () => {
    for (const body of COMMENT_BODIES) {
      for (const mode of ["manual", "semi", "auto"] as const) {
        const r = buildCommentReply(
          { body, authorHandle: "someone", characterName: "fit_ajju", niche: "fitness" },
          mode,
        );
        expect(r.reply, `comment: ${body}`).not.toMatch(MONEY_PROMISE);
      }
    }
  });

  it("DM suggestions never promise money or results", () => {
    for (const trigger of DM_TRIGGERS) {
      const r = buildDmSuggestion(dmCtx({ triggerKeyword: trigger }));
      expect(r.reply, `dm: ${trigger}`).not.toMatch(MONEY_PROMISE);
    }
  });
});

// ───────────────────────── 3. no fabricated numbers ─────────────────────────

describe("guardrail: no numbers that were not in context", () => {
  it("chat performance reply only prints context numbers", () => {
    const r = buildDiscussReply(discussCtx(), "how was performance?");
    const digits = r.reply.match(/\d[\d,]*\.?\d*/g) ?? [];
    const allowed = ["12000", "340", "4", "5", "42.5", "0.00", "1", "2", "3", "7"];
    for (const d of digits) {
      const bare = d.replace(/,/g, "");
      expect(
        allowed.some((a) => bare === a || bare.startsWith(a)),
        `unexpected number "${d}" in: ${r.reply}`,
      ).toBe(true);
    }
  });

  it("comment replies contain no numeric claims at all", () => {
    for (const body of COMMENT_BODIES) {
      const r = buildCommentReply(
        { body, authorHandle: "someone", characterName: "fit_ajju", niche: "fitness" },
        "semi",
      );
      // replies must not carry stats/percentages the character cannot know
      expect(r.reply, `comment: ${body}`).not.toMatch(/\d+(\.\d+)?%/);
      expect(r.reply, `comment: ${body}`).not.toMatch(/\$\d/);
    }
  });

  it("DM suggestions contain no percentages or dollar figures", () => {
    for (const trigger of DM_TRIGGERS) {
      const r = buildDmSuggestion(dmCtx({ triggerKeyword: trigger }));
      expect(r.reply, `dm: ${trigger}`).not.toMatch(/\d+(\.\d+)?%/);
      expect(r.reply, `dm: ${trigger}`).not.toMatch(/\$\d/);
    }
  });
});

// ───────────────────────── 4. no invented links ─────────────────────────

describe("guardrail: only real tracked links are ever shown", () => {
  it("DM suggestion without linkUrl contains no URL", () => {
    for (const trigger of DM_TRIGGERS) {
      const r = buildDmSuggestion(dmCtx({ triggerKeyword: trigger, linkUrl: null }));
      expect(r.reply, `dm(no link): ${trigger}`).not.toMatch(/https?:\/\//);
      expect(r.reply, `dm(no link): ${trigger}`).not.toMatch(/www\./i);
    }
  });

  it("DM suggestion with linkUrl only shows that exact URL", () => {
    const link = "https://go.affiliateautopilot.app/realcode";
    for (const trigger of DM_TRIGGERS) {
      const r = buildDmSuggestion(dmCtx({ triggerKeyword: trigger, linkUrl: link }));
      const urls = r.reply.match(/https?:\/\/[^\s]+/g) ?? [];
      for (const u of urls) expect(u).toBe(link);
    }
  });

  it("chat and comment replies never contain URLs", () => {
    for (const msg of CHAT_MESSAGES) {
      expect(buildDiscussReply(discussCtx(), msg).reply).not.toMatch(/https?:\/\//);
    }
    for (const body of COMMENT_BODIES) {
      const r = buildCommentReply(
        { body, authorHandle: "someone", characterName: "fit_ajju", niche: "fitness" },
        "semi",
      );
      expect(r.reply, `comment: ${body}`).not.toMatch(/https?:\/\//);
    }
  });
});

// ───────────────────────── 5. no price quotes ─────────────────────────

describe("guardrail: prices are never quoted", () => {
  it("buy-intent comment never includes a price", () => {
    const bodies = ["kitne ka hai?", "price batao", "how much does it cost?", "order karna hai"];
    for (const body of bodies) {
      const r = buildCommentReply(
        { body, authorHandle: "buyer", characterName: "fit_ajju", niche: "fitness" },
        "semi",
      );
      expect(r.reply, body).not.toMatch(/\$\d/);
      expect(r.reply, body).not.toMatch(/\d+\s*(USD|dollars|rupees|pees)/i);
    }
  });

  it("buy-intent DM never includes a price", () => {
    for (const trigger of ["price", "cost", "kitne ka", "how much"]) {
      const r = buildDmSuggestion(dmCtx({ triggerKeyword: trigger }));
      expect(r.reply, trigger).not.toMatch(/\$\d/);
      expect(r.reply.toLowerCase(), trigger).not.toMatch(/only \$|just \$|\d+ dollars/);
    }
  });

  it("even a poisoned product title with a price gets scrubbed", () => {
    const r = buildDmSuggestion(
      dmCtx({ triggerKeyword: "buy", productTitle: "Super Course $99" }),
    );
    expect(r.reply).not.toMatch(/\$\d/);
  });
});

// ───────────────────────── 6. no fake persona / testimonials ─────────────────────────

describe("guardrail: no invented social proof or humanity claims", () => {
  const FAKE_SOCIAL = /(as (seen|featured) in|top (rated|seller) on|my (thousands|millions) of|testimonial|50,000\+ (users|customers)|celebrities)/i;

  it("no engine invents press, ratings, or crowd claims", () => {
    for (const msg of CHAT_MESSAGES) {
      const r = buildDiscussReply(discussCtx(), msg);
      expect(r.reply, `chat: ${msg}`).not.toMatch(FAKE_SOCIAL);
      for (const line of r.reasoning) expect(line).not.toMatch(FAKE_SOCIAL);
    }
    for (const body of COMMENT_BODIES) {
      const r = buildCommentReply(
        { body, authorHandle: "x", characterName: "fit_ajju", niche: "fitness" },
        "semi",
      );
      expect(r.reply, `comment: ${body}`).not.toMatch(FAKE_SOCIAL);
    }
    for (const trigger of DM_TRIGGERS) {
      expect(buildDmSuggestion(dmCtx({ triggerKeyword: trigger })).reply).not.toMatch(FAKE_SOCIAL);
    }
  });

  it("character never pretends to be a human operator", () => {
    const HUMAN_CLAIM = /(i am a real person|i'm a real person|as a human|personally, i (am|have))/i;
    for (const msg of CHAT_MESSAGES) {
      expect(buildDiscussReply(discussCtx(), msg).reply).not.toMatch(HUMAN_CLAIM);
    }
    for (const trigger of DM_TRIGGERS) {
      expect(buildDmSuggestion(dmCtx({ triggerKeyword: trigger })).reply).not.toMatch(HUMAN_CLAIM);
    }
  });
});

// ───────────────────────── 7. honest engine labels ─────────────────────────

describe("guardrail: engine labels stay honest", () => {
  it("chat engine is always rules-v1 (never claimed as LLM/live)", () => {
    for (const msg of CHAT_MESSAGES) {
      expect(buildDiscussReply(discussCtx(), msg).engine).toBe("rules-v1");
    }
  });

  it("DM engine is always rules-v1", () => {
    for (const trigger of DM_TRIGGERS) {
      expect(buildDmSuggestion(dmCtx({ triggerKeyword: trigger })).engine).toBe("rules-v1");
    }
  });

  it("no reply text claims to be an LLM, GPT, or live AI", () => {
    const FAKE_AI = /(powered by gpt|as an llm|i am (a )?large language model|live ai)/i;
    for (const msg of CHAT_MESSAGES) {
      expect(buildDiscussReply(discussCtx(), msg).reply).not.toMatch(FAKE_AI);
    }
    for (const trigger of DM_TRIGGERS) {
      expect(buildDmSuggestion(dmCtx({ triggerKeyword: trigger })).reply).not.toMatch(FAKE_AI);
    }
  });
});

// ───────────────────────── abusive content never engaged ─────────────────────────

describe("guardrail: abuse is never engaged with", () => {
  it("abusive comments get zero reply text", () => {
    const abuses = ["you are an idiot", "stupid moron", "fuck you", "chutiya ho tum"];
    for (const body of abuses) {
      const r = buildCommentReply(
        { body, authorHandle: "troll", characterName: "fit_ajju", niche: "fitness" },
        "auto",
      );
      expect(r.blocked, body).toBe(true);
      expect(r.reply, body).toBe("");
      expect(r.autoSend, body).toBe(false);
    }
  });

  it("abusive DM triggers get a brief close with no link and no pitch", () => {
    for (const trigger of ["idiot", "moron", "fuck", "chutiya"]) {
      const r = buildDmSuggestion(dmCtx({ triggerKeyword: trigger }));
      expect(r.intent, trigger).toBe("negative");
      expect(r.reply, trigger).not.toContain("go.affiliateautopilot.app");
      expect(r.reply.toLowerCase(), trigger).not.toContain("buy");
    }
  });
});
