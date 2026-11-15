/**
 * Phase 7 — Knowledge Base Core (pure logic).
 *
 * Text extraction (PDF / DOCX / HTML), chunking, retrieval scoring,
 * and AI context building. No external deps — uses node:zlib only.
 */

import zlib from "node:zlib";

// ───────────────────────── TEXT EXTRACTION: PDF ─────────────────────────

/** Decode a PDF literal string starting at `start` (points at "("). */
function readPdfLiteralString(src: string, start: number): { text: string; end: number } {
  let out = "";
  let depth = 0;
  let i = start;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      const n = src[i + 1];
      if (n === "n") out += "\n";
      else if (n === "r") out += "\r";
      else if (n === "t") out += "\t";
      else if (n === "b" || n === "f") out += "";
      else if (n >= "0" && n <= "7") {
        // octal escape \ddd
        const oct = src.slice(i + 1, i + 4).match(/^[0-7]{1,3}/);
        if (oct) {
          out += String.fromCharCode(parseInt(oct[0], 8));
          i += oct[0].length;
        }
      } else out += n ?? ""; // \( \) \\ and line continuations
      i += 2;
      continue;
    }
    if (c === "(") {
      depth++;
      if (depth > 1) out += "(";
      i++;
      continue;
    }
    if (c === ")") {
      depth--;
      if (depth === 0) return { text: out, end: i + 1 };
      out += ")";
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return { text: out, end: i };
}

function decodeHexString(hex: string): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, "");
  let out = "";
  for (let i = 0; i + 1 < clean.length; i += 2) {
    out += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  }
  if (clean.length % 2 === 1) {
    out += String.fromCharCode(parseInt(clean[clean.length - 1] + "0", 16));
  }
  return out;
}

/** Extract readable text from a PDF content stream (BT…ET operators). */
function textFromContentStream(content: string): string {
  let out = "";
  let i = 0;

  while (i < content.length) {
    const c = content[i];

    // Comment to end of line
    if (c === "%") {
      const nl = content.indexOf("\n", i);
      i = nl === -1 ? content.length : nl + 1;
      continue;
    }

    // Inline image: skip BI … ID <data> EI (data may contain parens)
    if (content.startsWith("BI", i) && (i === 0 || /[\s[]/.test(content[i - 1]))) {
      const id = content.indexOf(" ID", i);
      if (id !== -1) {
        const ei = content.indexOf("EI", id);
        i = ei === -1 ? content.length : ei + 2;
        continue;
      }
    }

    // Literal string → append
    if (c === "(") {
      const { text, end } = readPdfLiteralString(content, i);
      out += text;
      i = end;
      continue;
    }

    // Hex string → append (skip the second "<" of a dict "<<")
    if (c === "<" && content[i + 1] !== "<" && content[i - 1] !== "<") {
      const close = content.indexOf(">", i);
      if (close !== -1) {
        out += decodeHexString(content.slice(i + 1, close));
        i = close + 1;
        continue;
      }
    }

    // Line-advance operators → newline
    if (content.startsWith("Td", i) || content.startsWith("TD", i) ||
        content.startsWith("T*", i) || content.startsWith("ET", i)) {
      const before = content[i - 1];
      if (before === undefined || /[\s)\]>]/.test(before)) {
        if (!out.endsWith("\n")) out += "\n";
        i += 2;
        continue;
      }
    }

    i++;
  }

  return out;
}

/**
 * Best-effort PDF text extraction.
 * Inflates FlateDecode streams (and passes through uncompressed ones),
 * then parses text-showing operators. Throws when nothing extractable
 * (e.g. scanned/image-only PDFs).
 */
export function extractPdfText(bytes: Uint8Array): string {
  const data = Buffer.from(bytes);
  const parts: string[] = [];
  let pos = 0;

  while (true) {
    const s = data.indexOf("stream", pos);
    if (s === -1) break;

    let start = s + 6;
    if (data[start] === 0x0d) start++;
    if (data[start] === 0x0a) start++;

    const e = data.indexOf("endstream", start);
    if (e === -1) break;

    let chunk = data.subarray(start, e);
    // strip one trailing EOL that belongs to the stream framing
    if (chunk.length > 0 && chunk[chunk.length - 1] === 0x0a) chunk = chunk.subarray(0, chunk.length - 1);
    if (chunk.length > 0 && chunk[chunk.length - 1] === 0x0d) chunk = chunk.subarray(0, chunk.length - 1);

    let text = "";
    // Try inflated first (stripped framing EOL, then raw), then uncompressed
    for (const candidate of [chunk, data.subarray(start, e)]) {
      try {
        const inflated = zlib.inflateSync(candidate);
        text = textFromContentStream(inflated.toString("latin1"));
        break;
      } catch {
        // try next candidate
      }
    }
    if (!text) {
      const raw = chunk.toString("latin1");
      if (/\b(Tj|TJ|BT)\b/.test(raw)) {
        text = textFromContentStream(raw);
      }
    }

    if (text.trim()) parts.push(text);
    pos = e + 9;
  }

  const result = parts
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!result) {
    throw new Error(
      "No extractable text in this PDF — scanned or image-only PDFs are not supported. Upload a text-based PDF, DOCX, or paste the text.",
    );
  }
  return result;
}

// ───────────────────────── TEXT EXTRACTION: DOCX ─────────────────────────

interface ZipEntry {
  method: number;
  compressedSize: number;
  data: Buffer;
}

/**
 * Minimal ZIP reader (central directory walk). Only reads stored (0)
 * and deflated (8) entries — enough for DOCX files.
 */
function readZipEntries(buf: Buffer): Map<string, ZipEntry> {
  const entries = new Map<string, ZipEntry>();

  // EOCD: signature 0x06054b50, scanned from the end (comment ≤ 65535)
  let eocd = -1;
  const scanStart = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= scanStart; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("Invalid DOCX (zip central directory not found)");

  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.subarray(offset + 46, offset + 46 + nameLen).toString("utf8");

    // Local header: 30 bytes + name + extra → data
    if (localOffset + 30 <= buf.length && buf.readUInt32LE(localOffset) === 0x04034b50) {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      entries.set(name, {
        method,
        compressedSize,
        data: buf.subarray(dataStart, dataStart + compressedSize),
      });
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extract plain text from a DOCX (zip) file. */
export function extractDocxText(bytes: Uint8Array): string {
  const entries = readZipEntries(Buffer.from(bytes));
  const doc = entries.get("word/document.xml");
  if (!doc) throw new Error("Invalid DOCX (word/document.xml missing)");

  let xml: string;
  if (doc.method === 0) {
    xml = doc.data.toString("utf8");
  } else if (doc.method === 8) {
    xml = zlib.inflateRawSync(doc.data).toString("utf8");
  } else {
    throw new Error(`Unsupported DOCX compression method: ${doc.method}`);
  }

  const text = xmlToText(xml);
  if (!text) throw new Error("DOCX contains no extractable text");
  return text;
}

// ───────────────────────── TEXT EXTRACTION: HTML ─────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

/** Strip HTML to readable plain text (for URL ingestion). */
export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ───────────────────────── FILE DISPATCH ─────────────────────────

/** Decide source type + extract text from an uploaded file. */
export function extractFileText(
  bytes: Uint8Array,
  filename: string,
): { sourceType: string; text: string } {
  const ext = (filename.split(".").pop() || "").toLowerCase();

  if (ext === "pdf") return { sourceType: "pdf", text: extractPdfText(bytes) };
  if (ext === "docx") return { sourceType: "docx", text: extractDocxText(bytes) };

  if (["txt", "md", "markdown", "csv", "json", "rtf", "log"].includes(ext)) {
    return { sourceType: ext === "md" || ext === "markdown" ? "markdown" : "text", text: Buffer.from(bytes).toString("utf8") };
  }

  if (ext === "html" || ext === "htm") {
    return { sourceType: "text", text: stripHtml(Buffer.from(bytes).toString("utf8")) };
  }

  // Unknown extension: accept when it decodes as mostly-printable UTF-8
  const text = Buffer.from(bytes).toString("utf8");
  const printable = text.replace(/[\s]/g, "").length;
  const bad = (text.match(/[�\u0000-\u0008]/g) || []).length;
  if (text.length > 0 && bad / Math.max(1, printable) < 0.05) {
    return { sourceType: "text", text };
  }

  throw new Error(`Unsupported file type ".${ext}" — upload PDF, DOCX, TXT, MD, or HTML.`);
}

// ───────────────────────── CHUNKING ─────────────────────────

/**
 * Split text into overlapping chunks (~`size` chars, ~`overlap` chars
 * carried into the next chunk), breaking on word boundaries.
 */
export function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const clean = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const words = clean.split(/\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let curLen = 0;
  let carryLen = 0; // words carried from previous chunk (not "new")

  for (const w of words) {
    current.push(w);
    curLen += w.length + 1;
    if (curLen >= size) {
      chunks.push(current.join(" "));
      // carry overlap words into the next chunk
      const keep: string[] = [];
      let kept = 0;
      if (overlap > 0) {
        for (let i = current.length - 1; i >= 0; i--) {
          keep.unshift(current[i]);
          kept += current[i].length + 1;
          if (kept >= overlap) break;
        }
      }
      current = keep;
      curLen = kept;
      carryLen = keep.length;
    }
  }

  // Trailing chunk only when it has content beyond the overlap carry
  if (current.length > carryLen) chunks.push(current.join(" "));
  return chunks;
}

// ───────────────────────── RETRIEVAL ─────────────────────────

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "is", "it", "for", "on",
  "with", "as", "at", "by", "be", "this", "that", "are", "was", "were",
  "from", "but", "not", "you", "your", "we", "our", "i", "they", "their",
  "have", "has", "had", "do", "does", "did", "will", "would", "can", "could",
]);

/** Lowercase alphanumeric tokens, stopwords removed. */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

export interface ScoredChunk {
  chunkIndex: number;
  content: string;
  score: number;
}

/**
 * Score a chunk against a query: term-frequency overlap plus a bonus
 * for containing the full query phrase.
 */
export function scoreChunk(query: string, chunk: string): number {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const t of tokenize(chunk)) counts.set(t, (counts.get(t) || 0) + 1);

  let score = 0;
  for (const term of new Set(qTokens)) {
    const n = counts.get(term) || 0;
    if (n > 0) score += Math.min(n, 3) * 3;
  }

  const phrase = query.toLowerCase().trim();
  if (phrase.length >= 6 && chunk.toLowerCase().includes(phrase)) score += 10;

  return score;
}

/** Rank chunks for a query; drops zero-score chunks. */
export function retrieveChunks(
  chunks: Array<{ chunkIndex: number; content: string }>,
  query: string,
  limit = 6,
): ScoredChunk[] {
  return chunks
    .map((c) => ({ ...c, score: scoreChunk(query, c.content) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex)
    .slice(0, limit);
}

export interface KbContextHit {
  chunkIndex: number;
  content: string;
  score: number;
  title?: string;
}

/**
 * Build the context block injected into AI prompts from retrieved hits.
 * Returns "" when nothing relevant was found.
 */
export function buildKbContext(hits: KbContextHit[], maxChars = 4000): string {
  if (hits.length === 0) return "";

  const lines: string[] = ["KNOWLEDGE BASE (from the user's uploaded documents):"];
  let used = lines[0].length;

  for (const hit of hits) {
    const block = `\n[${hit.title || "Document"}]\n${hit.content.trim()}`;
    if (used + block.length > maxChars) break;
    lines.push(block);
    used += block.length;
  }

  return lines.join("");
}

// ───────────────────────── VALIDATION ─────────────────────────

export const KB_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024, // 10MB
  maxContentChars: 500_000,
  maxTitleLen: 200,
  minTextChars: 20,
} as const;

export function validateTitle(title: string): { ok: boolean; error?: string } {
  const t = title.trim();
  if (!t) return { ok: false, error: "Title is required" };
  if (t.length > KB_LIMITS.maxTitleLen) return { ok: false, error: `Title must be ≤ ${KB_LIMITS.maxTitleLen} chars` };
  return { ok: true };
}

export function validateExtractedText(text: string): { ok: boolean; error?: string } {
  if (text.trim().length < KB_LIMITS.minTextChars) {
    return { ok: false, error: "Extracted text is too short — the document appears empty." };
  }
  if (text.length > KB_LIMITS.maxContentChars) {
    return { ok: false, error: `Document too large — max ${KB_LIMITS.maxContentChars.toLocaleString()} chars.` };
  }
  return { ok: true };
}

/** Only http(s) URLs, no local/network address tricks. */
export function validateUrl(raw: string): { ok: boolean; url?: string; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http(s) URLs are allowed" };
  }
  return { ok: true, url: parsed.toString() };
}
