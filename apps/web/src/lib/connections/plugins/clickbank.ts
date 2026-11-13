/**
 * ClickBank API plugin.
 * Uses ClickBank REST API v1.3 for product search and order data.
 * Docs: https://api.clickbank.com/rest/1.3/
 */
import type { AffiliatePlugin, FetchedProduct, CreateLinkInput, CreatedLink, ConversionEvent } from "./index";

const CB_API = "https://api.clickbank.com/rest/1.3";

export const clickbankPlugin: AffiliatePlugin = {
  id: "clickbank",
  name: "ClickBank",
  capabilities: {
    fetchProducts: true,
    createLinks: true,
    webhookConversions: true, // ClickBank Instant Notification
    apiConversions: true, // via Orders API
    publish: false,
  },
  requiredEnv: ["CLICKBANK_DEV_KEY", "CLICKBANK_CL_ACCOUNT"],

  validateConfig(config) {
    const missing = this.requiredEnv.filter((k) => !config[k]);
    return { ok: missing.length === 0, missing };
  },

  async fetchProducts({ niche, limit, config }) {
    const { devKey, clAccount } = config;

    // ClickBank doesn't have a direct "search by niche" — we list products in the account
    // and filter by title/keywords. For demo, we'll fetch all and filter locally.
    const res = await fetch(`${CB_API}/products/list`, {
      headers: {
        Authorization: devKey,
        Accept: "application/json",
        "X-ClickBank-Account": clAccount,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ClickBank products error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const products = (data.products ?? []).slice(0, limit);

    return {
      products: products.map((p: any) => ({
        sourceId: p.product_id,
        title: p.product_title,
        rawUrl: `https://${p.vendor_id}.hop.clickbank.net/?tid=${clAccount}`,
        price: p.price ? String(p.price / 100) : null,
        currency: "USD",
        category: p.product_category ?? null,
        rating: null, // ClickBank doesn't provide ratings
        reviewCount: null,
        imageUrl: p.product_image_url ?? null,
        commissionType: "percentage",
        commissionValue: p.commission_rate ? String(p.commission_rate) : null,
        raw: p,
      })),
      nextCursor: undefined,
    };
  },

  async createLink({ productId, workspaceId, subId }, config) {
    const { db } = await import("@/lib/db");
    const { products } = await import("@aa/db");
    const { eq } = await import("drizzle-orm");

    const [prod] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!prod?.sourceId) throw new Error("Product has no ClickBank ID");

    const tid = config.clAccount;
    const hopLink = `https://${(prod as any).raw?.vendor_id ?? "vendor"}.hop.clickbank.net/?tid=${config.clAccount}`;
    const shortCode = `cb_${prod.sourceId}_${Date.now().toString(36)}`;
    const trackedUrl = `/c/${shortCode}?target=${encodeURIComponent(hopLink)}`;

    return { shortCode, trackedUrl, deepLink: null };
  },

  // ClickBank Instant Notification (webhook) — receives order data in real-time
  async processWebhook(payload, config) {
    const notification = payload as Record<string, unknown>;
    // Validate notification signature (ClickBank sends a checksum)
    // For now, trust but verify structure
    const receipt = (notification.receipt ?? {}) as Record<string, unknown>;
    if (!receipt || Object.keys(receipt).length === 0) return [];

    return [
      {
        sourceId: String(receipt.receipt_id ?? receipt.order_id ?? ""),
        shortCode: String(receipt.tid ?? ""),
        amount: String((Number(receipt.total_amount ?? receipt.total_sale_amount ?? 0)) / 100),
        commission: String((Number(receipt.affiliate_commission ?? 0)) / 100),
        currency: "USD",
        occurredAt: new Date(String(receipt.purchase_date ?? Date.now())),
        raw: notification,
      },
    ];
  },

  // ClickBank Orders API for historical import
  async importConversions({ since, config }) {
    const { devKey, clAccount } = config;
    const sinceStr = since.toISOString().split("T")[0];

    const res = await fetch(`${CB_API}/orders/list?start_date=${sinceStr}`, {
      headers: {
        Authorization: devKey,
        Accept: "application/json",
        "X-ClickBank-Account": clAccount,
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.orders ?? []).map((o: any) => ({
      sourceId: o.receipt_id,
      shortCode: o.tid,
      amount: String(o.total_sale_amount / 100),
      commission: String(o.affiliate_commission / 100),
      currency: "USD",
      occurredAt: new Date(o.purchase_date),
      raw: o,
    }));
  },
};