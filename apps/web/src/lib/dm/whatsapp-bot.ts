/**
 * Phase 6 — WhatsApp Bot DB Orchestration.
 * 
 * Handles: WhatsApp links CRUD, webhook processing, bot replies, analytics
 */

import { db } from "@/lib/db";
import {
  whatsappLinks,
  whatsappWebhookEvents,
  products,
  dmMessages,
  connections,
} from "@aa/db";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import {
  WhatsAppLink,
  BotReplyResult,
  parseWhatsAppWebhook,
  matchMessageToProduct,
  generateWhatsAppUrl,
} from "./whatsapp-bot-core";

export interface CreateWhatsAppLinkInput {
  name: string;
  phoneNumber: string;
  defaultMessage?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
}

export interface WhatsAppLinkWithStats extends WhatsAppLink {
  conversionRate: number;
}

/**
 * Create a new WhatsApp Click-to-Chat link
 */
export async function createWhatsAppLink(workspaceId: string, input: CreateWhatsAppLinkInput) {
  const normalizedPhone = input.phoneNumber.replace(/[+\s\-()]/g, "");
  
  const [link] = await db
    .insert(whatsappLinks)
    .values({
      workspaceId,
      name: input.name,
      phoneNumber: normalizedPhone,
      defaultMessage: input.defaultMessage,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      utmContent: input.utmContent,
    })
    .returning();

  return link;
}

/**
 * Get all WhatsApp links for a workspace
 */
export async function listWhatsAppLinks(workspaceId: string): Promise<WhatsAppLinkWithStats[]> {
  const links = await db
    .select()
    .from(whatsappLinks)
    .where(eq(whatsappLinks.workspaceId, workspaceId))
    .orderBy(desc(whatsappLinks.createdAt));

  return links.map(l => ({
    ...l,
    defaultMessage: l.defaultMessage ?? undefined,
    utmSource: l.utmSource ?? undefined,
    utmMedium: l.utmMedium ?? undefined,
    utmCampaign: l.utmCampaign ?? undefined,
    utmContent: l.utmContent ?? undefined,
    conversionRate: l.clicks > 0 ? l.conversions / l.clicks : 0,
  }));
}

/**
 * Get a specific WhatsApp link
 */
export async function getWhatsAppLink(workspaceId: string, linkId: string) {
  const [link] = await db
    .select()
    .from(whatsappLinks)
    .where(and(eq(whatsappLinks.id, linkId), eq(whatsappLinks.workspaceId, workspaceId)))
    .limit(1);

  return link;
}

/**
 * Update a WhatsApp link
 */
export async function updateWhatsAppLink(
  workspaceId: string,
  linkId: string,
  updates: Partial<CreateWhatsAppLinkInput>
) {
  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name) data.name = updates.name;
  if (updates.phoneNumber) data.phoneNumber = updates.phoneNumber.replace(/[+\s\-()]/g, "");
  if (updates.defaultMessage !== undefined) data.defaultMessage = updates.defaultMessage;
  if (updates.utmSource !== undefined) data.utmSource = updates.utmSource;
  if (updates.utmMedium !== undefined) data.utmMedium = updates.utmMedium;
  if (updates.utmCampaign !== undefined) data.utmCampaign = updates.utmCampaign;
  if (updates.utmContent !== undefined) data.utmContent = updates.utmContent;

  const [link] = await db
    .update(whatsappLinks)
    .set(data)
    .where(and(eq(whatsappLinks.id, linkId), eq(whatsappLinks.workspaceId, workspaceId)))
    .returning();

  return link;
}

/**
 * Toggle WhatsApp link enabled/disabled
 */
export async function toggleWhatsAppLink(workspaceId: string, linkId: string, enabled: boolean) {
  const [link] = await db
    .update(whatsappLinks)
    .set({ enabled, updatedAt: new Date() })
    .where(and(eq(whatsappLinks.id, linkId), eq(whatsappLinks.workspaceId, workspaceId)))
    .returning();

  return link;
}

/**
 * Delete a WhatsApp link
 */
export async function deleteWhatsAppLink(workspaceId: string, linkId: string) {
  await db
    .delete(whatsappLinks)
    .where(and(eq(whatsappLinks.id, linkId), eq(whatsappLinks.workspaceId, workspaceId)));
  
  return { success: true };
}

/**
 * Track click on WhatsApp link
 */
export async function trackWhatsAppClick(workspaceId: string, linkId: string) {
  await db
    .update(whatsappLinks)
    .set({
      clicks: sql`${whatsappLinks.clicks} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(whatsappLinks.id, linkId), eq(whatsappLinks.workspaceId, workspaceId)));
}

/**
 * Track conversion from WhatsApp link
 */
export async function trackWhatsAppConversion(workspaceId: string, linkId: string) {
  await db
    .update(whatsappLinks)
    .set({
      conversions: sql`${whatsappLinks.conversions} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(whatsappLinks.id, linkId), eq(whatsappLinks.workspaceId, workspaceId)));
}

/**
 * Process incoming WhatsApp webhook
 */
export async function processWhatsAppWebhook(
  workspaceId: string,
  payload: Record<string, unknown>
): Promise<{ processed: number; replies: BotReplyResult[] }> {
  const events = parseWhatsAppWebhook(payload);
  const replies: BotReplyResult[] = [];

  // Get workspace WhatsApp links and products
  const [links, activeProducts] = await Promise.all([
    listWhatsAppLinks(workspaceId),
    db.select({ id: products.id, title: products.title }).from(products).where(and(eq(products.workspaceId, workspaceId), eq(products.status, "active"))).limit(50),
  ]);

  for (const event of events) {
    // Store webhook event
    await db.insert(whatsappWebhookEvents).values({
      workspaceId,
      eventType: event.eventType,
      fromNumber: event.fromNumber,
      toNumber: event.toNumber,
      messageBody: event.messageBody,
      status: event.status,
      rawPayload: event.rawPayload,
      processed: false,
    });

    // Process incoming messages
    if (event.eventType === "message" && event.messageBody) {
      const result = matchMessageToProduct(event.messageBody, links, activeProducts);
      replies.push(result);

      // Mark event as processed
      if (result.shouldReply) {
        await db
          .update(whatsappWebhookEvents)
          .set({ processed: true })
          .where(and(
            eq(whatsappWebhookEvents.workspaceId, workspaceId),
            eq(whatsappWebhookEvents.fromNumber, event.fromNumber),
            eq(whatsappWebhookEvents.eventType, "message")
          ));

        // If we have a product match, log DM message
        if (result.productId && result.whatsappLinkId) {
          await db.insert(dmMessages).values({
            workspaceId,
            platform: "whatsapp",
            channel: "dm",
            recipientHandle: event.fromNumber,
            triggerKeyword: result.reason,
            productId: result.productId,
            body: result.replyText || "",
            status: "sent",
            sentAt: new Date(),
          });
        }
      }
    }
  }

  return { processed: events.length, replies };
}

/**
 * Get webhook events for a workspace
 */
export async function getWebhookEvents(workspaceId: string, limit = 50) {
  return db
    .select()
    .from(whatsappWebhookEvents)
    .where(eq(whatsappWebhookEvents.workspaceId, workspaceId))
    .orderBy(desc(whatsappWebhookEvents.createdAt))
    .limit(limit);
}

/**
 * Generate Click-to-Chat URL for a link
 */
export function getClickToChatUrl(link: WhatsAppLink, customMessage?: string): string {
  const message = customMessage || link.defaultMessage || "Hi, I'm interested!";
  return generateWhatsAppUrl(link.phoneNumber, message, {
    source: link.utmSource ?? undefined,
    medium: link.utmMedium ?? undefined,
    campaign: link.utmCampaign ?? undefined,
    content: link.utmContent ?? undefined,
  });
}