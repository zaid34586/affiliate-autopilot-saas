/**
 * Phase 6 — WhatsApp Webhook
 * 
 * Handles:
 * - GET: Webhook verification (Meta Cloud API)
 * - POST: Incoming messages, status updates
 * 
 * Configure in Meta Developer Console:
 * - Callback URL: https://yourdomain.com/api/webhook/whatsapp
 * - Verify Token: Set in env WHATSAPP_WEBHOOK_VERIFY_TOKEN
 * - Fields: messages, message_status
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@aa/db";
import { processWhatsAppWebhook } from "@/lib/dm/whatsapp-bot";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Webhook verification
  if (mode === "subscribe" && token) {
    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    
    if (token === expectedToken) {
      console.log("WhatsApp webhook verified");
      return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    } else {
      console.warn("WhatsApp webhook verification failed: invalid token");
      return NextResponse.json({ error: "Invalid verify token" }, { status: 403 });
    }
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function POST(req: Request) {
  const signature = req.headers.get("x-hub-signature-256");
  const body = await req.text();
  
  // Verify signature (optional but recommended)
  if (signature && process.env.WHATSAPP_APP_SECRET) {
    const crypto = await import("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", process.env.WHATSAPP_APP_SECRET)
      .update(body)
      .digest("hex");
    const providedSignature = signature.replace("sha256=", "");
    
    if (expectedSignature !== providedSignature) {
      console.warn("WhatsApp webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Determine workspace from webhook payload
  // Meta sends phone_number_id in the payload - we need to map it to workspace
  let workspaceId: string | null = null;
  
  try {
    const entry = payload.entry as Array<{ changes: Array<{ value: { metadata: { phone_number_id: string } } }> }> || [];
    const phoneNumberId = entry[0]?.changes[0]?.value?.metadata?.phone_number_id;
    
    if (phoneNumberId) {
      // Find workspace with matching WhatsApp connection
      // This requires storing phone_number_id in connections table
      const [conn] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .limit(1); // Simplified - in production, match by phone_number_id
      
      workspaceId = conn?.id || null;
    }
  } catch {
    // Ignore errors, fallback to first workspace
  }

  // Fallback: use first workspace (for development)
  if (!workspaceId) {
    const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
    workspaceId = ws?.id || null;
  }

  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  try {
    const result = await processWhatsAppWebhook(workspaceId, payload);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("WhatsApp webhook processing error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}