/**
 * Instagram (Meta Graph API) webhook.
 *
 * GET  — Meta verification handshake (hub.mode=subscribe + META_WEBHOOK_VERIFY_TOKEN).
 * POST — comment events:
 *        1. x-hub-signature-256 verified with timing-safe compare (secret read
 *           inside the handler; 503 if unset).
 *        2. Workspace resolved from entry.id (IG business account id) via the
 *           owning connections row — unknown account => 200 no-op (tenant isolation).
 *        3. Triggers loaded ONLY for that workspace; disabled triggers never fire.
 *        4. Meta retries deduped via (workspaceId, platform, sourceCommentId).
 *        5. Product name/price are looked up from the post — never placeholders.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { connections } from "@aa/db";
import { and, eq } from "drizzle-orm";
import {
  verifyHmacSignature,
  resolveWorkspaceByAccountId,
  parseInstagramComments,
  extractKeywords,
  renderTemplate,
  type WorkspaceConnection,
} from "@/lib/webhooks/webhook-core";
import {
  loadTriggersForEvent,
  checkCooldown,
  checkDailyCap,
  resolvePostByPlatformId,
  lookupProductForPost,
  getWorkspaceCharacter,
  insertDmIdempotent,
} from "@/lib/webhooks/webhook-db";

// Tracked DM links: https://go.affiliateautopilot.app/<code> (Phase 8 adds the
// /go/[code] redirect handler; base domain configurable via TRACKING_BASE_URL).
const LINK_BASE = (
  process.env.TRACKING_BASE_URL ||
  "https://go.affiliateautopilot.app"
).replace(/\/$/, "");

function generateLinkCode(): string {
  return crypto.randomBytes(6).toString("base64url");
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-hub-signature-256");
  const payload = await req.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  // App secret read inside the handler (not module-level `!`).
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error("META_APP_SECRET not configured — cannot verify Instagram webhook");
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  if (!verifyHmacSignature(payload, signature, appSecret, "sha256")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const comments = parseInstagramComments(event);
  if (comments.length === 0) {
    return NextResponse.json({ success: true, ignored: true });
  }

  // Resolve tenant from the IG business account id (entry.id) — first, before
  // touching any trigger. No connection match => acknowledge and do nothing.
  const activeIgConnections = await db
    .select({
      workspaceId: connections.workspaceId,
      provider: connections.provider,
      accountId: connections.accountId,
      status: connections.status,
    })
    .from(connections)
    .where(and(eq(connections.provider, "instagram"), eq(connections.status, "active")));

  const workspaceId = resolveWorkspaceByAccountId(
    activeIgConnections as WorkspaceConnection[],
    "instagram",
    comments[0].entryId
  );

  if (!workspaceId) {
    console.log(
      `Instagram webhook ignored: no active connection for business account ${comments[0].entryId}`
    );
    return NextResponse.json({ success: true, ignored: true });
  }

  let created = 0;
  let deduped = 0;
  let skipped = 0;

  for (const comment of comments) {
    // Tenant isolation: only this workspace's comments are processed.
    if (comment.entryId !== comments[0].entryId) continue;

    // Resolve media -> our post (for trigger binding + product lookup).
    const post = comment.mediaId
      ? await resolvePostByPlatformId(workspaceId, "instagram", comment.mediaId)
      : null;

    const triggers = await loadTriggersForEvent({
      workspaceId,
      postId: post?.id ?? null,
    });

    const character = triggers.length > 0 ? await getWorkspaceCharacter(workspaceId) : null;
    const product = post ? await lookupProductForPost(post.contentId) : null;

    let matchedAny = false;
    for (const trigger of triggers) {
      const keywords = (trigger as { keywords?: { set?: string[]; semantic?: boolean } | null })
        .keywords;
      if (!keywords?.set?.length) continue;

      const matchedKeyword = extractKeywords(
        comment.text,
        keywords.set,
        keywords.semantic ?? false
      );
      if (!matchedKeyword) continue;

      if (!comment.username) {
        skipped++;
        continue;
      }

      const cooldownOk = await checkCooldown(
        workspaceId,
        comment.username,
        (trigger as { cooldownHours?: number | null }).cooldownHours ?? 24
      );
      if (!cooldownOk) continue;

      const capOk = await checkDailyCap(
        workspaceId,
        (trigger as { dailyCap?: number | null }).dailyCap ?? 100
      );
      if (!capOk) continue;

      matchedAny = true;
      const linkCode = generateLinkCode();

      // Product/price only when genuinely known — otherwise leave the vars out.
      const variables: Record<string, string | undefined> = {
        link: `${LINK_BASE}/${linkCode}`,
      };
      if (product) {
        variables.product = product.title;
        variables.price = product.price
          ? `${product.price} ${product.currency ?? ""}`.trim()
          : undefined;
      }

      const dmBody = renderTemplate(
        (trigger as { replyTemplate?: string | null }).replyTemplate ?? "",
        variables
      );

      const isNew = await insertDmIdempotent({
        workspaceId,
        characterId: character?.id ?? null,
        platform: "instagram",
        channel: "dm",
        recipientHandle: comment.username,
        triggerKeyword: matchedKeyword,
        postId: post?.id ?? null,
        body: dmBody,
        uniqueLinkCode: linkCode,
        sourceCommentId: comment.commentId,
        status:
          (trigger as { mode?: string }).mode === "auto" ? "queued" : "draft",
        approvalMode: ((trigger as { mode?: string }).mode ?? "semi") as
          | "manual"
          | "semi"
          | "auto",
      });

      if (isNew) created++;
      else deduped++;
      break; // one DM per comment (first matching trigger wins)
    }

    if (!matchedAny) skipped++;
  }

  return NextResponse.json({ success: true, created, deduped, skipped });
}

/**
 * GET: Meta webhook verification handshake.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && challenge) {
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (!verifyToken) {
      console.error("META_WEBHOOK_VERIFY_TOKEN not configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
    }
    const a = Buffer.from(token);
    const b = Buffer.from(verifyToken);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      console.log("Instagram webhook verified");
      return new NextResponse(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    console.warn("Instagram webhook verification failed: invalid token");
    return NextResponse.json({ error: "Invalid verify token" }, { status: 403 });
  }

  return NextResponse.json({ status: "ok", service: "instagram-webhook" });
}
