/**
 * Phase 7 — AI Support Bot API
 * POST /api/support/webhook - Inbound email webhook (Resend / SendGrid / etc.)
 *   Body: { from, to, subject, text, html, messageId }
 *   Returns: { ticketId, botReplied }
 * POST /api/support/bot/test - Test the bot with a question (admin/dev)
 *   Body: { question, workspaceId? }
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { processInboundEmail, shouldRunBot } from "@/lib/support/support-bot";
import { buildKbContextForMessage } from "@/lib/knowledge/knowledge";
import { runSupportBot } from "@/lib/support/support-bot-core";
import { requireAdminAccess } from "@/lib/auth-utils";

export async function POST(req: Request) {
  // Detect if this is the webhook or the test endpoint by path
  const url = new URL(req.url);
  const isWebhook = url.pathname.endsWith("/webhook");

  if (isWebhook) {
    return handleWebhook(req);
  }
  return handleTest(req);
}

async function handleWebhook(req: Request): Promise<NextResponse> {
  // Verify webhook secret (Resend sends it in header)
  const secret = req.headers.get("resend-signature") || req.headers.get("x-webhook-secret");
  const expectedSecret = process.env.SUPPORT_WEBHOOK_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let body: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    messageId: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.from || !body.messageId) {
    return NextResponse.json({ error: "from and messageId required" }, { status: 400 });
  }

  // Quick filter: skip non-support emails (newsletters, receipts, etc.)
  if (!shouldRunBot(body.subject || "", body.text || "")) {
    return NextResponse.json({ skipped: true, reason: "Not a support question" });
  }

  try {
    const result = await processInboundEmail(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[SupportBot] Webhook error:", error);
    return NextResponse.json({ error: "Failed to process email" }, { status: 500 });
  }
}

async function handleTest(req: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin-only for testing
  const isAdmin = await requireAdminAccess(session.user.workspaceId, session.user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: { question: string; workspaceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.question?.trim()) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }

  const workspaceId = body.workspaceId || session.user.workspaceId;
  const kbContext = await buildKbContextForMessage(workspaceId, body.question);

  const result = await runSupportBot({
    question: body.question,
    kbContext,
  });

  return NextResponse.json({ ...result, kbContext: kbContext ? "provided" : "empty" });
}