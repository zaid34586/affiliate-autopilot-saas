/**
 * Phase 5 Module A — Connection Plugin Architecture.
 * Type-safe, extensible adapter pattern for affiliate networks + social platforms.
 * Each plugin implements the same interface — swap/add networks without touching core logic.
 */
import type { ProductScriptContext } from "@/lib/video/scripts";

/** Minimal product data returned by any affiliate plugin. */
export interface FetchedProduct {
  /** Unique ID from the network (e.g., Amazon ASIN, ClickBank ID). */
  sourceId: string;
  /** Human-readable title. */
  title: string;
  /** Product page / offer URL (will be turned into tracked affiliate link). */
  rawUrl: string;
  /** Current price (string to preserve precision). */
  price: string | null;
  /** ISO currency code. */
  currency: string | null;
  /** Category / niche from the network. */
  category: string | null;
  /** Rating 0–5. */
  rating: string | null;
  /** Review count. */
  reviewCount: number | null;
  /** Primary image URL. */
  imageUrl: string | null;
  /** Commission type from network. */
  commissionType: "percentage" | "flat" | null;
  /** Commission value (e.g., "5.5" for 5.5% or "2.50" for $2.50). */
  commissionValue: string | null;
  /** Network-specific raw data for debugging/extensions. */
  raw: Record<string, unknown>;
}

/** Input for creating a tracked affiliate link. */
export interface CreateLinkInput {
  productId: string; // our internal products.id
  workspaceId: string;
  /** Optional custom sub-id for tracking. */
  subId?: string;
  /** Optional geo redirect rules. */
  geoRules?: Record<string, string>;
}

/** Result of creating an affiliate link. */
export interface CreatedLink {
  /** Short code for click tracking. */
  shortCode: string;
  /** Full tracked URL (redirects via our click endpoint). */
  trackedUrl: string;
  /** Deep link if the network supports it (app open). */
  deepLink: string | null;
}

/** Conversion data from network webhook/import. */
export interface ConversionEvent {
  /** Network's unique click/transaction ID. */
  sourceId: string;
  /** Our short code (if available). */
  shortCode?: string;
  /** Sale amount. */
  amount: string;
  /** Commission earned. */
  commission: string;
  /** Currency. */
  currency: string;
  /** When the conversion happened. */
  occurredAt: Date;
  /** Raw payload for audit. */
  raw: Record<string, unknown>;
}

/** Platform publishing credentials (for social plugins). */
export interface PlatformCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountId: string;
  accountName: string;
}

/** Capabilities a plugin may declare. */
export interface PluginCapabilities {
  /** Can fetch product catalogs. */
  fetchProducts: boolean;
  /** Can create affiliate links. */
  createLinks: boolean;
  /** Can receive conversion webhooks. */
  webhookConversions: boolean;
  /** Can import conversions via API. */
  apiConversions: boolean;
  /** Can publish content (social platforms). */
  publish: boolean;
}

/** Base interface every affiliate plugin must implement. */
export interface AffiliatePlugin {
  /** Unique plugin ID (e.g., "amazon_pa", "clickbank", "impact"). */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** What this plugin can do. */
  readonly capabilities: PluginCapabilities;
  /** Required env vars for this plugin. */
  readonly requiredEnv: string[];

  /** Validate configuration (called at startup). */
  validateConfig(config: Record<string, string>): { ok: boolean; missing: string[] };

  /** Fetch trending/best-selling products for a niche. */
  fetchProducts(opts: {
    niche: string;
    limit: number;
    config: Record<string, string>;
    /** Pagination cursor from previous call. */
    cursor?: string;
  }): Promise<{ products: FetchedProduct[]; nextCursor?: string }>;

  /** Create a tracked affiliate link for a product. */
  createLink(input: CreateLinkInput, config: Record<string, string>): Promise<CreatedLink>;

  /** Process incoming webhook (if webhookConversions=true). */
  processWebhook?(payload: unknown, config: Record<string, string>): Promise<ConversionEvent[]>;

  /** Import conversions via API (if apiConversions=true). */
  importConversions?(opts: {
    since: Date;
    config: Record<string, string>;
  }): Promise<ConversionEvent[]>;
}

/** Base interface for social platform plugins. */
export interface SocialPlugin {
  readonly id: string;
  readonly name: string;
  readonly capabilities: PluginCapabilities;
  readonly requiredEnv: string[];

  validateConfig(config: Record<string, string>): { ok: boolean; missing: string[] };

  /** Exchange OAuth code for tokens. */
  exchangeCode(code: string, redirectUri: string, config: Record<string, string>): Promise<PlatformCredentials>;

  /** Refresh access token. */
  refreshToken(refreshToken: string, config: Record<string, string>): Promise<PlatformCredentials>;

  /** Publish a video/reel (used by publisher). */
  publishVideo(input: {
    videoUrl: string;
    caption: string;
    credentials: PlatformCredentials;
  }): Promise<{ platformPostId: string; permalink: string | null }>;

  /** Fetch account insights (views, likes, etc.). */
  fetchInsights(opts: {
    accountId: string;
    since: Date;
    until: Date;
    credentials: PlatformCredentials;
  }): Promise<Array<{ date: Date; views: number; likes: number; comments: number; shares: number }>>;
}

/** Registry of all available plugins. */
export const pluginRegistry = {
  affiliate: new Map<string, AffiliatePlugin>(),
  social: new Map<string, SocialPlugin>(),

  registerAffiliate(plugin: AffiliatePlugin) {
    this.affiliate.set(plugin.id, plugin);
  },

  registerSocial(plugin: SocialPlugin) {
    this.social.set(plugin.id, plugin);
  },

  getAffiliate(id: string) {
    return this.affiliate.get(id);
  },

  getSocial(id: string) {
    return this.social.get(id);
  },

  listAffiliate() {
    return Array.from(this.affiliate.values());
  },

  listSocial() {
    return Array.from(this.social.values());
  },
};

/** Load enabled plugins for a workspace from DB connections. */
export async function loadWorkspacePlugins(workspaceId: string) {
  const { db } = await import("@/lib/db");
  const { connections } = await import("@aa/db");
  const { eq, and } = await import("drizzle-orm");

  const rows = await db
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.status, "active")));

  const affiliatePlugins: AffiliatePlugin[] = [];
  const socialPlugins: SocialPlugin[] = [];

  for (const conn of rows) {
    if (conn.provider.endsWith("_byok")) continue; // AI keys, not affiliate/social

    const affiliate = pluginRegistry.getAffiliate(conn.provider);
    if (affiliate) {
      affiliatePlugins.push(affiliate);
      continue;
    }

    const social = pluginRegistry.getSocial(conn.provider);
    if (social) {
      socialPlugins.push(social);
    }
  }

  return { affiliatePlugins, socialPlugins };
}

/** Build config object from connection row. */
export function buildPluginConfig(conn: {
  provider: string;
  apiKeyEnc?: string | null;
  accessTokenEnc?: string | null;
  refreshTokenEnc?: string | null;
  scopes?: string[] | null;
}): Record<string, string> {
  const config: Record<string, string> = {};
  if (conn.apiKeyEnc) config.apiKey = conn.apiKeyEnc;
  if (conn.accessTokenEnc) config.accessToken = conn.accessTokenEnc;
  if (conn.refreshTokenEnc) config.refreshToken = conn.refreshTokenEnc;
  if (conn.scopes?.length) config.scopes = conn.scopes.join(",");
  return config;
}