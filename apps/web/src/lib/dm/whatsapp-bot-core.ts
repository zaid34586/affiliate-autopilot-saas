/**
 * Phase 6 — WhatsApp Bot Core (pure logic).
 * 
 * Incoming DM → keyword matching → product lookup → auto-reply with tracked link
 * Integrates with existing DM funnel logic (anti-spam, daily caps, sentiment)
 */

export interface WhatsAppLink {
  id: string;
  name: string;
  phoneNumber: string;
  defaultMessage: string | null | undefined;
  utmSource: string | null | undefined;
  utmMedium: string | null | undefined;
  utmCampaign: string | null | undefined;
  utmContent: string | null | undefined;
  clicks: number;
  conversions: number;
  enabled: boolean;
}

export interface WhatsAppWebhookEvent {
  eventType: "message" | "status" | "template";
  fromNumber: string;
  toNumber: string;
  messageBody?: string;
  status?: string;
  rawPayload: Record<string, unknown>;
}

export interface BotReplyResult {
  shouldReply: boolean;
  replyText?: string;
  productId?: string;
  whatsappLinkId?: string;
  shortCode?: string;
  reason: string;
}

/**
 * Generate Click-to-Chat URL with UTM parameters
 */
export function generateWhatsAppUrl(
  phoneNumber: string,
  message: string,
  utm?: { source?: string; medium?: string; campaign?: string; content?: string }
): string {
  const params = new URLSearchParams();
  params.set("phone", phoneNumber);
  params.set("text", message);
  
  if (utm) {
    const utmParams = [];
    if (utm.source) utmParams.push(`utm_source=${utm.source}`);
    if (utm.medium) utmParams.push(`utm_medium=${utm.medium}`);
    if (utm.campaign) utmParams.push(`utm_campaign=${utm.campaign}`);
    if (utm.content) utmParams.push(`utm_content=${utm.content}`);
    if (utmParams.length > 0) {
      const currentText = params.get("text") || "";
      params.set("text", `${currentText}${currentText ? "%20" : ""}${utmParams.join("%26")}`);
    }
  }
  
  return `https://wa.me/${phoneNumber}?${params.toString()}`;
}

/**
 * Parse incoming WhatsApp webhook payload (Cloud API format)
 */
export function parseWhatsAppWebhook(payload: Record<string, unknown>): WhatsAppWebhookEvent[] {
  const events: WhatsAppWebhookEvent[] = [];
  
  try {
    const entry = payload.entry as Array<{ changes: Array<{ value: any }> }> || [];
    
    for (const e of entry) {
      for (const change of e.changes || []) {
        const value = change.value;
        
        // Handle messages
        if (value.messages) {
          for (const msg of value.messages) {
            events.push({
              eventType: "message",
              fromNumber: msg.from,
              toNumber: value.metadata?.phone_number_id,
              messageBody: msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title,
              rawPayload: msg,
            });
          }
        }
        
        // Handle status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            events.push({
              eventType: "status",
              fromNumber: status.recipient_id,
              toNumber: value.metadata?.phone_number_id,
              status: status.status,
              rawPayload: status,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("WhatsApp webhook parse error:", error);
  }
  
  return events;
}

/**
 * Match incoming message to product/keyword and determine reply
 */
export function matchMessageToProduct(
  message: string,
  whatsappLinks: WhatsAppLink[],
  products: Array<{ id: string; title: string; keywords?: string[] }>,
  options: {
    buyIntentKeywords?: string[];
    negativeKeywords?: string[];
  } = {}
): BotReplyResult {
  const lowerMsg = message.toLowerCase();
  
  const buyIntentKeywords = options.buyIntentKeywords || [
    "price", "cost", "buy", "purchase", "order", "link", "buy now", "kitna", "rate", "mrp",
    "kaise kharide", "where to buy", "link do", "link chahiye", "dm me", "message me"
  ];
  
  const negativeKeywords = options.negativeKeywords || [
    "spam", "scam", "fake", "fraud", "bakwas", "useless", "worst", "hate", "dislike"
  ];
  
  // Check for negative sentiment
  for (const neg of negativeKeywords) {
    if (lowerMsg.includes(neg)) {
      return {
        shouldReply: true,
        replyText: "Thanks for your feedback! 😊 If you have any questions about our recommendations, feel free to ask.",
        reason: "Negative sentiment detected - polite acknowledgment",
      };
    }
  }
  
  // Check for buy intent
  let hasBuyIntent = false;
  for (const keyword of buyIntentKeywords) {
    if (lowerMsg.includes(keyword)) {
      hasBuyIntent = true;
      break;
    }
  }
  
  if (!hasBuyIntent) {
    // Check for product-specific mentions
    for (const product of products) {
      const productKeywords = product.keywords || product.title.toLowerCase().split(" ");
      for (const kw of productKeywords) {
        if (kw.length > 3 && lowerMsg.includes(kw.toLowerCase())) {
          hasBuyIntent = true;
          break;
        }
      }
      if (hasBuyIntent) break;
    }
  }
  
  if (!hasBuyIntent) {
    return {
      shouldReply: false,
      reason: "No buy intent or product mention detected",
    };
  }
  
  // Find matching product
  let matchedProduct: { id: string; title: string } | null = null;
  for (const product of products) {
    const productKeywords = product.keywords || product.title.toLowerCase().split(" ");
    for (const kw of productKeywords) {
      if (kw.length > 3 && lowerMsg.includes(kw.toLowerCase())) {
        matchedProduct = { id: product.id, title: product.title };
        break;
      }
    }
    if (matchedProduct) break;
  }
  
  // If no specific product matched, use the first enabled WhatsApp link
  const enabledLink = whatsappLinks.find(l => l.enabled);
  if (!enabledLink) {
    return {
      shouldReply: false,
      reason: "No enabled WhatsApp links configured",
    };
  }
  
  // Build reply with Click-to-Chat link
  const defaultMsg = enabledLink.defaultMessage || `Interested in ${matchedProduct?.title || "this product"}!`;
  const utm = {
    source: enabledLink.utmSource || "whatsapp",
    medium: enabledLink.utmMedium || "dm_bot",
    campaign: enabledLink.utmCampaign || "auto_reply",
    content: enabledLink.utmContent || matchedProduct?.title || "product",
  };
  
  const clickUrl = generateWhatsAppUrl(enabledLink.phoneNumber, defaultMsg, utm);
  
  const replyText = matchedProduct
    ? `Thanks for your interest in ${matchedProduct.title}! 🎉\n\n${clickUrl}\n\nTap the link to chat directly or get the link!`
    : `Thanks for reaching out! 🎉\n\n${clickUrl}\n\nLet me know if you need help finding the right product!`;
  
  return {
    shouldReply: true,
    replyText,
    productId: matchedProduct?.id,
    whatsappLinkId: enabledLink.id,
    shortCode: enabledLink.id.slice(0, 8), // Use link ID as short code
    reason: matchedProduct ? `Matched product: ${matchedProduct.title}` : "General buy intent - used default link",
  };
}

/**
 * Format phone number for WhatsApp (remove +, spaces, dashes)
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[+\s\-()]/g, "");
}

/**
 * Check if number is valid Indian/International format
 */
export function isValidWhatsAppNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Basic validation: 10-15 digits, starts with country code
  return /^\d{10,15}$/.test(normalized);
}