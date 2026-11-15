/**
 * Phase 7 — Knowledge Base (DB orchestration).
 *
 * Ingestion (file / URL / raw text), chunking, search, and the
 * context builder used by the copilot / support bot.
 */

import { db } from "@/lib/db";
import { knowledgeDocuments, knowledgeChunks } from "@aa/db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  chunkText,
  scoreChunk,
  buildKbContext,
  extractFileText,
  stripHtml,
  validateTitle,
  validateExtractedText,
  validateUrl,
  KB_LIMITS,
} from "./kb-core";

export interface KbDocumentSummary {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  status: string;
  chunkCount: number;
  charCount: number;
  createdAt: string;
}

function toSummary(row: typeof knowledgeDocuments.$inferSelect): KbDocumentSummary {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    status: row.status,
    chunkCount: row.chunkCount,
    charCount: row.charCount,
    createdAt: row.createdAt.toISOString(),
  };
}

function limitChars(text: string): string {
  return text.slice(0, KB_LIMITS.maxContentChars);
}

/** Insert document + chunks atomically-ish (chunks after doc). */
async function insertDocument(input: {
  workspaceId: string;
  createdBy: string;
  title: string;
  sourceType: string;
  sourceUrl?: string | null;
  text: string;
}): Promise<KbDocumentSummary> {
  const text = limitChars(input.text);
  const validation = validateExtractedText(text);
  if (!validation.ok) throw new Error(validation.error);

  const chunks = chunkText(text);
  if (chunks.length === 0) throw new Error("Document produced no chunks");

  const [doc] = await db
    .insert(knowledgeDocuments)
    .values({
      workspaceId: input.workspaceId,
      title: input.title.trim().slice(0, KB_LIMITS.maxTitleLen),
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl ?? null,
      content: text,
      status: "ready",
      chunkCount: chunks.length,
      charCount: text.length,
      createdBy: input.createdBy,
    })
    .returning();

  await db.insert(knowledgeChunks).values(
    chunks.map((content, i) => ({
      documentId: doc.id,
      workspaceId: input.workspaceId,
      chunkIndex: i,
      content,
    })),
  );

  return toSummary(doc);
}

// ───────────────────────── INGESTION ─────────────────────────

export async function ingestFile(input: {
  workspaceId: string;
  createdBy: string;
  filename: string;
  bytes: Uint8Array;
  title?: string;
}): Promise<KbDocumentSummary> {
  if (input.bytes.byteLength > KB_LIMITS.maxFileBytes) {
    throw new Error(`File too large — max ${KB_LIMITS.maxFileBytes / (1024 * 1024)}MB`);
  }

  const { sourceType, text } = extractFileText(input.bytes, input.filename);
  const title = (input.title || input.filename).trim();
  const v = validateTitle(title);
  if (!v.ok) throw new Error(v.error);

  return insertDocument({
    workspaceId: input.workspaceId,
    createdBy: input.createdBy,
    title,
    sourceType,
    text,
  });
}

export async function ingestUrl(input: {
  workspaceId: string;
  createdBy: string;
  url: string;
  title?: string;
}): Promise<KbDocumentSummary> {
  const v = validateUrl(input.url);
  if (!v.ok) throw new Error(v.error);

  const res = await fetch(v.url!, {
    signal: AbortSignal.timeout(15_000),
    headers: { "user-agent": "AffiliateAutopilot-KB/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Failed to fetch URL (HTTP ${res.status})`);

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/pdf")) {
    throw new Error("PDF URLs are not supported — download the PDF and upload it directly.");
  }

  const html = await res.text();
  const text = stripHtml(html);
  const title = (input.title || safeTitleFromHtml(html) || new URL(v.url!).hostname).trim();
  const tv = validateTitle(title);
  if (!tv.ok) throw new Error(tv.error);

  return insertDocument({
    workspaceId: input.workspaceId,
    createdBy: input.createdBy,
    title,
    sourceType: "url",
    sourceUrl: v.url,
    text,
  });
}

function safeTitleFromHtml(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  return m[1].replace(/\s+/g, " ").trim().slice(0, KB_LIMITS.maxTitleLen) || null;
}

export async function ingestText(input: {
  workspaceId: string;
  createdBy: string;
  title: string;
  text: string;
  sourceType?: string;
}): Promise<KbDocumentSummary> {
  const v = validateTitle(input.title);
  if (!v.ok) throw new Error(v.error);

  return insertDocument({
    workspaceId: input.workspaceId,
    createdBy: input.createdBy,
    title: input.title,
    sourceType: input.sourceType || "text",
    text: input.text,
  });
}

// ───────────────────────── READ / DELETE ─────────────────────────

export async function listDocuments(workspaceId: string): Promise<KbDocumentSummary[]> {
  const rows = await db
    .select()
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.workspaceId, workspaceId))
    .orderBy(desc(knowledgeDocuments.createdAt))
    .limit(200);
  return rows.map(toSummary);
}

export async function getDocument(workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(knowledgeDocuments)
    .where(and(eq(knowledgeDocuments.id, id), eq(knowledgeDocuments.workspaceId, workspaceId)))
    .limit(1);
  if (!row) return null;
  return { ...toSummary(row), content: row.content };
}

export async function deleteDocument(workspaceId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(knowledgeDocuments)
    .where(and(eq(knowledgeDocuments.id, id), eq(knowledgeDocuments.workspaceId, workspaceId)))
    .returning({ id: knowledgeDocuments.id });
  return result.length > 0;
}

// ───────────────────────── SEARCH (for AI) ─────────────────────────

export interface KbHit {
  documentId: string;
  title: string;
  chunkIndex: number;
  content: string;
  score: number;
}

/**
 * Retrieve the most relevant chunks for a query within a workspace.
 * Returns [] when the workspace has no documents or nothing matches.
 */
export async function searchKnowledge(
  workspaceId: string,
  query: string,
  limit = 6,
): Promise<KbHit[]> {
  if (!query.trim()) return [];

  const [docCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.workspaceId, workspaceId))
    .limit(1);
  if (!Number(docCount?.n || 0)) return [];

  const rows = await db
    .select({
      id: knowledgeChunks.id,
      documentId: knowledgeChunks.documentId,
      chunkIndex: knowledgeChunks.chunkIndex,
      content: knowledgeChunks.content,
      title: knowledgeDocuments.title,
    })
    .from(knowledgeChunks)
    .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
    .where(eq(knowledgeChunks.workspaceId, workspaceId))
    .limit(2000);

  // Score directly on rows (preserves document identity)
  return rows
    .map((r) => ({ ...r, score: scoreChunk(query, r.content) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex)
    .slice(0, limit)
    .map((r) => ({
      documentId: r.documentId,
      title: r.title,
      chunkIndex: r.chunkIndex,
      content: r.content,
      score: r.score,
    }));
}

/**
 * Build an AI context block from the workspace knowledge base for a
 * given user message. Returns "" when nothing relevant.
 */
export async function buildKbContextForMessage(
  workspaceId: string,
  message: string,
  maxChars = 4000,
): Promise<string> {
  try {
    const hits = await searchKnowledge(workspaceId, message, 6);
    if (hits.length === 0) return "";

    return buildKbContext(
      hits.map((h) => ({
        chunkIndex: h.chunkIndex,
        content: h.content,
        score: h.score,
        title: h.title,
      })),
      maxChars,
    );
  } catch (error) {
    console.error("KB context build error:", error);
    return ""; // never break the chat because of KB
  }
}
