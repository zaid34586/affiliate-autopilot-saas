/**
 * Phase 7 — Email Lifecycle Core Tests
 */

import { describe, it, expect } from "vitest";
import {
  deriveLifecycleState,
  decideNextEmail,
  buildEmailContent,
  TEMPLATE_COOLDOWN_HOURS,
  inSendWindow,
  nextSendTime,
  DEFAULT_SEND_WINDOW,
  LifecycleSignals,
  EmailTemplate,
} from "./email-core";

const base: LifecycleSignals = {
  hoursSinceSignup: 100,
  onboardingDone: false,
  plan: "free",
  daysUntilPeriodEnd: null,
  daysSinceActive: 0,
  lastTemplate: null,
  hoursSinceLastEmail: null,
};

describe("deriveLifecycleState", () => {
  it("new = < 24h since signup", () => {
    expect(deriveLifecycleState({ ...base, hoursSinceSignup: 5 })).toBe("new");
    expect(deriveLifecycleState({ ...base, hoursSinceSignup: 30 })).not.toBe("new");
  });

  it("dormant ≥ 30d inactive, at_risk ≥ 14d", () => {
    expect(deriveLifecycleState({ ...base, daysSinceActive: 35 })).toBe("dormant");
    expect(deriveLifecycleState({ ...base, daysSinceActive: 20 })).toBe("at_risk");
    expect(deriveLifecycleState({ ...base, daysSinceActive: 5 })).toBe("unactivated");
    expect(deriveLifecycleState({ ...base, daysSinceActive: 5, onboardingDone: true })).toBe("activated");
  });

  it("unactivated when onboarding incomplete (after 24h)", () => {
    expect(deriveLifecycleState({ ...base, hoursSinceSignup: 40, onboardingDone: false })).toBe("unactivated");
    expect(deriveLifecycleState({ ...base, hoursSinceSignup: 40, onboardingDone: true })).toBe("activated");
  });

  it("paid plan → paid_active, trialing within 3d of period end", () => {
    expect(deriveLifecycleState({ ...base, plan: "pro", daysUntilPeriodEnd: 20 })).toBe("paid_active");
    expect(deriveLifecycleState({ ...base, plan: "pro", daysUntilPeriodEnd: 2 })).toBe("trialing");
    // inactivity beats plan state
    expect(deriveLifecycleState({ ...base, plan: "pro", daysUntilPeriodEnd: 20, daysSinceActive: 40 })).toBe("dormant");
  });

  it("dormant/at_risk beats everything except the 24h new window", () => {
    expect(deriveLifecycleState({ ...base, hoursSinceSignup: 10, daysSinceActive: 40 })).toBe("new");
  });
});

describe("decideNextEmail", () => {
  it("sends welcome to new users", () => {
    const d = decideNextEmail({ ...base, hoursSinceSignup: 5 });
    expect(d.template).toBe("welcome");
  });

  it("does not resend welcome", () => {
    const d = decideNextEmail({ ...base, hoursSinceSignup: 5, lastTemplate: "welcome" });
    expect(d.template).toBeNull();
  });

  it("sends activation nudge after 48h when onboarding incomplete", () => {
    const d = decideNextEmail({ ...base, hoursSinceSignup: 50, onboardingDone: false });
    expect(d.template).toBe("activation_nudge");
  });

  it("no activation nudge before 48h", () => {
    const d = decideNextEmail({ ...base, hoursSinceSignup: 30, onboardingDone: false });
    expect(d.template).toBeNull();
  });

  it("sends trial_ending within 3 days", () => {
    const d = decideNextEmail({ ...base, plan: "pro", daysUntilPeriodEnd: 3, daysSinceActive: 0 });
    expect(d.template).toBe("trial_ending");
  });

  it("no trial_ending when period far away", () => {
    const d = decideNextEmail({ ...base, plan: "pro", daysUntilPeriodEnd: 20, daysSinceActive: 0 });
    expect(d.template).toBeNull();
  });

  it("sends payment_failed when period ended", () => {
    const d = decideNextEmail({ ...base, plan: "pro", daysUntilPeriodEnd: -1, daysSinceActive: 0 });
    expect(d.template).toBe("payment_failed");
  });

  it("payment_failed has priority over trial_ending", () => {
    const d = decideNextEmail({ ...base, plan: "pro", daysUntilPeriodEnd: -1, daysSinceActive: 2 });
    expect(d.template).toBe("payment_failed");
  });

  it("sends winback when inactive 14d+", () => {
    const d = decideNextEmail({ ...base, daysSinceActive: 20, lastTemplate: null });
    expect(d.template).toBe("winback");
  });

  it("respects winback cooldown (7 days)", () => {
    const d = decideNextEmail({
      ...base,
      daysSinceActive: 20,
      lastTemplate: "winback",
      hoursSinceLastEmail: 24,
    });
    expect(d.template).toBeNull();

    const d2 = decideNextEmail({
      ...base,
      daysSinceActive: 20,
      lastTemplate: "winback",
      hoursSinceLastEmail: 24 * 8,
    });
    expect(d2.template).toBe("winback");
  });

  it("respects activation_nudge cooldown (72h)", () => {
    const d = decideNextEmail({
      ...base,
      hoursSinceSignup: 100,
      onboardingDone: false,
      lastTemplate: "activation_nudge",
      hoursSinceLastEmail: 24,
    });
    expect(d.template).toBeNull();
  });

  it("healthy active paying user gets nothing", () => {
    const d = decideNextEmail({ ...base, plan: "pro", daysUntilPeriodEnd: 20, daysSinceActive: 0, onboardingDone: true, hoursSinceSignup: 100 });
    expect(d.template).toBeNull();
  });

  it("active free user who finished onboarding gets nothing", () => {
    const d = decideNextEmail({ ...base, hoursSinceSignup: 100, onboardingDone: true, daysSinceActive: 0 });
    expect(d.template).toBeNull();
  });

  it("cooldown constants exist for every template", () => {
    const templates: EmailTemplate[] = ["welcome", "activation_nudge", "trial_ending", "winback", "payment_failed"];
    for (const t of templates) {
      expect(typeof TEMPLATE_COOLDOWN_HOURS[t]).toBe("number");
    }
  });
});

describe("buildEmailContent", () => {
  const ctx = { name: "Rohit Sharma", appUrl: "https://example.com/" };

  it("builds welcome with quickstart CTA", () => {
    const c = buildEmailContent("welcome", ctx);
    expect(c.subject).toContain("Welcome");
    expect(c.bodyMd).toContain("Rohit"); // first name
    expect(c.ctaUrl).toBe("https://example.com/onboarding"); // trailing slash stripped
  });

  it("trial_ending includes days remaining", () => {
    const c = buildEmailContent("trial_ending", { ...ctx, daysUntilPeriodEnd: 2 });
    expect(c.bodyMd).toContain("2 days");
    expect(c.subject).toContain("2 days");
  });

  it("trial_ending tomorrow wording at 1 day", () => {
    const c = buildEmailContent("trial_ending", { ...ctx, daysUntilPeriodEnd: 1 });
    expect(c.subject).toContain("tomorrow");
  });

  it("winback includes inactive days", () => {
    const c = buildEmailContent("winback", { ...ctx, daysSinceActive: 21 });
    expect(c.bodyMd).toContain("21 days");
  });

  it("handles missing name", () => {
    const c = buildEmailContent("welcome", { ...ctx, name: null });
    expect(c.bodyMd).toContain("Hey there");
  });

  it("every template has subject/body/cta", () => {
    const templates: EmailTemplate[] = ["welcome", "activation_nudge", "trial_ending", "winback", "payment_failed"];
    for (const t of templates) {
      const c = buildEmailContent(t, ctx);
      expect(c.subject.length).toBeGreaterThan(10);
      expect(c.bodyMd.length).toBeGreaterThan(50);
      expect(c.ctaUrl.startsWith("https://")).toBe(true);
    }
  });
});

describe("send window", () => {
  it("inside 9-20 window", () => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    expect(inSendWindow(d)).toBe(true);
  });

  it("outside window early morning", () => {
    const d = new Date();
    d.setHours(5, 0, 0, 0);
    expect(inSendWindow(d)).toBe(false);
  });

  it("outside window late night", () => {
    const d = new Date();
    d.setHours(22, 0, 0, 0);
    expect(inSendWindow(d)).toBe(false);
  });

  it("boundary: start inclusive, end exclusive", () => {
    const start = new Date();
    start.setHours(DEFAULT_SEND_WINDOW.startHour, 0, 0, 0);
    const end = new Date();
    end.setHours(DEFAULT_SEND_WINDOW.endHour, 0, 0, 0);
    expect(inSendWindow(start)).toBe(true);
    expect(inSendWindow(end)).toBe(false);
  });

  it("nextSendTime returns same time inside window", () => {
    const d = new Date();
    d.setHours(12, 30, 0, 0);
    expect(nextSendTime(d)).toBe(d);
  });

  it("nextSendTime rolls to 9 AM next day when past window", () => {
    const d = new Date("2026-11-15T22:30:00");
    const next = nextSendTime(d);
    expect(next.getHours()).toBe(DEFAULT_SEND_WINDOW.startHour);
    expect(next.getDate()).toBe(16);
  });

  it("nextSendTime goes to 9 AM same day when before window", () => {
    const d = new Date("2026-11-15T05:00:00");
    const next = nextSendTime(d);
    expect(next.getHours()).toBe(DEFAULT_SEND_WINDOW.startHour);
    expect(next.getDate()).toBe(15);
  });
});
