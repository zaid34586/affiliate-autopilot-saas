/**
 * YouTube Data API v3 plugin (social publishing + insights).
 */
import { readFile } from "node:fs/promises";
import type { SocialPlugin, PlatformCredentials } from "./index";

const YOUTUBE_UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable";
const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

export const youtubeSocialPlugin: SocialPlugin = {
  id: "youtube",
  name: "YouTube",
  capabilities: {
    fetchProducts: false,
    createLinks: false,
    webhookConversions: false,
    apiConversions: false,
    publish: true,
  },
  requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],

  validateConfig(config) {
    const missing = this.requiredEnv.filter((k) => !config[k]);
    return { ok: missing.length === 0, missing };
  },

  async exchangeCode(code, redirectUri, config) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`YouTube token exchange failed: ${err}`);
    }

    const data = await res.json();

    // Get channel info
    const meRes = await fetch(`${YOUTUBE_API}/channels?part=snippet&mine=true&access_token=${data.access_token}`);
    const meData = await meRes.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      accountId: meData.items?.[0]?.id,
      accountName: meData.items?.[0]?.snippet?.title,
    };
  },

  async refreshToken(refreshToken, config) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`YouTube token refresh failed: ${err}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      accountId: "",
      accountName: "",
    };
  },

  async publishVideo({ videoUrl, caption, credentials }) {
    const bytes = await readFile(videoUrl);

    // caption is a string (per interface) - first line as title, rest as description
    const lines = caption.split("\n");
    const title = lines[0].slice(0, 100);
    const description = caption.slice(0, 5000);

    // 1. Init resumable upload
    const init = await fetch(YOUTUBE_UPLOAD, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(bytes.length),
        "X-Upload-Content-Type": "video/mp4",
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
          tags: ["shorts", "reels"],
          categoryId: "22",
        },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      }),
    });

    if (!init.ok) {
      const err = await init.text();
      throw new Error(`YouTube upload init failed: ${err}`);
    }

    const location = init.headers.get("location");
    if (!location) throw new Error("YouTube did not return upload URL");

    // 2. Upload bytes
    const put = await fetch(location, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Length": String(bytes.length) },
      body: bytes,
    });

    if (!put.ok) {
      const err = await put.text();
      throw new Error(`YouTube upload failed: ${err}`);
    }

    const resource = (await put.json().catch(() => ({}))) as { id?: string };
    const videoId = resource.id;
    if (!videoId) throw new Error("YouTube upload returned no video ID");

    return { platformPostId: videoId, permalink: `https://www.youtube.com/watch?v=${videoId}` };
  },

  async fetchInsights({ accountId, since, until, credentials }) {
    const sinceStr = since.toISOString().split("T")[0];
    const untilStr = until.toISOString().split("T")[0];

    const res = await fetch(
      `${YOUTUBE_API}/channels?part=statistics&id=${accountId}&access_token=${credentials.accessToken}`
    );
    if (!res.ok) return [];

    const data = await res.json();
    const stats = data.items?.[0]?.statistics;
    if (!stats) return [];

    // YouTube Analytics API would be better but requires separate scope
    // For now, return current totals as a single day
    return [
      {
        date: new Date(),
        views: parseInt(stats.viewCount ?? "0"),
        likes: parseInt(stats.likeCount ?? "0"),
        comments: parseInt(stats.commentCount ?? "0"),
        shares: 0, // not in basic stats
      },
    ];
  },
};