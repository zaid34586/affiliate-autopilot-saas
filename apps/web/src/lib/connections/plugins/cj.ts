/**
 * CJ Affiliate (Commission Junction) API plugin.
 * Uses CJ REST API for link search and commission data.
 * Docs: https://cjdeveloper.github.io/
 */
import type { AffiliatePlugin, FetchedProduct, CreateLinkInput, CreatedLink, ConversionEvent } from "./index";

const CJ_API = "https://link-search.api.cj.com/v2";

export const cjPlugin: AffiliatePlugin = {
  id: "cj",
  name: "CJ Affiliate",
  capabilities: {
    fetchProducts: true,
    createLinks: true,
    webhookConversions: false,
    apiConversions: true,
    publish: false,
  },
  requiredEnv: ["CJ_DEVELOPER_KEY", "CJ_WEBSITE_ID"],

  validateConfig(config) {
    const missing = this.requiredEnv.filter((k) => !config[k]);
    return { ok: missing.length === 0, missing };
  },

  async fetchProducts({ niche, limit, config }) {
    const { developerKey, websiteId } = config;

    // CJ Link Search API — search for links/offers by keyword
    const params = new URLSearchParams({
      "keywords": niche,
      "website-id": websiteId,
      "records-per-page": String(Math.min(limit, 50)),
      "link-type": "banner,text,product",
    });

    const res = await fetch(`${CJ_API}/link-search?${params}`, {
      headers: { Authorization: developerKey, Accept: "application/json" },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`CJ link search error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const links = data?.links ?? [];

    return {
      products: links.map((l: any) => ({
        sourceId: String(l.linkId),
        title: l.advertiserName + " — " + (l.linkName ?? "Offer"),
        rawUrl: l.destination ?? `https://www.dpbolvw.net/click-${websiteId}-${l.linkId}`,
        price: null,
        currency: "USD",
        category: l.category?.name ?? null,
        rating: null,
        reviewCount: null,
        imageUrl: l.imageUrl ?? null,
        commissionType: l.commissionType ?? "percentage",
        commissionValue: l.commissionAmount ? String(l.commissionAmount) : null,
        raw: l,
      })),
      nextCursor: data?.nextPageToken,
    };
  },

  async createLink({ productId, workspaceId, subId }, config) {
    const { db } = await import("@/lib/db");
    const { products } = await import("@aa/db");
    const { eq } = await import("drizzle-orm");

    const [prod] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!prod?.sourceId) throw new Error("Product has no CJ Link ID");

    const rawUrl = (prod as any).raw?.destination ?? `https://www.dpbolvw.net/click-${config.websiteId}-${prod.sourceId}`;
    const shortCode = `cj_${prod.sourceId}_${Date.now().toString(36)}`;
    const trackedUrl = `/c/${shortCode}?target=${encodeURIComponent(rawUrl)}`;

    return { shortCode, trackedUrl, deepLink: null };
  },

  async importConversions({ since, config }) {
    // CJ Commission Detail API — requires separate credentials
    // This is a stub; real implementation uses CJ Commission Detail Service
    return [];
  },
};