/**
 * YouTube webhook — PubSubHubbub (push) endpoint.
 *
 * WHAT YOUTUBE ACTUALLY SENDS
 * ---------------------------
 * YouTube does NOT push comment events. The only push mechanism is
 * PubSubHubbub, which notifies about new VIDEOS on a subscribed topic
 * (`https://www.youtube.com/xml/feeds/videos.xml?channel_id=...`) and signs
 * the Atom body with `X-Hub-Signature: sha1=<hmac>` (SHA-1, not SHA-256).
 * The previous design (JSON `comment_created` events + sha256) could never
 * receive a real event.
 *
 * Therefore:
 *  - GET  implements the subscription verification handshake
 *         (hub.mode / hub.topic / hub.challenge / hub.verify_token).
 *  - POST verifies the sha1 signature (timing-safe; secret read in-handler)
 *         and acknowledges the push. A new-video push just triggers an
 *         immediate comment poll for that channel's videos.
 *  - COMMENT EVENTS ARE POLLED: see src/lib/webhooks/youtube-comments.ts
 *     (`pollYouTubeComments`), invoked by the dm-triggers cron. That is the
 *     supported path; this route no longer pretends to receive comments.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyHmacSignature } from "@/lib/webhooks/webhook-core";
import { pollYouTubeComments } from "@/lib/webhooks/youtube-comments";

export const maxDuration = 60;

/** GET: PubSubHubbub subscription verification handshake. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const topic = searchParams.get("hub.topic");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = searchParams.get("hub.verify_token");

  if (mode === "subscribe" && topic && challenge && verifyToken) {
    const expected = process.env.YOUTUBE_WEBHOOK_VERIFY_TOKEN;
    if (!expected) {
      console.error("YOUTUBE_WEBHOOK_VERIFY_TOKEN not configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
    }
    const a = Buffer.from(verifyToken);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      console.log(`YouTube PubSubHubbub subscribed: ${topic}`);
      return new NextResponse(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    console.warn("YouTube webhook verification failed: invalid verify token");
    return NextResponse.json({ error: "Invalid verify token" }, { status: 403 });
  }

  return NextResponse.json({ status: "ok", service: "youtube-webhook" });
}

/** POST: PubSubHubbub notification (Atom XML, signed with sha1). */
export async function POST(req: NextRequest) {
  const signature =
    req.headers.get("x-hub-signature") ?? req.headers.get("x-hub-signature-256");
  const payload = await req.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  // Secret read inside the handler (no module-level `!`).
  const secret = process.env.YOUTUBE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("YOUTUBE_WEBHOOK_SECRET not configured — cannot verify YouTube push");
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  // PubSubHubbub signs with SHA-1 (`sha1=<hex>`).
  const algorithm = signature.startsWith("sha256=") ? "sha256" : "sha1";
  if (!verifyHmacSignature(payload, signature, secret, algorithm)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // New-video push: kick off a comment poll for all connected channels.
  // Fire-and-forget so Meta/YouTube get their 200 quickly; errors are logged.
  if (payload.includes("<yt:videoId>") || payload.includes("videos.xml")) {
    pollYouTubeComments()
      .then((r) => {
        if (r.created > 0) console.log(`YouTube poll after push: ${r.created} new DMs`);
      })
      .catch((e) => console.error("YouTube comment poll failed:", e));
  }

  return new NextResponse(null, { status: 204 });
}
