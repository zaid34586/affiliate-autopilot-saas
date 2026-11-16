/**
 * Phase 7 — Email Lifecycle DB Orchestration.
 *
 * Gathers user signals, runs the decision engine, sends via transport,
 * logs everything. Plus unsubscribe handling.
 */

import { db } from "@/lib/db";
import {
  emailLog,
  emailUnsubscribes,
  users,
  workspaces,
  subscriptions,
  productEvents,
} from "@aa/db";
import { eq, and, desc, sql, gte, lte, isNull, or, count } from "drizzle-orm";
import {
  decideNextEmail,
  buildEmailContent,
  deriveLifecycleState,
  nextSendTime,
  buildUnsubscribeUrl,
  EmailTemplate,
  LifecycleSignals,
  UserLifecycleState,
} from "./email-core";

// ───────────────────────── TRANSPORT ─────────────────────────

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

/**
 * Send an email.
 * - RESEND_API_KEY set → Resend HTTP API
 * - otherwise → console transport (dev; logs and reports success)
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = input.from || process.env.EMAIL_FROM || "Affiliate Autopilot <no-reply@affiliateautopilot.app>";

  if (!apiKey) {
    // Console transport (development / unconfigured) — log the body too so
    // links (e.g. email verification) stay clickable in dev.
    console.log(`[email:console] To: ${input.to} | Subject: ${input.subject}`);
    console.log(`[email:console] ${input.text}`);
    return { ok: true, providerMessageId: "console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, providerMessageId: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}

/** Minimal markdown → HTML (subset used by our templates). */
export function mdToHtml(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/^(\d+)\. (.*)$/gim, "<li>$2</li>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

// ───────────────────────── SIGNALS ─────────────────────────

export interface UserLifecycleRow {
  userId: string;
  email: string;
  name: string | null;
  workspaceId: string | null;
  signals: LifecycleSignals;
  state: UserLifecycleState;
}

/**
 * Gather lifecycle signals for all users (or one) — the cron reads this.
 */
export async function gatherLifecycleSignals(options: {
  userId?: string;
  limit?: number;
} = {}): Promise<UserLifecycleRow[]> {
  const { userId, limit = 500 } = options;
  const now = new Date();

  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      onboardingDone: users.onboardingDone,
    })
    .from(users)
    .where(userId ? eq(users.id, userId) : undefined)
    .limit(limit);

  const results: UserLifecycleRow[] = [];

  for (const u of userRows) {
    // Workspace (owner)
    const [ws] = await db
      .select({ id: workspaces.id, plan: workspaces.plan })
      .from(workspaces)
      .where(eq(workspaces.ownerUserId, u.id))
      .limit(1);

    // Subscription
    const [sub] = ws
      ? await db
          .select({ plan: subscriptions.plan, status: subscriptions.status, periodEnd: subscriptions.currentPeriodEnd })
          .from(subscriptions)
          .where(eq(subscriptions.workspaceId, ws.id))
          .limit(1)
      : [undefined];

    // Last activity
    const [lastEvt] = ws
      ? await db
          .select({ ts: productEvents.ts })
          .from(productEvents)
          .where(eq(productEvents.workspaceId, ws.id))
          .orderBy(desc(productEvents.ts))
          .limit(1)
      : [undefined];

    // Last email
    const [lastEmail] = await db
      .select({ template: emailLog.template, sentAt: emailLog.createdAt })
      .from(emailLog)
      .where(and(eq(emailLog.userId, u.id), eq(emailLog.status, "sent")))
      .orderBy(desc(emailLog.createdAt))
      .limit(1);

    const hoursSinceSignup = (now.getTime() - u.createdAt.getTime()) / 3600000;
    const daysUntilPeriodEnd = sub?.periodEnd
      ? Math.floor((sub.periodEnd.getTime() - now.getTime()) / 86400000)
      : null;
    const daysSinceActive = lastEvt
      ? Math.floor((now.getTime() - lastEvt.ts.getTime()) / 86400000)
      : null;
    const hoursSinceLastEmail = lastEmail
      ? (now.getTime() - lastEmail.sentAt.getTime()) / 3600000
      : null;

    const plan = (sub?.plan || ws?.plan || "free") as LifecycleSignals["plan"];

    const signals: LifecycleSignals = {
      hoursSinceSignup: Math.round(hoursSinceSignup * 10) / 10,
      onboardingDone: u.onboardingDone,
      plan,
      daysUntilPeriodEnd,
      daysSinceActive,
      lastTemplate: (lastEmail?.template as EmailTemplate) || null,
      hoursSinceLastEmail,
    };

    results.push({
      userId: u.id,
      email: u.email,
      name: u.name,
      workspaceId: ws?.id || null,
      signals,
      state: deriveLifecycleState(signals),
    });
  }

  return results;
}

// ───────────────────────── SEND PIPELINE ─────────────────────────

export interface SendOutcome {
  userId: string;
  template: EmailTemplate | null;
  status: "sent" | "failed" | "skipped" | "unsubscribed";
  reason: string;
}

/** Check unsubscribed (NULL template row = all emails). */
export async function isUnsubscribed(userId: string, template: EmailTemplate): Promise<boolean> {
  const rows = await db
    .select()
    .from(emailUnsubscribes)
    .where(and(eq(emailUnsubscribes.userId, userId), or(isNull(emailUnsubscribes.template), eq(emailUnsubscribes.template, template))))
    .limit(5);
  return rows.length > 0;
}

/** Run the lifecycle pipeline for all users (or one). */
export async function runEmailLifecycle(options: { userId?: string; dryRun?: boolean } = {}): Promise<SendOutcome[]> {
  const rows = await gatherLifecycleSignals({ userId: options.userId });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://affiliateautopilot.app";
  const outcomes: SendOutcome[] = [];

  for (const row of rows) {
    const decision = decideNextEmail(row.signals);

    if (!decision.template) {
      outcomes.push({ userId: row.userId, template: null, status: "skipped", reason: decision.reason });
      continue;
    }

    const template = decision.template;

    if (await isUnsubscribed(row.userId, template)) {
      outcomes.push({ userId: row.userId, template, status: "unsubscribed", reason: "user unsubscribed" });
      continue;
    }

    const content = buildEmailContent(template, {
      name: row.name,
      appUrl,
      daysUntilPeriodEnd: row.signals.daysUntilPeriodEnd,
      daysSinceActive: row.signals.daysSinceActive,
    });

    if (options.dryRun) {
      outcomes.push({ userId: row.userId, template, status: "skipped", reason: `dryRun: ${decision.reason}` });
      continue;
    }

    const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<h1 style="font-size:20px">${content.subject}</h1>
<p>${mdToHtml(content.bodyMd)}</p>
<p><a href="${content.ctaUrl}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${content.ctaText}</a></p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#888">You're receiving this because you have an Affiliate Autopilot account.
<a href="${buildUnsubscribeUrl(appUrl, row.userId, template, process.env.AUTH_SECRET || "")}">Unsubscribe</a></p>
</div>`;

    const result = await sendEmail({
      to: row.email,
      subject: content.subject,
      html,
      text: `${content.bodyMd}\n\n${content.ctaText}: ${content.ctaUrl}`,
    });

    await db.insert(emailLog).values({
      userId: row.userId,
      workspaceId: row.workspaceId,
      template,
      subject: content.subject,
      status: result.ok ? "sent" : "failed",
      providerMessageId: result.providerMessageId,
      error: result.error,
      sentAt: result.ok ? new Date() : null,
    });

    outcomes.push({
      userId: row.userId,
      template,
      status: result.ok ? "sent" : "failed",
      reason: result.ok ? decision.reason : result.error || "send failed",
    });
  }

  return outcomes;
}

// ───────────────────────── UNSUBSCRIBE ─────────────────────────

export async function unsubscribe(userId: string, template?: string, reason?: string) {
  await db
    .insert(emailUnsubscribes)
    .values({ userId, template: template || null, reason })
    .onConflictDoNothing();

  return { success: true };
}

export async function resubscribe(userId: string, template?: string) {
  await db
    .delete(emailUnsubscribes)
    .where(
      and(
        eq(emailUnsubscribes.userId, userId),
        template ? eq(emailUnsubscribes.template, template) : undefined,
      ),
    );
  return { success: true };
}

// ───────────────────────── STATS ─────────────────────────

export async function getEmailStats(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const byStatus = await db
    .select({ status: emailLog.status, n: count() })
    .from(emailLog)
    .where(gte(emailLog.createdAt, since))
    .groupBy(emailLog.status);

  const byTemplate = await db
    .select({ template: emailLog.template, n: count() })
    .from(emailLog)
    .where(and(gte(emailLog.createdAt, since), eq(emailLog.status, "sent")))
    .groupBy(emailLog.template);

  return {
    days,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)])),
    byTemplate: Object.fromEntries(byTemplate.map((r) => [r.template, Number(r.n)])),
  };
}
