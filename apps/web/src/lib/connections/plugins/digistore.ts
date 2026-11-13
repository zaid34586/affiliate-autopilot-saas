/**
 * Digistore24 API plugin.
 * Uses Digistore24 REST API for product search and order data.
 * Docs: https://www.digistore24.com/api-documentation
 */
import type { AffiliatePlugin, FetchedProduct, CreateLinkInput, CreatedLink, ConversionEvent } from "./index";

const DS_API = "https://www.digistore24.com/api";

export const digistorePlugin: AffiliatePlugin = {
  id: "digistore",
  name: "Digistore24",
  capabilities: {
    fetchProducts: true,
    createLinks: true,
    webhookConversions: true,
    apiConversions: true,
    publish: false,
  },
  requiredEnv: ["DIGISTORE_API_KEY"],

  validateConfig(config) {
    const missing = this.requiredEnv.filter((k) => !config[k]);
    return { ok: missing.length === 0, missing };
  },

  async fetchProducts({ niche, limit, config }) {
    const { apiKey } = config;

    // Search products by keyword
    const res = await fetch(`${DS_API}/products?search=${encodeURIComponent(niche)}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Digistore24 products error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return {
      products: (data.products ?? []).map((p: any) => ({
        sourceId: String(p.id),
        title: p.name,
        rawUrl: `https://www.digistore24.com/redir/${p.id}/${config.affiliateId ?? "AFFILIATE"}`,
        price: p.price ? String(p.price / 100) : null,
        currency: p.currency ?? "EUR",
        category: p.category ?? null,
        rating: null,
        reviewCount: null,
        imageUrl: p.image_url ?? null,
        commissionType: "percentage",
        commissionValue: p.commission_rate ? String(p.commission_rate) : null,
        raw: p,
      })),
      nextCursor: data.next_cursor,
    };
  },

  async createLink({ productId, workspaceId, subId }, config) {
    const { db } = await import("@/lib/db");
    const { products } = await import("@aa/db");
    const { eq } = await import("drizzle-orm");

    const [prod] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!prod?.sourceId) throw new Error("Product has no Digistore24 ID");

    const rawUrl = (prod as any).rawUrl ?? `https://www.digistore24.com/redir/${prod.sourceId}/${config.affiliateId ?? "AFFILIATE"}`;
    const shortCode = `ds_${prod.sourceId}_${Date.now().toString(36)}`;
    const trackedUrl = `/c/${shortCode}?target=${encodeURIComponent(rawUrl)}`;

    return { shortCode, trackedUrl, deepLink: null };
  },

  async processWebhook(payload, config) {
    const notification = payload as Record<string, unknown>;
    const order = (notification.order ?? {}) as Record<string, unknown>;
    if (!order || Object.keys(order).length === 0) return [];

    return [
      {
        sourceId: String(order.id ?? ""),
        shortCode: String(order.affiliate_id ?? ""),
        amount: String(Number(order.amount ?? 0) / 100),
        commission: String(Number(order.commission ?? 0) / 100),
        currency: String(order.currency ?? "EUR"),
        occurredAt: new Date(String(order.created_at ?? Date.now())),
        raw: notification,
      },
    ];
  },

  async importConversions({ since, config }) {
    const { apiKey } = config;
    const sinceStr = since.toISOString().split("T")[0];

    const res = await fetch(`${DS_API}/orders?since=${sinceStr}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!res.ok) return [];

    const data = await res.json();
    return (data.orders ?? []).map((o: Record<string, unknown>) => ({
      sourceId: String(o.id ?? ""),
      shortCode: String(o.affiliate_id ?? ""),
      amount: String(Number(o.amount ?? 0) / 100),
      commission: String(Number(o.commission ?? 0) / 100),
      currency: String(o.currency ?? "EUR"),
      occurredAt: new Date(String(o.created_at ?? Date.now())),
      raw: o,
    }));
  },
};