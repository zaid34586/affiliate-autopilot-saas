/**
 * Phase 6 — WhatsApp Webhook (Meta Cloud API)
 *
 * GET:  Webhook verification handshake (hub.mode=subscribe).
 * POST: Incoming messages / status updates.
 *
 * Security:
 * - Signature (x-hub-signature-256) is MANDATORY: missing/invalid -> 401.
 *   Comparison is constant-time; the app secret is read inside the handler.
 * - Workspace is resolved from the payload's phone_number_id against the
 *   owning connections row. Unknown number -> 200 + ignored (NO fallback to
 *   "first workspace in DB").
 * - Events are deduped by WhatsApp message id.
 *
 * Configure in Meta Developer Console:
 * - Callback URL: https://yourdomain.com/api/webhook/whatsapp
 * - Verify Token: WHATSAPP_WEBHOOK_VERIFY_TOKEN
 * - Fields: messages, message_status
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { connections, whatsappWebhookEvents } from "@aa/db";
import { and, eq, sql } from "drizzle-orm";
import { processWhatsAppWebhook } from "@/lib/dm/whatsapp-bot";
import {
  verifyHmacSignature,
  resolveWorkspaceByPhoneNumber,
  extractWhatsAppContext,
  type WorkspaceConnection,
} from "@/lib/webhooks/webhook-core";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && challenge) {
    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (!expectedToken) {
      console.error("WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
    }
    // Constant-time compare for the verify token too.
    if (timingSafeEquals(token, expectedToken)) {
      console.log("WhatsApp webhook verified");
      return new NextResponse(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    console.warn("WhatsApp webhook verification failed: invalid token");
    return NextResponse.json({ error: "Invalid verify token" }, { status: 403 });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  const signature = req.headers.get("x-hub-signature-256");
  const body = await req.text();

  // Signature is mandatory — fail closed.
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error("WHATSAPP_APP_SECRET not configured — cannot verify webhook");
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }
  if (!verifyHmacSignature(body, signature, appSecret, "sha256")) {
    console.warn("WhatsApp webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Resolve workspace from phone_number_id — no fallback path.
  const { phoneNumberId, messageIds } = extractWhatsAppContext(payload);
  const activeConnections = await db
    .select({
      workspaceId: connections.workspaceId,
      provider: connections.provider,
      accountId: connections.accountId,
      phoneNumberId: connections.phoneNumberId,
      status: connections.status,
    })
    .from(connections)
    .where(and(eq(connections.provider, "whatsapp"), eq(connections.status, "active")));

  const workspaceId = resolveWorkspaceByPhoneNumber(
    activeConnections as WorkspaceConnection[],
    phoneNumberId
  );

  if (!workspaceId) {
    // Unknown phone_number_id (or connection not registered) — acknowledge, do nothing.
    console.log(`WhatsApp webhook ignored: no connection for phone_number_id=${phoneNumberId}`);
    return NextResponse.json({ success: true, ignored: true });
  }

  // Dedupe: drop message/status ids we have already stored for this workspace.
  let filteredPayload = payload;
  if (messageIds.length > 0) {
    const existing = await db
      .select({ raw: whatsappWebhookEvents.rawPayload })
      .from(whatsappWebhookEvents)
      .where(
        and(
          eq(whatsappWebhookEvents.workspaceId, workspaceId),
          sql`${whatsappWebhookEvents.rawPayload}->>'id' IN (${sql.join(
            messageIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
      );
    const seen = new Set(
      existing
        .map((row) => (row.raw as { id?: string } | null)?.id)
        .filter((id): id is string => Boolean(id))
    );
    if (messageIds.every((id) => seen.has(id))) {
      // Every event in this payload was already processed — idempotent 200.
      return NextResponse.json({ success: true, deduped: true });
    }
    if (seen.size > 0) {
      filteredPayload = filterProcessedMessages(payload, seen);
    }
  }

  try {
    const result = await processWhatsAppWebhook(workspaceId, filteredPayload);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("WhatsApp webhook processing error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

/** Remove already-seen messages/statuses from the payload before processing. */
function filterProcessedMessages(
  payload: Record<string, unknown>,
  seen: Set<string>
): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(payload)) as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{ id?: string }>;
          statuses?: Array<{ id?: string }>;
        };
      }>;
    }>;
  };
  for (const entry of clone.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      if (value.messages) value.messages = value.messages.filter((m) => !m.id || !seen.has(m.id));
      if (value.statuses) value.statuses = value.statuses.filter((s) => !s.id || !seen.has(s.id));
    }
  }
  return clone as Record<string, unknown>;
}
