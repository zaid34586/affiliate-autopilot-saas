import { describe, expect, it } from "vitest";
import {
  buildCommentReply,
  classifySentiment,
  type CommentApprovalMode,
} from "./replies-core";

const base = {
  authorHandle: "rohan_fit",
  characterName: "fit_ajju",
  niche: "fitness",
};

function reply(body: string, mode: CommentApprovalMode = "semi") {
  return buildCommentReply({ ...base, body }, mode);
}

describe("classifySentiment", () => {
  it("detects positive comments", () => {
    expect(classifySentiment("love this, great video!")).toBe("positive");
    expect(classifySentiment("bahut badhiya hai")).toBe("positive");
  });

  it("detects negative comments", () => {
    expect(classifySentiment("this is a scam")).toBe("negative");
    expect(classifySentiment("bakwas product")).toBe("negative");
  });

  it("defaults to neutral", () => {
    expect(classifySentiment("kitne ka hai?")).toBe("neutral");
    expect(classifySentiment("hello")).toBe("neutral");
  });
});

describe("buildCommentReply — guardrails", () => {
  it("blocks abusive comments entirely (no reply generated)", () => {
    const r = reply("you are an idiot, shut up");
    expect(r.blocked).toBe(true);
    expect(r.reply).toBe("");
    expect(r.autoSend).toBe(false);
    expect(r.reasons.join(" ")).toContain("abusive");
  });

  it("never quotes a price on buy-intent comments", () => {
    const r = reply("kitne ka hai ye? price batao");
    expect(r.reply).toContain("linked in the post");
    expect(r.reply).not.toMatch(/\$\d/);
    expect(r.reply).not.toMatch(/\d+%? off/i);
  });

  it("negative sentiment gets a polite decline, never a pitch", () => {
    const r = reply("worst product, didn't work for me");
    expect(r.sentiment).toBe("negative");
    expect(r.reply.toLowerCase()).toContain("sorry");
    expect(r.reply.toLowerCase()).not.toContain("buy");
    expect(r.autoSend).toBe(false);
  });

  it("auto mode still holds negative replies for review", () => {
    const r = reply("this looks like a fraud", "auto");
    expect(r.autoSend).toBe(false);
    expect(r.reasons.join(" ")).toContain("held for review");
  });

  it("auto mode sends safe positive replies without approval", () => {
    const r = reply("love it, thanks!", "auto");
    expect(r.autoSend).toBe(true);
    expect(r.blocked).toBe(false);
  });

  it("semi/manual modes never auto-send", () => {
    expect(reply("love it!", "semi").autoSend).toBe(false);
    expect(reply("love it!", "manual").autoSend).toBe(false);
    expect(reply("love it!", "semi").reasons.join(" ")).toContain("approval");
  });

  it("mode off is handled at the DB layer, not here — semi still replies", () => {
    const r = reply("nice one", "semi");
    expect(r.reply.length).toBeGreaterThan(10);
  });

  it("replies never exceed 300 characters", () => {
    const r = reply("price cost buy discount coupon where to order link");
    expect(r.reply.length).toBeLessThanOrEqual(300);
  });

  it("never echoes all-caps shouting", () => {
    const r = reply("PLEASE ANSWER ME RIGHT NOW");
    expect(r.reply).not.toContain("PLEASE");
    expect(r.reply).not.toMatch(/[A-Z]{4,}/);
  });

  it("always provides at least one decision reason", () => {
    const samples = [
      "great video!",
      "kitne ka hai?",
      "worst ever",
      "random comment",
    ];
    for (const s of samples) {
      const r = reply(s);
      expect(r.reasons.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("no income or guarantee claims in any generated reply", () => {
    const samples = [
      "great video!",
      "kitne ka hai?",
      "worst ever",
      "random comment",
      "love it thanks",
    ];
    for (const s of samples) {
      const r = reply(s);
      const low = r.reply.toLowerCase();
      expect(low).not.toContain("guaranteed");
      expect(low).not.toContain("you will earn");
      expect(low).not.toContain("risk-free");
      expect(low).not.toContain("100%");
    }
  });
});
