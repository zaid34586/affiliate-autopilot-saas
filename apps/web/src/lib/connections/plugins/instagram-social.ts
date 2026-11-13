/**
 * Instagram Graph API plugin (social publishing + insights).
 * Reuses the existing publisher logic but wraps it in the plugin interface.
 */
import type { SocialPlugin, PlatformCredentials } from "./index";

export const instagramSocialPlugin: SocialPlugin = {
  id: "instagram",
  name: "Instagram",
  capabilities: {
    fetchProducts: false,
    createLinks: false,
    webhookConversions: false,
    apiConversions: false,
    publish: true,
  },
  requiredEnv: ["META_APP_ID", "META_APP_SECRET"],

  validateConfig(config) {
    const missing = this.requiredEnv.filter((k) => !config[k]);
    return { ok: missing.length === 0, missing };
  },

  async exchangeCode(code, redirectUri, config) {
    const res = await fetch("https://graph.facebook.com/v21.0/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.META_APP_ID,
        client_secret: config.META_APP_SECRET,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Instagram token exchange failed: ${err}`);
    }

    const data = await res.json();
    // Exchange for long-lived token
    const llRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.META_APP_ID}&client_secret=${config.META_APP_SECRET}&fb_exchange_token=${data.access_token}`
    );
    const llData = await llRes.json();

    // Get user info
    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,username,profile_picture_url&access_token=${llData.access_token}`
    );
    const meData = await meRes.json();

    return {
      accessToken: llData.access_token,
      refreshToken: llData.access_token, // FB doesn't give separate refresh; re-exchange
      expiresAt: new Date(Date.now() + (llData.expires_in ?? 5184000) * 1000),
      accountId: meData.id,
      accountName: meData.username,
    };
  },

  async refreshToken(refreshToken, config) {
    // For Instagram, we re-exchange the long-lived token
    const res = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.META_APP_ID}&client_secret=${config.META_APP_SECRET}&fb_exchange_token=${refreshToken}`
    );
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 5184000) * 1000),
      accountId: "",
      accountName: "",
    };
  },

  async publishVideo({ videoUrl, caption, credentials }) {
    // This is a thin wrapper — the real logic is in lib/publisher/instagram.ts
    // But we implement the interface for completeness
    const { instagramPublisher } = await import("@/lib/publisher/instagram");
    const result = await instagramPublisher.publish({
      workspaceId: "", // not used directly
      videoId: "",
      platform: "instagram",
      caption: { title: "", body: caption },
      videoAbsPath: videoUrl, // not used for IG
      videoUrl,
      accessToken: credentials.accessToken,
      accountId: credentials.accountId,
    });
    return { platformPostId: result.platformPostId, permalink: result.permalink };
  },

  async fetchInsights({ accountId, since, until, credentials }) {
    const sinceStr = since.toISOString().split("T")[0];
    const untilStr = until.toISOString().split("T")[0];

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/insights?metric=impressions,reach,video_views,likes,comments,shares&since=${sinceStr}&until=${untilStr}&access_token=${credentials.accessToken}`
    );

    if (!res.ok) return [];

    const data = await res.json();
    // Transform to daily aggregates
    const byDate = new Map<string, { views: number; likes: number; comments: number; shares: number }>();

    for (const metric of data.data ?? []) {
      for (const point of metric.values ?? []) {
        const date = point.end_time.split("T")[0];
        const existing = byDate.get(date) ?? { views: 0, likes: 0, comments: 0, shares: 0 };
        if (metric.name === "impressions" || metric.name === "reach") existing.views += point.value;
        if (metric.name === "likes") existing.likes += point.value;
        if (metric.name === "comments") existing.comments += point.value;
        if (metric.name === "shares") existing.shares += point.value;
        byDate.set(date, existing);
      }
    }

    return Array.from(byDate.entries()).map(([date, vals]) => ({
      date: new Date(date),
      ...vals,
    }));
  },
};