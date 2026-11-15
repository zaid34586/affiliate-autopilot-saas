/**
 * Phase 7 — Referral Program Core Tests
 */

import { describe, it, expect } from "vitest";
import {
  generateReferralCode,
  isValidReferralCode,
  computeCommission,
  totalEarned,
  payoutEligibleCents,
  computeReferralFunnel,
  mergeAttributionStatus,
  qualifiesForCreditBonus,
  DEFAULT_COMMISSION_SETTINGS,
} from "./referrals-core";

describe("generateReferralCode", () => {
  it("generates codes of requested length", () => {
    expect(generateReferralCode(6)).toHaveLength(6);
    expect(generateReferralCode(8)).toHaveLength(8);
  });

  it("uses only allowed characters", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateReferralCode(6)).toMatch(/^[A-HJ-NP-Z2-9]+$/);
    }
  });

  it("generates unique codes", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateReferralCode(8)));
    expect(codes.size).toBe(100);
  });
});

describe("isValidReferralCode", () => {
  it("accepts valid codes", () => {
    expect(isValidReferralCode("K7XQ2M")).toBe(true);
    expect(isValidReferralCode("ABCD")).toBe(true);
  });

  it("rejects invalid codes", () => {
    expect(isValidReferralCode("")).toBe(false);
    expect(isValidReferralCode("abc123")).toBe(false); // lowercase
    expect(isValidReferralCode("ABC0")).toBe(false); // 0 not allowed
    expect(isValidReferralCode("ABC1")).toBe(false); // 1 not allowed
    expect(isValidReferralCode("ABC!")).toBe(false);
  });
});

describe("computeCommission (20% recurring)", () => {
  it("computes 20% of payment", () => {
    expect(computeCommission(2900, 20)).toBe(580); // $29 → $5.80
    expect(computeCommission(7900, 20)).toBe(1580); // $79 → $15.80
    expect(computeCommission(24900, 20)).toBe(4980); // $249 → $49.80
  });

  it("rounds down to whole cents", () => {
    expect(computeCommission(1001, 20)).toBe(200); // 200.2 → 200
    expect(computeCommission(999, 15)).toBe(149); // 149.85 → 149
  });

  it("returns 0 for zero/negative inputs", () => {
    expect(computeCommission(0, 20)).toBe(0);
    expect(computeCommission(-100, 20)).toBe(0);
    expect(computeCommission(1000, 0)).toBe(0);
  });

  it("supports custom pct", () => {
    expect(computeCommission(10000, 10)).toBe(1000);
    expect(computeCommission(10000, 50)).toBe(5000);
  });
});

describe("totalEarned", () => {
  it("sums non-reversed commissions", () => {
    const c = [
      { amountCents: 580, status: "credited" },
      { amountCents: 1580, status: "pending" },
      { amountCents: 100, status: "reversed" },
    ];
    expect(totalEarned(c)).toBe(2160);
  });
});

describe("payoutEligibleCents", () => {
  it("blocks payout below minimum", () => {
    const r = payoutEligibleCents(
      [{ amountCents: 3000, status: "credited" }],
      DEFAULT_COMMISSION_SETTINGS,
    );
    expect(r.canPayout).toBe(false);
    expect(r.eligibleCents).toBe(0);
    expect(r.blockedCents).toBe(3000);
  });

  it("allows payout at minimum", () => {
    const r = payoutEligibleCents(
      [{ amountCents: 5000, status: "credited" }],
      DEFAULT_COMMISSION_SETTINGS,
    );
    expect(r.canPayout).toBe(true);
    expect(r.eligibleCents).toBe(5000);
    expect(r.blockedCents).toBe(0);
  });

  it("ignores pending commissions", () => {
    const r = payoutEligibleCents(
      [{ amountCents: 10000, status: "pending" }],
      DEFAULT_COMMISSION_SETTINGS,
    );
    expect(r.canPayout).toBe(false);
    expect(r.blockedCents).toBe(0);
  });
});

describe("computeReferralFunnel", () => {
  it("computes conversion percentages", () => {
    const f = computeReferralFunnel({ clicks: 200, signups: 50, conversions: 10 });
    expect(f.clickToSignupPct).toBe(25);
    expect(f.signupToPaidPct).toBe(20);
    expect(f.overallPct).toBe(5);
  });

  it("handles zero denominators", () => {
    const f = computeReferralFunnel({ clicks: 0, signups: 0, conversions: 0 });
    expect(f.clickToSignupPct).toBe(0);
    expect(f.signupToPaidPct).toBe(0);
    expect(f.overallPct).toBe(0);
  });
});

describe("mergeAttributionStatus", () => {
  it("upgrades forward", () => {
    expect(mergeAttributionStatus("clicked", "signed_up")).toBe("signed_up");
    expect(mergeAttributionStatus("signed_up", "paid")).toBe("paid");
    expect(mergeAttributionStatus("clicked", "paid")).toBe("paid");
  });

  it("never downgrades", () => {
    expect(mergeAttributionStatus("paid", "signed_up")).toBe("paid");
    expect(mergeAttributionStatus("paid", "clicked")).toBe("paid");
    expect(mergeAttributionStatus("signed_up", "clicked")).toBe("signed_up");
  });
});

describe("qualifiesForCreditBonus", () => {
  it("qualifies on first transition to paid", () => {
    expect(qualifiesForCreditBonus("clicked", "paid")).toBe(true);
    expect(qualifiesForCreditBonus("signed_up", "paid")).toBe(true);
  });

  it("does not qualify if already paid", () => {
    expect(qualifiesForCreditBonus("paid", "paid")).toBe(false);
  });

  it("does not qualify for non-paid transitions", () => {
    expect(qualifiesForCreditBonus("clicked", "signed_up")).toBe(false);
  });
});
