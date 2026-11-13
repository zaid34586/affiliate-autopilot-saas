/**
 * Phase 4 S6 — Auto-post orchestrator.
 * Resolves the publisher (live connection > sandbox in dev/demo), builds the
 * fact-safe caption, runs the publish, and records every attempt on `posts`
 * with honest state: publishing → published | failed (+ sandbox flag).
 *
 * Honesty rules:
 *  - Sandbox posts are stored sandbox=true and shown as "Sandbox" — never as
 *    a live platform post.
 *  - No connection in production → PublishNotAvailableError with a clear
 *    "connect your account" message (never a fake success).
 */
import { db } from "@/lib/db";
import { affiliateLinks, connections, contents, posts, products, videos } from "@aa/db";
import { and, eq } from "drizzle-orm";
import { buildCaption } from "./caption";
import { instagramPublisher } from "./instagram";
import { publicBaseUrl, signMediaUrl } from "./media-url";
import { sandboxPublisher } from "./sandbox";
import {
  isPublishPlatform,
  PLATFORM_LABELS,
  PublishNotAvailableError,
  type PublishPlatform,
  type Publisher,
} from "./types";
import { youtubePublisher } from "./youtube";

/** Sandbox publishing: allowed in dev, or explicitly in prod via PUBLISH_MODE=mock. */
export function isSandboxPublishAllowed(): boolean {
  if (process.env.PUBLISH_MODE === "mock") return true;
  return process.env.NODE_ENV !== "production";
}

export interface PublishTarget {
  publisher: Publisher;
  sandbox: boolean;
  /** Active connection id when publishing live (null in sandbox). */
  connectionId: string | null;
}

/** Resolve how a post to `platform` would go out for this workspace. */
export async function resolvePublishTarget(
  workspaceId: string,
  platform: PublishPlatform
): Promise<PublishTarget> {
  const rows = await db
    .select({
      id: connections.id,
      accountId: connections.accountId,
      accessToken: connections.accessTokenEnc, // stored as-is until token encryption lands
      tokenExpiresAt: connections.tokenExpiresAt,
    })
    .from(connections)
    .where(
      and(
        eq(connections.workspaceId, workspaceId),
        eq(connections.provider, platform),
        eq(connections.status, "active")
      )
    )
    .limit(1);

  const conn = rows[0];
  if (conn?.accessToken) {
    const expired =
      conn.tokenExpiresAt && new Date(conn.tokenExpiresAt).getTime() < Date.now();
    if (!expired) {
      const base: PublishTarget["publisher"] =
        platform === "instagram" ? instagramPublisher : youtubePublisher;
      // accountId travels with the request (IG user id / YT channel id).
      return {
        publisher: {
          platform,
          publish: (input) => base.publish({ ...input, accountId: input.accountId ?? conn.accountId }),
        },
        sandbox: false,
        connectionId: conn.id,
      };
    }
  }

  if (isSandboxPublishAllowed()) {
    return { publisher: sandboxPublisher(platform), sandbox: true, connectionId: null };
  }

  throw new PublishNotAvailableError(
    `${PLATFORM_LABELS[platform]} is not connected. Connect it in Integrations to publish for real.`
  );
}

export interface PublishAttemptInput {
  workspaceId: string;
  videoId: string;
  platform: PublishPlatform;
  /** auto = triggered by render completion; manual = user pressed Post. */
  mode: "auto" | "manual";
}

export interface PublishAttemptResult {
  postId: string;
  status: "published" | "failed";
  sandbox: boolean;
  permalink: string | null;
  error: string | null;
}

/**
 * Publish one rendered video to one platform. Idempotent per (video, platform):
 * an existing non-failed post is returned as-is; a failed one is retried in
 * place (retryCount++). The posts row always reflects the real outcome.
 */
export async function publishVideoPost(
  input: PublishAttemptInput
): Promise<PublishAttemptResult> {
  if (!isPublishPlatform(input.platform)) {
    throw new Error("Unsupported platform. Supported: instagram, youtube.");
  }

  // Video must be rendered before it can post.
  const videoRows = await db
    .select({
      id: videos.id,
      title: videos.title,
      contentId: videos.contentId,
      renderStatus: videos.renderStatus,
      storageKey: videos.storageKey,
    })
    .from(videos)
    .where(and(eq(videos.id, input.videoId), eq(videos.workspaceId, input.workspaceId)))
    .limit(1);
  const video = videoRows[0];
  if (!video) throw new Error("Video not found.");
  if (video.renderStatus !== "done" || !video.storageKey) {
    throw new Error("This video has not finished rendering yet.");
  }

  // Script (fact-safe) + product title + offer link for the caption.
  const contentRows = await db
    .select({ body: contents.body, productId: contents.productId })
    .from(contents)
    .where(eq(contents.id, video.contentId))
    .limit(1);
  const body = contentRows[0]?.body as
    | { script?: { hook: string; points: string[]; cta: string; fullText: string; mode: string } }
    | null;
  const script = body?.script;
  if (!script) throw new Error("Script content missing for this video.");

  const productRows = contentRows[0]?.productId
    ? await db
        .select({ title: products.title })
        .from(products)
        .where(eq(products.id, contentRows[0].productId!))
        .limit(1)
    : [];
  const productTitle = productRows[0]?.title ?? video.title ?? "Featured product";

  let offerUrl: string | null = null;
  if (contentRows[0]?.productId) {
    const linkRows = await db
      .select({ rawUrl: affiliateLinks.rawUrl })
      .from(affiliateLinks)
      .where(
        and(
          eq(affiliateLinks.workspaceId, input.workspaceId),
          eq(affiliateLinks.productId, contentRows[0].productId!)
        )
      )
      .limit(1);
    offerUrl = linkRows[0]?.rawUrl ?? null;
  }

  const caption = buildCaption({
    platform: input.platform,
    productTitle,
    script: script as never,
    offerUrl,
  });

  // Resolve publisher BEFORE touching the posts row (connection errors are
  // thrown to the caller, not recorded as a failed attempt).
  const target = await resolvePublishTarget(input.workspaceId, input.platform);

  // Existing post for this video+platform? published → no-op; failed → retry.
  const existing = await db
    .select({ id: posts.id, status: posts.status, retryCount: posts.retryCount })
    .from(posts)
    .where(
      and(
        eq(posts.workspaceId, input.workspaceId),
        eq(posts.videoId, input.videoId),
        eq(posts.platform, input.platform)
      )
    )
    .limit(1);

  let postId: string;
  if (existing[0]) {
    if (existing[0].status === "published") {
      const row = await db
        .select({ permalink: posts.permalink, sandbox: posts.sandbox })
        .from(posts)
        .where(eq(posts.id, existing[0].id))
        .limit(1);
      return {
        postId: existing[0].id,
        status: "published",
        sandbox: row[0]?.sandbox ?? false,
        permalink: row[0]?.permalink ?? null,
        error: null,
      };
    }
    postId = existing[0].id;
    await db
      .update(posts)
      .set({
        status: "publishing",
        mode: input.mode,
        sandbox: target.sandbox,
        connectionId: target.connectionId,
        error: null,
        retryCount: (existing[0].retryCount ?? 0) + (existing[0].status === "failed" ? 1 : 0),
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId));
  } else {
    const [created] = await db
      .insert(posts)
      .values({
        workspaceId: input.workspaceId,
        videoId: input.videoId,
        contentId: video.contentId,
        connectionId: target.connectionId,
        platform: input.platform,
        status: "publishing",
        mode: input.mode,
        sandbox: target.sandbox,
        retryCount: 0,
      })
      .returning({ id: posts.id });
    postId = created!.id;
  }

  // Run the publish; record the REAL outcome.
  try {
    const videoAbsPath = resolveVideoAbsPath(video.storageKey);
    const videoUrl =
      input.platform === "instagram"
        ? signMediaUrl({
            baseUrl: publicBaseUrl(),
            videoId: video.id,
            ttlSec: 3600,
          })
        : undefined;

    const result = await target.publisher.publish({
      workspaceId: input.workspaceId,
      videoId: video.id,
      platform: input.platform,
      caption,
      videoAbsPath,
      videoUrl,
      accessToken: "", // filled by live publishers via connection lookup below
      accountId: null,
    });

    await db
      .update(posts)
      .set({
        status: "published",
        platformPostId: result.platformPostId,
        permalink: result.permalink,
        publishedAt: new Date(),
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId));

    return {
      postId,
      status: "published",
      sandbox: target.sandbox,
      permalink: result.permalink,
      error: null,
    };
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    await db
      .update(posts)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(posts.id, postId));
    return { postId, status: "failed", sandbox: target.sandbox, permalink: null, error: message };
  }
}

/** Local FS path for a rendered video (storage key → absolute path). */
function resolveVideoAbsPath(storageKey: string): string {
  // Lazy import avoids a cycle: storage → nothing, but keeps this file focused.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { absolutePath } = require("@/lib/video/storage") as typeof import("@/lib/video/storage");
  return absolutePath(storageKey);
}

/** Pipeline hook: auto-post right after a successful render (never blocks/fails it). */
export async function autoPostAfterRender(opts: {
  workspaceId: string;
  videoId: string;
  platform: string | null;
}): Promise<void> {
  if (!opts.platform || !isPublishPlatform(opts.platform)) return;
  try {
    await publishVideoPost({
      workspaceId: opts.workspaceId,
      videoId: opts.videoId,
      platform: opts.platform,
      mode: "auto",
    });
  } catch (e) {
    // Connection/config problems are logged, not thrown — the render stays done.
    console.error("Auto-post failed:", e);
  }
}
