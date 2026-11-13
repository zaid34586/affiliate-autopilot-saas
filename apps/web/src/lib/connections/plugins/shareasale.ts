/**
 * ShareASale API plugin.
 * Uses ShareASale Merchant API for product data and transaction reports.
 * Docs: https://www.shareasale.com/api/
 */
import type { AffiliatePlugin, FetchedProduct, CreateLinkInput, CreatedLink, ConversionEvent } from "./index";

const SAS_API = "https://api.shareasale.com";

export const shareasalePlugin: AffiliatePlugin = {
  id: "shareasale",
  name: "ShareASale",
  capabilities: {
    fetchProducts: true,
    createLinks: true,
    webhookConversions: false,
    apiConversions: true,
    publish: false,
  },
  requiredEnv: ["SHAREASALE_API_TOKEN", "SHAREASALE_API_SECRET", "SHAREASALE_MERCHANT_ID"],

  validateConfig(config) {
    const missing = this.requiredEnv.filter((k) => !config[k]);
    return { ok: missing.length === 0, missing };
  },

  async fetchProducts({ niche, limit, config }) {
    const { token, secret, merchantId } = config;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signRequest("GET", `/merchant/products?merchantId=${merchantId}&keyword=${encodeURIComponent(niche)}&max=${limit}`, timestamp, secret);

    const res = await fetch(`${SAS_API}/merchant/products?merchantId=${merchantId}&keyword=${encodeURIComponent(niche)}&max=${limit}`, {
      headers: {
        "x-shareasale-auth": `${token}:${signature}:${timestamp}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ShareASale products error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return {
      products: (data.products ?? []).map((p: Record<string, unknown>) => ({
        sourceId: String(p.productId ?? ""),
        title: String(p.name ?? ""),
        rawUrl: `https://www.shareasale.com/r.cfm?b=${p.linkId ?? ""}&u=${config.affiliateId}&m=${merchantId}`,
        price: p.price ? String(p.price) : null,
        currency: "USD",
        category: String(p.category ?? ""),
        rating: null,
        reviewCount: null,
        imageUrl: String(p.thumbnailUrl ?? ""),
        commissionType: "percentage",
        commissionValue: p.commissionRate ? String(p.commissionRate) : null,
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
    if (!prod?.sourceId) throw new Error("Product has no ShareASale Product ID");

    const rawUrl = (prod as any).rawUrl ?? `https://www.shareasale.com/r.cfm?b=${(prod as any).raw?.linkId ?? ""}&u=${config.affiliateId}&m=${config.merchantId}`;
    const shortCode = `sas_${prod.sourceId}_${Date.now().toString(36)}`;
    const trackedUrl = `/c/${shortCode}?target=${encodeURIComponent(rawUrl)}`;

    return { shortCode, trackedUrl, deepLink: null };
  },

  async importConversions({ since, config }) {
    const { token, secret, merchantId } = config;
    const timestamp = Math.floor(Date.now() / 1000);
    const dateStr = since.toISOString().split("T")[0];
    const path = `/merchant/transactions?merchantId=${merchantId}&startDate=${dateStr}`;
    const signature = signRequest("GET", path, timestamp, secret);

    const res = await fetch(`${SAS_API}${path}`, {
      headers: { "x-shareasale-auth": `${token}:${signature}:${timestamp}`, Accept: "application/json" },
    });
    if (!res.ok) return [];

    const data = await res.json();
    return (data.transactions ?? []).map((t: Record<string, unknown>) => ({
      sourceId: String(t.transactionId ?? ""),
      shortCode: String(t.affiliateId ?? ""),
      amount: String(t.saleAmount ?? 0),
      commission: String(t.commission ?? 0),
      currency: "USD",
      occurredAt: new Date(String(t.transactionDate ?? Date.now())),
      raw: t,
    }));
  },
};

function signRequest(method: string, path: string, timestamp: number, secret: string): string {
  const crypto = require("node:crypto");
  const data = `${method}:${path}:${timestamp}`;
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}