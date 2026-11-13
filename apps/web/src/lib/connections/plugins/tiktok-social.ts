/**
 * TikTok API plugin (social publishing + insights).
 * Note: TikTok requires content audit for video.publish scope.
 */
import type { SocialPlugin, PlatformCredentials } from "./index";

const TIKTOK_API = "https://open.tiktokapis.com/v2";

export const tiktokSocialPlugin: SocialPlugin = {
  id: "tiktok",
  name: "TikTok",
  capabilities: {
    fetchProducts: false,
    createLinks: false,
    webhookConversions: false,
    apiConversions: false,
    publish: true, // requires audit
  },
  requiredEnv: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],

  validateConfig(config) {
    const missing = this.requiredEnv.filter((k) => !config[k]);
    return { ok: missing.length === 0, missing };
  },

  async exchangeCode(code, redirectUri, config) {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: config.TIKTOK_CLIENT_KEY,
        client_secret: config.TIKTOK_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`TikTok token exchange failed: ${err}`);
    }

    const data = await res.json();
    const userRes = await fetch(
      `https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url&access_token=${data.access_token}`
    );
    const userData = await userRes.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 86400) * 1000),
      accountId: userData.data?.user?.open_id,
      accountName: userData.data?.user?.display_name,
    };
  },

  async refreshToken(refreshToken, config) {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: config.TIKTOK_CLIENT_KEY,
        client_secret: config.TIKTOK_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`TikTok token refresh failed: ${err}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 86400) * 1000),
      accountId: "",
      accountName: "",
    };
  },

  async publishVideo({ videoUrl, caption, credentials }) {
    // TikTok video upload is complex — requires chunked upload for large files
    // This is a stub; real implementation uses TikTok's video upload API
    // For now, throw a clear error
    throw new Error(
      "TikTok video publishing not yet implemented — requires content audit approval and chunked upload logic"
    );
  },

  async fetchInsights({ accountId, since, until, credentials }) {
    // TikTok Analytics API — requires separate permission
    // This is a stub
    return [];
  },
};