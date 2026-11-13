/**
 * Phase 4 S6 — Instagram Reels publisher (real Content Publish API).
 * Flow: create REELS container (Meta downloads the signed public video URL)
 * → poll processing → publish container → permalink.
 * Requires: active IG connection with `instagram_content_publish` scope and a
 * Business/Creator account (Graph API requirement — surfaced honestly on error).
 */
import type { PublishInput, PublishResult, Publisher } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000; // Meta can take ~1 min to process a 20s reel

interface GraphError {
  error?: { message?: string; code?: number; error_subcode?: number };
}

async function graph(pathname: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${GRAPH}${pathname}`, init);
  const data = (await res.json().catch(() => ({}))) as GraphError;
  if (!res.ok || data.error) {
    const msg = data.error?.message ?? `Instagram API ${res.status}`;
    throw new Error(`Instagram publish failed: ${msg}`);
  }
  return data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const instagramPublisher: Publisher = {
  platform: "instagram",

  async publish(input: PublishInput): Promise<PublishResult> {
    const igUserId = input.accountId;
    if (!igUserId) {
      throw new Error("Instagram connection has no account id — reconnect in Integrations.");
    }
    if (!input.videoUrl) {
      throw new Error("No public video URL available for Instagram to download.");
    }

    const token = input.accessToken;
    const jsonHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // 1. Create the Reels container (async — Meta fetches the video).
    const created = (await graph(`/${igUserId}/media`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        media_type: "REELS",
        video_url: input.videoUrl,
        caption: input.caption.body,
        share_to_feed: true,
      }),
    })) as { id?: string };

    const containerId = created.id;
    if (!containerId) throw new Error("Instagram did not return a container id.");

    // 2. Poll until Meta finishes processing the video.
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let status = "IN_PROGRESS";
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const state = (await graph(`/${containerId}?fields=status_code`, {
        method: "GET",
        headers: jsonHeaders,
      })) as { status_code?: string };
      status = state.status_code ?? "IN_PROGRESS";
      if (status === "FINISHED") break;
      if (status === "ERROR" || status === "EXPIRED") {
        throw new Error(
          `Instagram could not process this video (${status}). Check that the account is Business/Creator and the file is a valid MP4.`
        );
      }
    }
    if (status !== "FINISHED") {
      throw new Error("Instagram video processing timed out (2 min). Retry the post.");
    }

    // 3. Publish the container.
    const published = (await graph(`/${igUserId}/media_publish`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ creation_id: containerId }),
    })) as { id?: string };

    const mediaId = published.id;
    if (!mediaId) throw new Error("Instagram publish returned no media id.");

    // 4. Permalink (best-effort — post is already live without it).
    let permalink: string | null = null;
    try {
      const info = (await graph(`/${mediaId}?fields=permalink`, {
        method: "GET",
        headers: jsonHeaders,
      })) as { permalink?: string };
      permalink = info.permalink ?? null;
    } catch {
      permalink = null;
    }

    return { platformPostId: mediaId, permalink };
  },
};
