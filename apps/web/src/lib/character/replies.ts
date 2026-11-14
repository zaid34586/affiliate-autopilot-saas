/**
 * Phase 5 Module C — Comment inbox DB orchestration.
 * Ingest → sentiment + suggested reply (pure core) → approval flow.
 * Delivery is sandbox until platform reply APIs are connected — the
 * API always returns delivery:"sandbox" so the UI can label it honestly.
 */

import { db } from "@/lib/db";
import { characters, postComments, posts, videos } from "@aa/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  buildCommentReply,
  type CommentApprovalMode,
  type Sentiment,
} from "./replies-core";

export interface DiscussSettings {
  comments: CommentApprovalMode | "off";
  dm: CommentApprovalMode | "off";
}

const DEFAULT_SETTINGS: DiscussSettings = { comments: "semi", dm: "off" };

export async function getDiscussSettings(
  workspaceId: string,
): Promise<{ settings: DiscussSettings; characterName: string } | null> {
  const [character] = await db
    .select({
      name: characters.name,
      discussSettings: characters.discussSettings,
    })
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId))
    .limit(1);

  if (!character) return null;

  const raw = (character.discussSettings ?? {}) as Partial<DiscussSettings>;
  return {
    settings: {
      comments: raw.comments ?? DEFAULT_SETTINGS.comments,
      dm: raw.dm ?? DEFAULT_SETTINGS.dm,
    },
    characterName: character.name,
  };
}

export async function updateDiscussSettings(
  workspaceId: string,
  patch: Partial<DiscussSettings>,
): Promise<DiscussSettings> {
  const [character] = await db
    .select({ id: characters.id, discussSettings: characters.discussSettings })
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId))
    .limit(1);
  if (!character) throw new Error("No character yet");

  const current = (character.discussSettings ?? {}) as Partial<DiscussSettings>;
  const next: DiscussSettings = {
    comments: patch.comments ?? current.comments ?? DEFAULT_SETTINGS.comments,
    dm: patch.dm ?? current.dm ?? DEFAULT_SETTINGS.dm,
  };

  await db
    .update(characters)
    .set({ discussSettings: next as unknown as Record<string, unknown> })
    .where(eq(characters.id, character.id));

  return next;
}

export interface IngestInput {
  platform: string;
  postId?: string | null;
  authorHandle: string;
  body: string;
}

export interface CommentRow {
  id: string;
  platform: string;
  authorHandle: string;
  body: string;
  sentiment: string | null;
  suggestedReply: string | null;
  status: string;
  approvalMode: string;
  repliedAt: Date | null;
  createdAt: Date;
  postTitle: string | null;
}

/** Ingest a comment: classify + suggest reply per approval settings. */
export async function ingestComment(
  workspaceId: string,
  input: IngestInput,
): Promise<{
  id: string;
  status: string;
  sentiment: Sentiment;
  suggestedReply: string;
  autoSent: boolean;
  delivery: "sandbox";
  reasons: string[];
}> {
  const ctx = await getDiscussSettings(workspaceId);
  if (!ctx) throw new Error("No character yet");

  const mode = ctx.settings.comments;
  const body = input.body.trim();
  if (!body) throw new Error("Comment body is required");

  let characterId: string | null = null;
  const [character] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId))
    .limit(1);
  characterId = character?.id ?? null;

  // Approval level "off" → store but never suggest or send.
  if (mode === "off") {
    const [row] = await db
      .insert(postComments)
      .values({
        workspaceId,
        characterId,
        postId: input.postId ?? null,
        platform: input.platform,
        authorHandle: input.authorHandle,
        body,
        status: "dismissed",
        approvalMode: "manual",
      })
      .returning({ id: postComments.id });

    return {
      id: row!.id,
      status: "dismissed",
      sentiment: "neutral",
      suggestedReply: "",
      autoSent: false,
      delivery: "sandbox",
      reasons: ["Comment replies are turned off — stored without a reply."],
    };
  }

  const result = buildCommentReply(
    {
      body,
      authorHandle: input.authorHandle,
      characterName: ctx.characterName,
      niche: null,
    },
    mode,
  );

  const autoSent = result.autoSend;
  const [row] = await db
    .insert(postComments)
    .values({
      workspaceId,
      characterId,
      postId: input.postId ?? null,
      platform: input.platform,
      authorHandle: input.authorHandle,
      body,
      sentiment: result.sentiment,
      suggestedReply: result.reply || null,
      status: autoSent ? "replied" : result.blocked ? "dismissed" : "pending",
      approvalMode: mode,
      repliedAt: autoSent ? new Date() : null,
    })
    .returning({ id: postComments.id });

  return {
    id: row!.id,
    status: autoSent ? "replied" : result.blocked ? "dismissed" : "pending",
    sentiment: result.sentiment,
    suggestedReply: result.reply,
    autoSent,
    delivery: "sandbox",
    reasons: result.reasons,
  };
}

/** Approve + "send" a suggested reply. Sandbox delivery (honest label). */
export async function approveComment(
  workspaceId: string,
  id: string,
  overrideReply?: string,
): Promise<{ delivery: "sandbox"; repliedAt: Date }> {
  const [comment] = await db
    .select()
    .from(postComments)
    .where(and(eq(postComments.id, id), eq(postComments.workspaceId, workspaceId)))
    .limit(1);

  if (!comment) throw new Error("Comment not found");
  if (comment.status === "replied") throw new Error("Already replied");
  if (comment.status === "dismissed") throw new Error("Comment was dismissed");

  const reply = (overrideReply ?? comment.suggestedReply ?? "").trim();
  if (!reply) throw new Error("No reply to send");

  const repliedAt = new Date();
  await db
    .update(postComments)
    .set({
      status: "replied",
      suggestedReply: reply,
      repliedAt,
    })
    .where(eq(postComments.id, id));

  return { delivery: "sandbox", repliedAt };
}

export async function dismissComment(
  workspaceId: string,
  id: string,
): Promise<void> {
  const [comment] = await db
    .select({ id: postComments.id })
    .from(postComments)
    .where(and(eq(postComments.id, id), eq(postComments.workspaceId, workspaceId)))
    .limit(1);
  if (!comment) throw new Error("Comment not found");

  await db
    .update(postComments)
    .set({ status: "dismissed" })
    .where(eq(postComments.id, id));
}

/** List comments newest-first with the post title when linked. */
export async function listComments(workspaceId: string): Promise<CommentRow[]> {
  const rows = await db
    .select()
    .from(postComments)
    .where(eq(postComments.workspaceId, workspaceId))
    .orderBy(desc(postComments.createdAt))
    .limit(100);

  const postIds = rows
    .map((r) => r.postId)
    .filter((v): v is string => Boolean(v));
  const titles = new Map<string, string>();
  if (postIds.length > 0) {
    const linked = await db
      .select({ id: posts.id, videoId: posts.videoId })
      .from(posts)
      .where(inArray(posts.id, postIds));
    const videoIds = [
      ...new Set(linked.map((p) => p.videoId).filter((v): v is string => Boolean(v))),
    ];
    const videoTitles = new Map<string, string>();
    if (videoIds.length > 0) {
      const vids = await db
        .select({ id: videos.id, title: videos.title })
        .from(videos)
        .where(inArray(videos.id, videoIds));
      for (const v of vids) videoTitles.set(v.id, v.title ?? "Untitled");
    }
    for (const p of linked) {
      if (p.videoId) titles.set(p.id, videoTitles.get(p.videoId) ?? "Untitled");
    }
  }

  return rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    authorHandle: r.authorHandle,
    body: r.body,
    sentiment: r.sentiment,
    suggestedReply: r.suggestedReply,
    status: r.status,
    approvalMode: r.approvalMode,
    repliedAt: r.repliedAt,
    createdAt: r.createdAt,
    postTitle: r.postId ? (titles.get(r.postId) ?? null) : null,
  }));
}
