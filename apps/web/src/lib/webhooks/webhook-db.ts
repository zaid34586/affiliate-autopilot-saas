/**
 * Webhook DB helpers — shared by Instagram / YouTube webhook routes.
 * DB access only; pure logic lives in ./webhook-core.ts (unit-tested).
 */
import { db } from "@/lib/db";
import { dmTriggers, dmMessages, characters, posts, contents, products } from "@aa/db";
import { and, eq, sql } from "drizzle-orm";
import { selectTriggersForEvent, type TriggerRow } from "./webhook-core";

/** Load enabled triggers for ONE workspace (never cross-tenant), then filter by post. */
export async function loadTriggersForEvent(opts: {
  workspaceId: string;
  postId?: string | null;
}): Promise<TriggerRow[]> {
  const rows = await db
    .select({
      id: dmTriggers.id,
      workspaceId: dmTriggers.workspaceId,
      postId: dmTriggers.postId,
      enabled: dmTriggers.enabled,
      keywords: dmTriggers.keywords,
      replyTemplate: dmTriggers.replyTemplate,
      mode: dmTriggers.mode,
      cooldownHours: dmTriggers.cooldownHours,
      dailyCap: dmTriggers.dailyCap,
    })
    .from(dmTriggers)
    .where(and(eq(dmTriggers.workspaceId, opts.workspaceId), eq(dmTriggers.enabled, true)));

  // Pure filter enforces post binding + re-checks enabled/workspace.
  return selectTriggersForEvent(rows as TriggerRow[], opts) as typeof rows;
}

/** Per-recipient cooldown: true = OK to send. */
export async function checkCooldown(
  workspaceId: string,
  recipientHandle: string,
  cooldownHours: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
  const recent = await db
    .select({ id: dmMessages.id })
    .from(dmMessages)
    .where(
      and(
        eq(dmMessages.workspaceId, workspaceId),
        eq(dmMessages.recipientHandle, recipientHandle),
        sql`${dmMessages.createdAt} > ${cutoff.toISOString()}`
      )
    )
    .limit(1);
  return recent.length === 0;
}

/** Daily send cap: true = under cap. */
export async function checkDailyCap(workspaceId: string, dailyCap: number): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(dmMessages)
    .where(
      and(
        eq(dmMessages.workspaceId, workspaceId),
        sql`${dmMessages.createdAt} >= ${today.toISOString()}`
      )
    );
  return (count[0]?.count ?? 0) < dailyCap;
}

/**
 * Resolve a platform media/video id to our post row (per workspace).
 * Instagram media ids and YouTube video ids are stored in posts.platformPostId.
 */
export async function resolvePostByPlatformId(
  workspaceId: string,
  platform: string,
  platformPostId: string
): Promise<{ id: string; contentId: string | null } | null> {
  const [post] = await db
    .select({ id: posts.id, contentId: posts.contentId })
    .from(posts)
    .where(
      and(
        eq(posts.workspaceId, workspaceId),
        eq(posts.platform, platform),
        eq(posts.platformPostId, platformPostId)
      )
    )
    .limit(1);
  return post ?? null;
}

export interface ProductInfo {
  title: string;
  price: string | null;
  currency: string | null;
}

/**
 * Look up the product behind a post (post -> content -> product).
 * Returns null when unknown — callers must NOT invent placeholder names/prices.
 */
export async function lookupProductForPost(
  contentId: string | null
): Promise<ProductInfo | null> {
  if (!contentId) return null;
  const [content] = await db
    .select({ productId: contents.productId })
    .from(contents)
    .where(eq(contents.id, contentId))
    .limit(1);
  if (!content?.productId) return null;
  const [product] = await db
    .select({ title: products.title, price: products.price, currency: products.currency })
    .from(products)
    .where(eq(products.id, content.productId))
    .limit(1);
  if (!product) return null;
  return { title: product.title, price: product.price, currency: product.currency };
}

/** Workspace character (reply voice) — first row, optional. */
export async function getWorkspaceCharacter(
  workspaceId: string
): Promise<{ id: string; name: string } | null> {
  const [char] = await db
    .select({ id: characters.id, name: characters.name })
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId))
    .limit(1);
  return char ?? null;
}

export interface InsertDmInput {
  workspaceId: string;
  characterId: string | null;
  platform: string;
  channel: "comment_reply" | "dm" | "whatsapp" | "inapp_chat";
  recipientHandle: string;
  triggerKeyword: string | null;
  postId: string | null;
  body: string;
  uniqueLinkCode: string;
  sourceCommentId: string;
  status: "queued" | "draft";
  approvalMode: "manual" | "semi" | "auto";
}

/**
 * Idempotent DM insert keyed on (workspaceId, platform, sourceCommentId).
 * Returns true when a NEW row was created, false on webhook retry/duplicate.
 */
export async function insertDmIdempotent(input: InsertDmInput): Promise<boolean> {
  const inserted = await db
    .insert(dmMessages)
    .values({
      workspaceId: input.workspaceId,
      characterId: input.characterId,
      platform: input.platform,
      channel: input.channel,
      recipientHandle: input.recipientHandle,
      triggerKeyword: input.triggerKeyword,
      postId: input.postId,
      body: input.body,
      uniqueLinkCode: input.uniqueLinkCode,
      sourceCommentId: input.sourceCommentId,
      status: input.status,
      approvalMode: input.approvalMode,
    })
    .onConflictDoNothing({
      target: [dmMessages.workspaceId, dmMessages.platform, dmMessages.sourceCommentId],
    })
    .returning({ id: dmMessages.id });
  return inserted.length > 0;
}

/** Has this platform comment already been processed for this workspace? */
export async function isCommentProcessed(
  workspaceId: string,
  platform: string,
  sourceCommentId: string
): Promise<boolean> {
  const existing = await db
    .select({ id: dmMessages.id })
    .from(dmMessages)
    .where(
      and(
        eq(dmMessages.workspaceId, workspaceId),
        eq(dmMessages.platform, platform),
        eq(dmMessages.sourceCommentId, sourceCommentId)
      )
    )
    .limit(1);
  return existing.length > 0;
}
