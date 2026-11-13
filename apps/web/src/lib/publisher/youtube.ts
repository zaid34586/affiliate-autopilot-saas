/**
 * Phase 4 S6 — YouTube Shorts publisher (Data API v3 resumable upload).
 * Flow: init resumable session with metadata → PUT the MP4 bytes → video id.
 * Requires: active YouTube connection with the `youtube.upload` scope
 * (requested by the connect route). Vertical ≤3min uploads surface as Shorts.
 */
import { readFile } from "node:fs/promises";
import type { PublishInput, PublishResult, Publisher } from "./types";

const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable";

export const youtubePublisher: Publisher = {
  platform: "youtube",

  async publish(input: PublishInput): Promise<PublishResult> {
    const bytes = await readFile(input.videoAbsPath);

    // 1. Open a resumable session with the video metadata.
    const init = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(bytes.length),
        "X-Upload-Content-Type": "video/mp4",
      },
      body: JSON.stringify({
        snippet: {
          title: input.caption.title.slice(0, 100),
          description: input.caption.body.slice(0, 5000),
          tags: ["shorts", "reels"],
          categoryId: "22",
        },
        status: {
          privacyStatus: "public",
          selfDeclaredMadeForKids: false,
        },
      }),
    });

    if (!init.ok) {
      const detail = await init.text().catch(() => "");
      throw new Error(
        `YouTube upload init failed (${init.status}): ${detail.slice(0, 300) || init.statusText}`
      );
    }

    const location = init.headers.get("location");
    if (!location) throw new Error("YouTube did not return an upload session URL.");

    // 2. Upload the bytes.
    const put = await fetch(location, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(bytes.length),
      },
      body: bytes,
    });

    if (!put.ok) {
      const detail = await put.text().catch(() => "");
      throw new Error(
        `YouTube upload failed (${put.status}): ${detail.slice(0, 300) || put.statusText}`
      );
    }

    const resource = (await put.json().catch(() => ({}))) as { id?: string };
    const videoId = resource.id;
    if (!videoId) throw new Error("YouTube upload returned no video id.");

    return {
      platformPostId: videoId,
      permalink: `https://www.youtube.com/watch?v=${videoId}`,
    };
  },
};
