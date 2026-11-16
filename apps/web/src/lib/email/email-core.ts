/**
 * Phase 7 — Email Lifecycle Core (pure logic).
 *
 * Lifecycle: welcome → activation → trial ending → winback.
 * State machine decides which template (if any) a user should get,
 * based on their signals. All timing rules are pure + testable.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

// ───────────────────────── TYPES ─────────────────────────

export type EmailTemplate =
  | "welcome"
  | "activation_nudge"
  | "trial_ending"
  | "winback"
  | "payment_failed";

export type UserLifecycleState =
  | "new" // signed up, < 1 day
  | "unactivated" // > 2 days, onboarding not done
  | "activated" // onboarding done, free plan
  | "trialing" // paid plan, period ending soon
  | "paid_active" // paid, healthy
  | "at_risk" // paid/free but inactive 14d+
  | "dormant"; // inactive 30d+

export interface LifecycleSignals {
  /** hours since signup */
  hoursSinceSignup: number;
  onboardingDone: boolean;
  plan: "free" | "starter" | "pro" | "agency";
  /** days until current period end; null if no paid period */
  daysUntilPeriodEnd: number | null;
  /** days since last product activity; null = never active */
  daysSinceActive: number | null;
  /** last email template sent (from email log) */
  lastTemplate?: EmailTemplate | null;
  /** last time an email of lastTemplate was sent (hours ago) */
  hoursSinceLastEmail?: number | null;
}

// ───────────────────────── LIFELINE STATE ─────────────────────────

/**
 * Derive lifecycle state from signals.
 */
export function deriveLifecycleState(s: LifecycleSignals): UserLifecycleState {
  if (s.hoursSinceSignup < 24) return "new";

  if (s.daysSinceActive != null && s.daysSinceActive >= 30) return "dormant";
  if (s.daysSinceActive != null && s.daysSinceActive >= 14) return "at_risk";

  const isPaid = s.plan !== "free";

  if (isPaid) {
    if (s.daysUntilPeriodEnd != null && s.daysUntilPeriodEnd <= 3) return "trialing";
    return "paid_active";
  }

  if (!s.onboardingDone) return "unactivated";
  return "activated";
}

// ───────────────────────── TEMPLATE SELECTION ─────────────────────────

export interface EmailDecision {
  /** null = send nothing */
  template: EmailTemplate | null;
  reason: string;
}

/** Minimum hours between sends of the same template (cooldown). */
export const TEMPLATE_COOLDOWN_HOURS: Record<EmailTemplate, number> = {
  welcome: 0, // once only
  activation_nudge: 72, // max once every 3 days
  trial_ending: 24,
  winback: 168, // weekly max
  payment_failed: 48,
};

/**
 * Decide the next email for a user (or null).
 * Priority: payment_failed > trial_ending > welcome > activation_nudge > winback.
 */
export function decideNextEmail(s: LifecycleSignals): EmailDecision {
  const cooledDown = (t: EmailTemplate) =>
    s.lastTemplate !== t || (s.hoursSinceLastEmail ?? Infinity) >= TEMPLATE_COOLDOWN_HOURS[t];

  const state = deriveLifecycleState(s);

  // 1. Payment failed (high priority)
  // (signal carried via plan + period end in past — handled by caller; keep rule here)
  if (state === "trialing" && s.daysUntilPeriodEnd != null && s.daysUntilPeriodEnd <= 0) {
    if (cooledDown("payment_failed")) {
      return { template: "payment_failed", reason: "billing period ended / payment due" };
    }
    return { template: null, reason: "payment_failed cooldown active" };
  }

  // 2. Trial ending soon (1-3 days left)
  if (state === "trialing" && s.daysUntilPeriodEnd != null && s.daysUntilPeriodEnd <= 3) {
    if (cooledDown("trial_ending")) {
      return { template: "trial_ending", reason: `${s.daysUntilPeriodEnd}d until period end` };
    }
    return { template: null, reason: "trial_ending cooldown active" };
  }

  // 3. Welcome (first 24h, not yet sent)
  if (state === "new" && s.lastTemplate !== "welcome") {
    return { template: "welcome", reason: "new signup" };
  }

  // 4. Activation nudge (unactivated after 48h)
  if (state === "unactivated" && s.hoursSinceSignup >= 48) {
    if (cooledDown("activation_nudge")) {
      return { template: "activation_nudge", reason: "onboarding incomplete after 48h" };
    }
    return { template: null, reason: "activation_nudge cooldown active" };
  }

  // 5. Winback (at risk / dormant)
  if ((state === "at_risk" || state === "dormant") && cooledDown("winback")) {
    return { template: "winback", reason: `inactive ${s.daysSinceActive}d` };
  }

  return { template: null, reason: `no email for state ${state}` };
}

// ───────────────────────── CONTENT ─────────────────────────

export interface EmailContent {
  subject: string;
  previewText: string;
  bodyMd: string;
  ctaText: string;
  ctaUrl: string;
}

export interface ContentContext {
  name?: string | null;
  appUrl: string;
  daysUntilPeriodEnd?: number | null;
  daysSinceActive?: number | null;
}

/** Build the email content for a template. */
export function buildEmailContent(template: EmailTemplate, ctx: ContentContext): EmailContent {
  const name = ctx.name?.split(" ")[0] || "there";
  const appUrl = ctx.appUrl.replace(/\/$/, "");

  switch (template) {
    case "welcome":
      return {
        subject: "Welcome to Affiliate Autopilot — your first video in 5 minutes",
        previewText: "Set up your brand profile and render your first affiliate video.",
        bodyMd: [
          `Hey ${name},`,
          "",
          "Welcome aboard! You're one step away from your first AI-generated affiliate video.",
          "",
          "**Your 3-step quickstart:**",
          "1. Add your niche + brand voice (Brand Profile)",
          "2. Connect an affiliate product",
          "3. Hit Render — we handle script, video, and posting",
          "",
          "Free plan includes 2 trial videos. No card needed.",
        ].join("\n"),
        ctaText: "Finish setup",
        ctaUrl: `${appUrl}/onboarding`,
      };

    case "activation_nudge":
      return {
        subject: "Your workspace is waiting (2 trial videos inside)",
        previewText: "You signed up but haven't rendered a video yet.",
        bodyMd: [
          `Hey ${name},`,
          "",
          "Your workspace is set up but still empty — let's fix that.",
          "",
          "You have **2 free trial videos** ready to go. Pick a product, and our AI writes the script, renders the video, and schedules the post.",
          "",
          "Takes about 5 minutes.",
        ].join("\n"),
        ctaText: "Create your first video",
        ctaUrl: `${appUrl}/dashboard/videos`,
      };

    case "trial_ending": {
      const days = ctx.daysUntilPeriodEnd ?? 3;
      return {
        subject: days <= 1 ? "Your plan renews tomorrow — action needed" : `Your plan renews in ${days} days`,
        previewText: "Keep your autopilot running without interruption.",
        bodyMd: [
          `Hey ${name},`,
          "",
          days <= 1
            ? "Your current billing period ends **tomorrow**."
            : `Your current billing period ends in **${days} days**.`,
          "",
          "To keep autopilot posting, DM engine replies, and video renders running, make sure your payment method is current.",
          "",
          "Questions about billing? Just reply to this email.",
        ].join("\n"),
        ctaText: "Review billing",
        ctaUrl: `${appUrl}/dashboard/settings`,
      };
    }

    case "winback": {
      const days = ctx.daysSinceActive ?? 14;
      return {
        subject: `We miss you — ${days} days of growth are waiting`,
        previewText: "Your autopilot has been idle. Reactivate in one click.",
        bodyMd: [
          `Hey ${name},`,
          "",
          `It's been ${days} days since you last logged in. Your affiliate content machine is idle — that's clicks and commissions you're missing.`,
          "",
          "**Here's what changed while you were away:**",
          "- New video templates and trending audio",
          "- DM Sales Engine with smart triggers",
          "- AI Command Center with weekly insights",
          "",
          "Come back and your workspace is exactly as you left it.",
        ].join("\n"),
        ctaText: "Reactivate my autopilot",
        ctaUrl: `${appUrl}/dashboard`,
      };
    }

    case "payment_failed":
      return {
        subject: "Payment failed — your autopilot is paused",
        previewText: "We couldn't process your last payment.",
        bodyMd: [
          `Hey ${name},`,
          "",
          "We couldn't process your latest payment. Your autopilot is paused until billing is updated.",
          "",
          "Update your card to resume posting, DM replies, and video renders.",
        ].join("\n"),
        ctaText: "Update payment method",
        ctaUrl: `${appUrl}/dashboard/settings`,
      };
  }
}

// ───────────────────────── SCHEDULE ─────────────────────────

export interface SendWindow {
  /** local hour (0-23) before which sends are held */
  startHour: number;
  /** local hour (0-23) after which sends are held to next day */
  endHour: number;
}

/** Default send window: 9 AM – 8 PM (recipient's tz). */
export const DEFAULT_SEND_WINDOW: SendWindow = { startHour: 9, endHour: 20 };

/** Whether a send time falls inside the window. */
export function inSendWindow(date: Date, window: SendWindow = DEFAULT_SEND_WINDOW): boolean {
  const h = date.getHours();
  return h >= window.startHour && h < window.endHour;
}

/** Next send time if outside window (next window start). */
export function nextSendTime(date: Date, window: SendWindow = DEFAULT_SEND_WINDOW): Date {
  if (inSendWindow(date, window)) return date;
  const next = new Date(date);
  if (date.getHours() < window.startHour) {
    next.setHours(window.startHour, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(window.startHour, 0, 0, 0);
  }
  return next;
}

// ───────────────────────── UNSUBSCRIBE SIGNING ─────────────────────────
// Phase 4: unsubscribe links carry an HMAC so nobody can mass-unsubscribe
// users by guessing UUIDs.

/** HMAC-SHA256(userId[:template]) — base64url. */
export function unsubscribeToken(
  userId: string,
  template: string | undefined,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`${userId}:${template ?? ""}`)
    .digest("base64url");
}

/** Signed unsubscribe URL for the email footer. */
export function buildUnsubscribeUrl(
  appUrl: string,
  userId: string,
  template: string | undefined,
  secret: string,
): string {
  const base = appUrl.replace(/\/$/, "");
  const params = `user=${encodeURIComponent(userId)}${template ? `&template=${encodeURIComponent(template)}` : ""}`;
  return `${base}/api/public/email/unsubscribe?${params}&sig=${encodeURIComponent(unsubscribeToken(userId, template, secret))}`;
}

/** Timing-safe signature check (false for missing/garbage sigs). */
export function verifyUnsubscribeToken(
  userId: string,
  template: string | undefined,
  sig: string | null | undefined,
  secret: string,
): boolean {
  if (!userId || !sig) return false;
  const expected = Buffer.from(unsubscribeToken(userId, template, secret));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
