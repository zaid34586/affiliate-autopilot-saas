/**
 * YouTube comment polling — the REAL way to receive YouTube comment events.
 *
 * Why polling? YouTube has no comment webhook. PubSubHubbub (the only push
 * mechanism) notifies only about new VIDEOS on a subscribed topic, signed with
 * `X-Hub-Signature: sha1=...`. Comment events are never pushed. The old design
 * (JSON `comment_created` events with a sha256 signature) could never receive
 * a real event — see api/webhooks/youtube/route.ts for the push handshake.
 *
 * This job:
 *  1. Iterates workspaces with an ACTIVE youtube connection (tenant-scoped).
 *  2. Polls YouTube Data API commentThreads for that workspace's published
 *     videos (posts.platformPostId where platform = 'youtube').
 *  3. Dedupes per comment id via dm_messages.source_comment_id (idempotent).
 *  4. Runs the same keyword/cooldown/cap/trigger rules as Instagram.
 *  5. Inserts DM rows as draft/queued — never sends without approval mode.
 *
 * Called from the dm-triggers cron; safe to run twice (fully idempotent).
 */
import { db } from "@/lib/db";
import { connections, posts, dmMessages } from "@aa/db";
import { and, eq, inArray, ne, isNotNull } from "drizzle-orm";
import crypto from "crypto";
import { decryptToken } from "@/lib/crypto/secrets";
import { extractKeywords, renderTemplate, type TriggerRow } from "./webhook-core";
import {
  loadTriggersForEvent,
  checkCooldown,
  checkDailyCap,
  lookupProductForPost,
  getWorkspaceCharacter,
  insertDmIdempotent,
} from "./webhook-db";

const LINK_BASE = (
  process.env.TRACKING_BASE_URL ||
  "https://go.affiliateautopilot.app"
).replace(/\/$/, "");

interface YoutubeCommentItem {
  id: string; // thread id
  topLevelComment: {
    id: string;
    snippet: {
      textDisplay?: string;
      textOriginal?: string;
      authorDisplayName?: string;
      authorChannelId?: { value?: string };
    };
  };
  snippet?: { videoId?: string };
}

function generateLinkCode(): string {
  return crypto.randomBytes(6).toString("base64url");
}

async function fetchCommentsForVideo(
  accessToken: string,
  videoId: string
): Promise<YoutubeCommentItem[]> {
  const params = new URLSearchParams({
    part: "snippet",
    videoId,
    maxResults: "50",
    order: "time",
  });
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/commentThreads?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    // 403 = comments disabled, 404 = video gone — both are normal, not errors.
    if (res.status !== 403 && res.status !== 404) {
      console.warn(`YouTube commentThreads failed for ${videoId}: ${res.status}`);
    }
    return [];
  }
  const data = (await res.json()) as { items?: YoutubeCommentItem[] };
  return data.items ?? [];
}

/**
 * Poll YouTube comments for every workspace with an active youtube connection.
 * Idempotent: duplicate comments are dropped by the unique index.
 */
export async function pollYouTubeComments(): Promise<{
  workspaces: number;
  comments: number;
  created: number;
  deduped: number;
}> {
  const conns = await db
    .select({
      workspaceId: connections.workspaceId,
      accountId: connections.accountId,
      token: connections.accessTokenEnc,
    })
    .from(connections)
    .where(and(eq(connections.provider, "youtube"), eq(connections.status, "active")));

  let commentsScanned = 0;
  let created = 0;
  let deduped = 0;

  for (const conn of conns) {
    if (!conn.token) continue;

    let accessToken: string;
    try {
      accessToken = await decryptToken(conn.token);
    } catch {
      console.warn(`YouTube token decrypt failed for workspace ${conn.workspaceId}`);
      continue;
    }

    // Tenant-scoped: only THIS workspace's published YouTube videos.
    const published = await db
      .select({ id: posts.id, platformPostId: posts.platformPostId, contentId: posts.contentId })
      .from(posts)
      .where(
        and(
          eq(posts.workspaceId, conn.workspaceId),
          eq(posts.platform, "youtube"),
          isNotNull(posts.platformPostId),
          ne(posts.status, "failed")
        )
      )
      .limit(25);

    const videoIds = published
      .map((p) => p.platformPostId)
      .filter((v): v is string => Boolean(v));
    if (videoIds.length === 0) continue;

    const character = await getWorkspaceCharacter(conn.workspaceId);

    for (const videoId of videoIds) {
      const items = await fetchCommentsForVideo(accessToken, videoId);
      if (items.length === 0) continue;

      const post = published.find((p) => p.platformPostId === videoId) ?? null;

      const triggers = (await loadTriggersForEvent({
        workspaceId: conn.workspaceId,
        postId: post?.id ?? null,
      })) as TriggerRow[];

      if (triggers.length === 0) continue;

      // Skip comments we already processed (cheap pre-filter; unique index is the guarantee).
      const commentIds = items
        .map((i) => i.topLevelComment?.id)
        .filter((id): id is string => Boolean(id));
      const already = await db
        .select({ sourceCommentId: dmMessages.sourceCommentId })
        .from(dmMessages)
        .where(
          and(
            eq(dmMessages.workspaceId, conn.workspaceId),
            eq(dmMessages.platform, "youtube"),
            inArray(dmMessages.sourceCommentId, commentIds)
          )
        );
      const seen = new Set(
        already.map((r) => r.sourceCommentId).filter((v): v is string => Boolean(v))
      );

      const product = post ? await lookupProductForPost(post.contentId) : null;

      for (const item of items) {
        const commentId = item.topLevelComment?.id;
        if (!commentId || seen.has(commentId)) continue;
        commentsScanned++;

        const snippet = item.topLevelComment.snippet;
        const text = snippet.textDisplay || snippet.textOriginal || "";
        const author = snippet.authorDisplayName;
        if (!author) continue;

        for (const trigger of triggers) {
          const t = trigger as unknown as {
            keywords?: { set?: string[]; semantic?: boolean } | null;
            replyTemplate?: string | null;
            mode?: string;
            cooldownHours?: number | null;
            dailyCap?: number | null;
          };
          if (!t.keywords?.set?.length) continue;

          const matchedKeyword = extractKeywords(
            text,
            t.keywords.set,
            t.keywords.semantic ?? false
          );
          if (!matchedKeyword) continue;

          const cooldownOk = await checkCooldown(
            conn.workspaceId,
            author,
            t.cooldownHours ?? 24
          );
          if (!cooldownOk) continue;

          const capOk = await checkDailyCap(conn.workspaceId, t.dailyCap ?? 100);
          if (!capOk) continue;

          const linkCode = generateLinkCode();
          const variables: Record<string, string | undefined> = {
            link: `${LINK_BASE}/${linkCode}`,
          };
          if (product) {
            variables.product = product.title;
            variables.price = product.price
              ? `${product.price} ${product.currency ?? ""}`.trim()
              : undefined;
          }

          const body = renderTemplate(t.replyTemplate ?? "", variables);

          const isNew = await insertDmIdempotent({
            workspaceId: conn.workspaceId,
            characterId: character?.id ?? null,
            platform: "youtube",
            channel: "comment_reply",
            recipientHandle: author,
            triggerKeyword: matchedKeyword,
            postId: post?.id ?? null,
            body,
            uniqueLinkCode: linkCode,
            sourceCommentId: commentId,
            // YouTube has no DM API — replies are drafted for approval unless auto.
            status: t.mode === "auto" ? "queued" : "draft",
            approvalMode: (t.mode ?? "semi") as "manual" | "semi" | "auto",
          });

          if (isNew) created++;
          else deduped++;
          break; // one DM per comment
        }
      }
    }
  }

  return { workspaces: conns.length, comments: commentsScanned, created, deduped };
}
