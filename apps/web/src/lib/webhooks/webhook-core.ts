/**
 * Webhook Core — pure helpers for provider webhooks (Instagram, YouTube, WhatsApp).
 * No DB / no env access — fully unit-testable (see webhook-core.test.ts).
 */
import crypto from "crypto";

export interface WorkspaceConnection {
  workspaceId: string;
  provider: string;
  accountId?: string | null;
  phoneNumberId?: string | null;
  status: string;
}

export interface TriggerRow {
  id: string;
  workspaceId: string;
  postId: string | null;
  enabled: boolean;
}

/**
 * Constant-time HMAC signature verification (timing-safe, length-mismatch safe).
 * Accepts signatures with or without the `<algorithm>=` prefix.
 */
export function verifyHmacSignature(
  payload: string,
  signature: string | null | undefined,
  secret: string | null | undefined,
  algorithm: "sha1" | "sha256" = "sha256"
): boolean {
  if (!payload || !signature || !secret) return false;
  const expected = crypto.createHmac(algorithm, secret).update(payload).digest("hex");
  const prefix = `${algorithm}=`;
  const provided = signature.startsWith(prefix) ? signature.slice(prefix.length) : signature;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Resolve the workspace that owns a provider account id (e.g. IG business account id).
 * Only ACTIVE connections count. Returns null when nothing matches (caller must no-op).
 */
export function resolveWorkspaceByAccountId(
  connections: WorkspaceConnection[],
  provider: string,
  accountId: string | null | undefined
): string | null {
  if (!accountId) return null;
  const match = connections.find(
    (c) =>
      c.provider === provider &&
      c.status === "active" &&
      c.accountId === accountId
  );
  return match?.workspaceId ?? null;
}

/**
 * Resolve workspace from a WhatsApp Cloud API phone_number_id.
 * Only ACTIVE connections with a stored phone_number_id match.
 * There is intentionally NO "first workspace" fallback — unknown numbers are ignored.
 */
export function resolveWorkspaceByPhoneNumber(
  connections: WorkspaceConnection[],
  phoneNumberId: string | null | undefined
): string | null {
  if (!phoneNumberId) return null;
  const match = connections.find(
    (c) => c.status === "active" && c.phoneNumberId === phoneNumberId
  );
  return match?.workspaceId ?? null;
}

/**
 * Select which DM triggers may fire for an event.
 * - disabled triggers never fire
 * - triggers from other workspaces never fire (cross-tenant isolation)
 * - a trigger bound to a specific post only fires for that post
 * - an unbound trigger (postId = null) fires for any post — and for events with no post
 */
export function selectTriggersForEvent(
  triggers: TriggerRow[],
  opts: { workspaceId: string; postId?: string | null }
): TriggerRow[] {
  return triggers.filter((t) => {
    if (!t.enabled) return false;
    if (t.workspaceId !== opts.workspaceId) return false;
    if (t.postId == null) return true;
    return opts.postId != null && t.postId === opts.postId;
  });
}

/** Exact keyword match (case-insensitive), falling back to semantic phrase match. */
export function extractKeywords(
  text: string,
  keywordSet: string[],
  semantic: boolean
): string | null {
  const lower = text.toLowerCase();
  for (const kw of keywordSet) {
    if (lower.includes(kw.toLowerCase())) return kw;
  }
  if (semantic) {
    const phrases = [
      "how much",
      "price",
      "cost",
      "kitne",
      "kaisa",
      "rate",
      "link",
      "url",
      "where to buy",
      "buy link",
      "purchase",
      "buy",
      "order",
      "get it",
      "want this",
    ];
    for (const phrase of phrases) {
      if (lower.includes(phrase)) return phrase;
    }
  }
  return null;
}

/** Replace {{var}} placeholders. Unknown vars render as "" (never as fake data). */
export function renderTemplate(
  template: string,
  variables: Record<string, string | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
}

export interface WhatsAppPayloadContext {
  phoneNumberId: string | null;
  /** WhatsApp message/status ids present in the payload (for dedupe). */
  messageIds: string[];
}

/** Extract phone_number_id + message ids from a Meta WhatsApp Cloud API payload. */
export function extractWhatsAppContext(
  payload: Record<string, unknown>
): WhatsAppPayloadContext {
  const phoneNumberId =
    (payload.entry as Array<{
      changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }>;
    }> | undefined)?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;

  const messageIds: string[] = [];
  const entry = (payload.entry as Array<{
    changes?: Array<{ value?: { messages?: Array<{ id?: string }>; statuses?: Array<{ id?: string }> } }>;
  }> | undefined) ?? [];
  for (const e of entry) {
    for (const change of e.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      for (const m of value.messages ?? []) if (m?.id) messageIds.push(m.id);
      for (const s of value.statuses ?? []) if (s?.id) messageIds.push(s.id);
    }
  }
  return { phoneNumberId, messageIds };
}

/** Parse an Instagram webhook payload → [{ entryId, commentId, mediaId, text, username }]. */
export interface InstagramCommentEvent {
  entryId: string;
  commentId: string;
  mediaId: string | null;
  text: string;
  username: string | null;
}

export function parseInstagramComments(
  payload: Record<string, unknown>
): InstagramCommentEvent[] {
  const out: InstagramCommentEvent[] = [];
  if (payload.object !== "instagram") return out;
  const entries = (payload.entry as Array<{
    id?: string;
    changes?: Array<{ field?: string; value?: Record<string, unknown> }>;
  }> | undefined) ?? [];
  for (const entry of entries) {
    if (!entry.id) continue;
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments" || !change.value) continue;
      const value = change.value as {
        id?: string;
        text?: string;
        from?: { username?: string };
        media?: { id?: string };
      };
      if (!value.id) continue;
      out.push({
        entryId: entry.id,
        commentId: value.id,
        mediaId: value.media?.id ?? null,
        text: value.text ?? "",
        username: value.from?.username ?? null,
      });
    }
  }
  return out;
}
