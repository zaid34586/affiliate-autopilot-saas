/**
 * Amazon Product Advertising API 5.0 plugin.
 * Uses PA-API 5.0 (not the old 4.0) — requires PartnerTag (Associate ID) + Access/Secret keys.
 * Docs: https://webservices.amazon.com/paapi5/documentation/
 */
import { createHmac } from "node:crypto";
import type { AffiliatePlugin, FetchedProduct, CreateLinkInput, CreatedLink, ConversionEvent } from "./index";

const ENDPOINTS = {
  "us-east-1": "https://webservices.amazon.com/paapi5",
  "eu-west-1": "https://webservices.amazon.eu/paapi5",
  "ap-south-1": "https://webservices.amazon.in/paapi5",
  "ap-northeast-1": "https://webservices.amazon.co.jp/paapi5",
} as const;

type Region = keyof typeof ENDPOINTS;

function signRequest(
  payload: string,
  secretKey: string,
  region: Region,
  service: string,
  date: string
): string {
  // AWS Signature Version 4
  const kDate = createHmac("sha256", `AWS4${secretKey}`).update(date).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  return createHmac("sha256", kSigning).update(payload).digest("hex");
}

function getAmzDate(): { amzDate: string; dateStamp: string } {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dateStamp = amzDate.slice(0, 8);
  return { amzDate, dateStamp };
}

export const amazonPlugin: AffiliatePlugin = {
  id: "amazon_pa",
  name: "Amazon Product Advertising API",
  capabilities: {
    fetchProducts: true,
    createLinks: true,
    webhookConversions: false,
    apiConversions: true, // via PA-API GetItems
    publish: false,
  },
  requiredEnv: ["AMAZON_ACCESS_KEY", "AMAZON_SECRET_KEY", "AMAZON_PARTNER_TAG", "AMAZON_REGION"],

  validateConfig(config) {
    const missing = this.requiredEnv.filter((k) => !config[k]);
    return { ok: missing.length === 0, missing };
  },

  async fetchProducts({ niche, limit, config, cursor }) {
    const { accessKey, secretKey, partnerTag, region } = config;
    const endpoint = ENDPOINTS[region as Region] ?? ENDPOINTS["us-east-1"];

    // Use SearchItems for keyword-based search
    const payload = JSON.stringify({
      Keywords: niche,
      SearchIndex: "All",
      ItemCount: Math.min(limit, 10), // PA-API max 10 per request
      Resources: [
        "ItemInfo.Title",
        "Offers.Listings.Price",
        "Images.Primary.Large",
        "CustomerReviews.StarRating",
        "CustomerReviews.Count",
        "BrowseNodeInfo.BrowseNodes",
      ],
      PartnerTag: partnerTag,
      PartnerType: "Associates",
      Marketplace: "www.amazon.com",
    });

    const { amzDate, dateStamp } = getAmzDate();
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "X-Amz-Date": amzDate,
      "X-Amz-Target": "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems",
      Host: new URL(endpoint).host,
    };

    const canonicalHeaders = Object.entries(headers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k.toLowerCase()}:${v}`)
      .join("\n");
    const signedHeaders = Object.keys(headers).map((k) => k.toLowerCase()).sort().join(";");
    const hashedPayload = createHmac("sha256", "").update(payload).digest("hex");

    const canonicalRequest = [
      "POST",
      "/paapi5/searchitems",
      "",
      canonicalHeaders + "\n",
      signedHeaders,
      hashedPayload,
    ].join("\n");

    const credentialScope = `${dateStamp}/${region}/ProductAdvertisingAPI/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      createHmac("sha256", "").update(canonicalRequest).digest("hex"),
    ].join("\n");

    const signature = signRequest(stringToSign, secretKey, region as Region, "ProductAdvertisingAPI", dateStamp);
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(endpoint + "/paapi5/searchitems", {
      method: "POST",
      headers: { ...headers, Authorization: authorization },
      body: payload,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Amazon PA-API error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const items = data.SearchResult?.Items ?? [];

    const products: FetchedProduct[] = items.map((item: any) => {
      const offer = item.Offers?.Listings?.[0];
      const price = offer?.Price?.Amount ? String(offer.Price.Amount / 100) : null;
      const currency = offer?.Price?.CurrencyCode ?? "USD";
      const image = item.Images?.Primary?.Large?.URL ?? null;
      const rating = item.CustomerReviews?.StarRating ? String(item.CustomerReviews.StarRating) : null;
      const reviewCount = item.CustomerReviews?.Count ?? null;
      const category = item.BrowseNodeInfo?.BrowseNodes?.[0]?.DisplayName ?? null;

      return {
        sourceId: item.ASIN,
        title: item.ItemInfo?.Title?.DisplayValue ?? "Unknown Product",
        rawUrl: `https://www.amazon.com/dp/${item.ASIN}?tag=${partnerTag}`,
        price,
        currency,
        category,
        rating,
        reviewCount,
        imageUrl: image,
        commissionType: "percentage",
        commissionValue: null, // varies by category
        raw: item,
      };
    });

    return { products, nextCursor: undefined }; // PA-API doesn't paginate simply
  },

  async createLink({ productId, workspaceId, subId }, config) {
    // For Amazon, we just return the tracked URL pattern — actual tracking happens via our click endpoint
    const { db } = await import("@/lib/db");
    const { products } = await import("@aa/db");
    const { eq } = await import("drizzle-orm");

    const [prod] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!prod?.sourceId) throw new Error("Product has no Amazon ASIN");

    const shortCode = `amz_${prod.sourceId}_${Date.now().toString(36)}`;
    const trackedUrl = `/c/${shortCode}?target=${encodeURIComponent(`https://www.amazon.com/dp/${prod.sourceId}?tag=${config.partnerTag}`)}`;

    return {
      shortCode,
      trackedUrl,
      deepLink: `amazon://product/${prod.sourceId}?tag=${config.partnerTag}`,
    };
  },

  async importConversions({ since, config }) {
    // PA-API doesn't have a direct conversions endpoint — would need Amazon Attribution API
    // This is a stub; real implementation uses Amazon Attribution or Seller Central reports
    return [];
  },
};