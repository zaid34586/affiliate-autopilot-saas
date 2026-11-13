/**
 * Impact Radius API plugin.
 * Uses Impact Partnership Cloud API for product catalog and conversions.
 * Docs: https://developer.impact.com/
 */
import type { AffiliatePlugin, FetchedProduct, CreateLinkInput, CreatedLink, ConversionEvent } from "./index";

const IMPACT_API = "https://api.impact.com";

export const impactPlugin: AffiliatePlugin = {
  id: "impact",
  name: "Impact Radius",
  capabilities: {
    fetchProducts: true,
    createLinks: true,
    webhookConversions: true,
    apiConversions: true,
    publish: false,
  },
  requiredEnv: ["IMPACT_ACCOUNT_SID", "IMPACT_AUTH_TOKEN"],

  validateConfig(config) {
    const missing = this.requiredEnv.filter((k) => !config[k]);
    return { ok: missing.length === 0, missing };
  },

  async fetchProducts({ niche, limit, config }) {
    const { accountSid, authToken } = config;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    // Impact uses Media Partner API for product/campaign discovery
    const res = await fetch(`${IMPACT_API}/Mediapartners/${accountSid}/Campaigns?Status=Active&PageSize=${limit}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Impact campaigns error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return {
      products: (data.Campaigns ?? []).map((c: any) => ({
        sourceId: String(c.Id),
        title: c.Name,
        rawUrl: c.TrackingLink ?? `https://${c.Domain}/?pid=${accountSid}`,
        price: null, // Impact campaigns don't have fixed prices
        currency: "USD",
        category: c.Category ?? null,
        rating: null,
        reviewCount: null,
        imageUrl: c.LogoUrl ?? null,
        commissionType: c.CommissionType ?? "percentage",
        commissionValue: c.CommissionAmount ? String(c.CommissionAmount) : null,
        raw: c,
      })),
      nextCursor: data.NextPageUri,
    };
  },

  async createLink({ productId, workspaceId, subId }, config) {
    const { db } = await import("@/lib/db");
    const { products } = await import("@aa/db");
    const { eq } = await import("drizzle-orm");

    const [prod] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!prod?.sourceId) throw new Error("Product has no Impact Campaign ID");

    const accountSid = config.accountSid;
    const baseUrl = (prod as any).raw?.TrackingLink ?? `https://api.impact.com/Mediapartners/${accountSid}/Campaigns/${prod.sourceId}/TrackingLinks`;
    const shortCode = `imp_${prod.sourceId}_${Date.now().toString(36)}`;
    const trackedUrl = `/c/${shortCode}?target=${encodeURIComponent(baseUrl)}`;

    return { shortCode, trackedUrl, deepLink: null };
  },

  async processWebhook(payload, config) {
    // Impact sends Conversion webhooks
    const conv = payload as Record<string, unknown>;
    if (!conv.ActionTrackerId) return [];

    return [
      {
        sourceId: String(conv.ClickId ?? conv.ConversionId ?? ""),
        shortCode: String(conv.SubId1 ?? ""),
        amount: String(conv.SaleAmount ?? 0),
        commission: String(conv.Payout ?? 0),
        currency: String(conv.Currency ?? "USD"),
        occurredAt: new Date(String(conv.EventDate ?? Date.now())),
        raw: conv,
      },
    ];
  },

  async importConversions({ since, config }) {
    const { accountSid, authToken } = config;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const sinceStr = since.toISOString().split("T")[0];

    const res = await fetch(`${IMPACT_API}/Mediapartners/${accountSid}/Conversions?StartDate=${sinceStr}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    if (!res.ok) return [];

    const data = await res.json();
    return (data.Conversions ?? []).map((c: Record<string, unknown>) => ({
      sourceId: String(c.ConversionId ?? ""),
      shortCode: String(c.SubId1 ?? ""),
      amount: String(c.SaleAmount ?? 0),
      commission: String(c.Payout ?? 0),
      currency: String(c.Currency ?? "USD"),
      occurredAt: new Date(String(c.EventDate ?? Date.now())),
      raw: c,
    }));
  },
};