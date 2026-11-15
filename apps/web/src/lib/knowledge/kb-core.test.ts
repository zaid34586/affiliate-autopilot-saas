/**
 * Phase 7 — Knowledge Base Core Tests
 */

import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import {
  extractPdfText,
  extractDocxText,
  stripHtml,
  extractFileText,
  chunkText,
  tokenize,
  scoreChunk,
  retrieveChunks,
  buildKbContext,
  validateTitle,
  validateExtractedText,
  validateUrl,
  KB_LIMITS,
} from "./kb-core";

// ───────────────────────── FIXTURE BUILDERS ─────────────────────────

/** Minimal single-stream PDF. Pass deflated content to test FlateDecode. */
function buildPdf(content: string, deflate = false): Buffer {
  const stream = deflate ? zlib.deflateSync(Buffer.from(content, "latin1")) : Buffer.from(content, "latin1");
  return Buffer.concat([
    Buffer.from("%PDF-1.4\n1 0 obj\n<< /Length " + stream.length + " >>\nstream\n", "latin1"),
    stream,
    Buffer.from("\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1"),
  ]);
}

/** Minimal ZIP with stored (or deflated) entries — enough for DOCX. */
function buildZip(entries: Array<{ name: string; data: Buffer; deflate?: boolean }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const payload = e.deflate ? zlib.deflateRawSync(e.data) : e.data;
    const method = e.deflate ? 8 : 0;
    const nameBuf = Buffer.from(e.name, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(0, 14); // crc32 (reader doesn't verify)
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(0, 16); // crc32
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, nameBuf, payload);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + payload.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuf, eocd]);
}

const DOCX_XML = `<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>Knowledge Base pricing note.</w:t></w:r></w:p>
<w:p><w:r><w:t>The Growth plan costs $49/month and includes DM automation.</w:t></w:r></w:p>
</w:body>
</w:document>`;

// ───────────────────────── PDF EXTRACTION ─────────────────────────

describe("extractPdfText", () => {
  it("extracts text from an uncompressed content stream", () => {
    const pdf = buildPdf("BT /F1 12 Tf 72 720 Td (Hello Knowledge Base) Tj ET");
    expect(extractPdfText(pdf)).toContain("Hello Knowledge Base");
  });

  it("extracts text from a FlateDecode (deflated) stream", () => {
    const pdf = buildPdf("BT (Flated content works) Tj ET", true);
    expect(extractPdfText(pdf)).toContain("Flated content works");
  });

  it("handles TJ arrays and multiple text operators", () => {
    const pdf = buildPdf("BT [(Split) -200 (Text)] TJ ET");
    expect(extractPdfText(pdf)).toContain("Split");
    expect(extractPdfText(pdf)).toContain("Text");
  });

  it("decodes escaped parens and octal escapes", () => {
    const pdf = buildPdf("BT (Line \\(one\\) \\101) Tj ET");
    const text = extractPdfText(pdf);
    expect(text).toContain("(one)");
    expect(text).toContain("A"); // \101 = 'A'
  });

  it("decodes hex strings", () => {
    const pdf = buildPdf("BT <48656C6C6F> Tj ET");
    expect(extractPdfText(pdf)).toContain("Hello");
  });

  it("does not choke on dict markers << >>", () => {
    const pdf = buildPdf("BT (AfterDict) Tj ET");
    // include a dict in the stream region to exercise the guard
    const withDict = buildPdf("<< /Foo 1 >> BT (AfterDict) Tj ET");
    expect(extractPdfText(pdf)).toContain("AfterDict");
    expect(extractPdfText(withDict)).toContain("AfterDict");
  });

  it("throws a helpful error for image-only PDFs", () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< >>\nendobj\n%%EOF\n");
    expect(() => extractPdfText(pdf)).toThrow(/No extractable text/);
  });
});

// ───────────────────────── DOCX EXTRACTION ─────────────────────────

describe("extractDocxText", () => {
  it("extracts text from a stored (uncompressed) DOCX", () => {
    const zip = buildZip([{ name: "word/document.xml", data: Buffer.from(DOCX_XML) }]);
    const text = extractDocxText(zip);
    expect(text).toContain("Knowledge Base pricing note.");
    expect(text).toContain("$49/month");
  });

  it("extracts text from a deflated DOCX", () => {
    const zip = buildZip([{ name: "word/document.xml", data: Buffer.from(DOCX_XML), deflate: true }]);
    expect(extractDocxText(zip)).toContain("DM automation");
  });

  it("strips XML tags and decodes entities", () => {
    const xml = `<w:document><w:body><w:p><w:r><w:t>A &amp; B &lt;C&gt;</w:t></w:r></w:p></w:body></w:document>`;
    const zip = buildZip([{ name: "word/document.xml", data: Buffer.from(xml) }]);
    const text = extractDocxText(zip);
    expect(text).toContain("A & B <C>");
    expect(text).not.toContain("<w:t>");
  });

  it("converts paragraph breaks to newlines", () => {
    const xml = `<w:body><w:p><w:t>One</w:t></w:p><w:p><w:t>Two</w:t></w:p></w:body>`;
    const zip = buildZip([{ name: "word/document.xml", data: Buffer.from(xml) }]);
    expect(extractDocxText(zip)).toBe("One\nTwo");
  });

  it("throws for a zip without word/document.xml", () => {
    const zip = buildZip([{ name: "other.xml", data: Buffer.from("<x/>") }]);
    expect(() => extractDocxText(zip)).toThrow(/word\/document\.xml/);
  });

  it("throws for garbage input", () => {
    expect(() => extractDocxText(Buffer.from("not a zip at all"))).toThrow();
  });
});

// ───────────────────────── HTML ─────────────────────────

describe("stripHtml", () => {
  it("removes tags and scripts/styles", () => {
    const html = `<html><head><style>.a{}</style><script>alert(1)</script></head>
      <body><h1>Title</h1><p>Paragraph one.</p><p>Paragraph two.</p></body></html>`;
    const text = stripHtml(html);
    expect(text).toContain("Title");
    expect(text).toContain("Paragraph one.");
    expect(text).not.toContain("<p>");
    expect(text).not.toContain("alert(1)");
    expect(text).not.toContain(".a{}");
  });

  it("decodes entities", () => {
    expect(stripHtml("<p>Tom &amp; Jerry &lt;3 &#39;q&#39;</p>")).toContain("Tom & Jerry <3 'q'");
  });

  it("keeps block boundaries as newlines", () => {
    const text = stripHtml("<p>one</p><p>two</p>");
    expect(text).toBe("one\ntwo");
  });
});

// ───────────────────────── FILE DISPATCH ─────────────────────────

describe("extractFileText", () => {
  it("routes PDFs to the PDF extractor", () => {
    const pdf = buildPdf("BT (PdfRoute) Tj ET");
    expect(extractFileText(pdf, "doc.pdf")).toEqual({ sourceType: "pdf", text: expect.stringContaining("PdfRoute") });
  });

  it("routes DOCX to the DOCX extractor", () => {
    const zip = buildZip([{ name: "word/document.xml", data: Buffer.from(DOCX_XML) }]);
    const r = extractFileText(zip, "notes.docx");
    expect(r.sourceType).toBe("docx");
    expect(r.text).toContain("pricing note");
  });

  it("routes txt/md/html by extension", () => {
    expect(extractFileText(Buffer.from("plain text here"), "a.txt").sourceType).toBe("text");
    expect(extractFileText(Buffer.from("# heading"), "a.md").sourceType).toBe("markdown");
    expect(extractFileText(Buffer.from("<p>hi</p>"), "a.html").text).toBe("hi");
  });

  it("rejects unsupported binary types", () => {
    const zip = buildZip([{ name: "x", data: Buffer.from("y") }]);
    expect(() => extractFileText(zip, "image.png")).toThrow(/Unsupported file type/);
  });
});

// ───────────────────────── CHUNKING ─────────────────────────

describe("chunkText", () => {
  it("returns [] for empty/whitespace text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("returns one chunk for short text", () => {
    expect(chunkText("Short note about pricing.")).toHaveLength(1);
  });

  it("splits long text into multiple chunks", () => {
    const text = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(text, 300, 60);
    expect(chunks.length).toBeGreaterThan(1);
    // every chunk within a reasonable size bound
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(400);
  });

  it("preserves all words across chunks (no data loss)", () => {
    const words = Array.from({ length: 200 }, (_, i) => `token${i}`);
    const chunks = chunkText(words.join(" "), 250, 50);
    const rejoined = chunks.join(" ").split(" ");
    // each original word appears at least once
    for (const w of words) expect(rejoined).toContain(w);
  });

  it("carries overlap between consecutive chunks", () => {
    const words = Array.from({ length: 100 }, (_, i) => `w${i}`);
    const chunks = chunkText(words.join(" "), 120, 40);
    expect(chunks.length).toBeGreaterThan(1);
    // first word of chunk 2 must come from the tail region of chunk 1
    const firstOfSecond = chunks[1].split(" ")[0];
    const tailOfFirst = chunks[0].split(" ").slice(-15);
    expect(tailOfFirst).toContain(firstOfSecond);
  });

  it("handles overlap = 0 without duplicating the tail", () => {
    const words = Array.from({ length: 60 }, (_, i) => `x${i}`);
    const chunks = chunkText(words.join(" "), 80, 0);
    const all = chunks.join(" ").split(" ");
    expect(new Set(all).size).toBe(all.length); // no duplicates
  });
});

// ───────────────────────── RETRIEVAL ─────────────────────────

describe("tokenize", () => {
  it("lowercases, splits, drops stopwords and short tokens", () => {
    expect(tokenize("The Pricing of AI tools")).toEqual(["pricing", "ai", "tools"]);
  });

  it("keeps numbers", () => {
    expect(tokenize("plan 49 month")).toContain("49");
  });
});

describe("scoreChunk", () => {
  const chunk = "The Growth plan costs $49 per month and includes DM automation and analytics.";

  it("scores higher with more matching terms", () => {
    const strong = scoreChunk("Growth plan DM automation", chunk);
    const weak = scoreChunk("unrelated topic", chunk);
    expect(strong).toBeGreaterThan(0);
    expect(weak).toBe(0);
  });

  it("adds a bonus for the full phrase", () => {
    const phrase = scoreChunk("Growth plan costs", chunk);
    const partial = scoreChunk("Growth costs", chunk);
    expect(phrase).toBeGreaterThan(partial);
  });

  it("returns 0 for empty query", () => {
    expect(scoreChunk("", chunk)).toBe(0);
    expect(scoreChunk("   ", chunk)).toBe(0);
    expect(scoreChunk("the a an", chunk)).toBe(0); // stopwords only
  });
});

describe("retrieveChunks", () => {
  const chunks = [
    { chunkIndex: 0, content: "Pricing plans: Starter $19, Growth $49, Scale $99 per month." },
    { chunkIndex: 1, content: "Video rendering uses GPU workers and takes about 3 minutes." },
    { chunkIndex: 2, content: "The Growth plan includes DM automation and unlimited posts." },
    { chunkIndex: 3, content: "Nothing relevant here about airplanes." },
  ];

  it("returns only matching chunks, best first", () => {
    const hits = retrieveChunks(chunks, "Growth plan DM automation");
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].chunkIndex).toBe(2);
    for (const h of hits) expect(h.score).toBeGreaterThan(0);
  });

  it("drops zero-score chunks", () => {
    expect(retrieveChunks(chunks, "zzz nomatch qqq")).toEqual([]);
  });

  it("respects limit", () => {
    expect(retrieveChunks(chunks, "plan", 1)).toHaveLength(1);
  });

  it("returns [] for empty query", () => {
    expect(retrieveChunks(chunks, "")).toEqual([]);
  });
});

describe("buildKbContext", () => {
  const hits = [
    { chunkIndex: 0, content: "Pricing: Growth is $49/month.", score: 12, title: "Pricing Notes" },
    { chunkIndex: 1, content: "DM automation details.", score: 8, title: "DM Guide" },
  ];

  it("formats a labeled context block", () => {
    const ctx = buildKbContext(hits);
    expect(ctx).toContain("KNOWLEDGE BASE");
    expect(ctx).toContain("[Pricing Notes]");
    expect(ctx).toContain("Growth is $49/month.");
    expect(ctx).toContain("[DM Guide]");
  });

  it("returns '' for no hits", () => {
    expect(buildKbContext([])).toBe("");
  });

  it("respects maxChars (truncates whole blocks)", () => {
    const ctx = buildKbContext(hits, 120); // header + block1 fit (~99), block2 (~135) does not
    expect(ctx.length).toBeLessThanOrEqual(120);
    expect(ctx).toContain("[Pricing Notes]");
    expect(ctx).not.toContain("[DM Guide]"); // didn't fit
  });

  it("falls back to 'Document' when title missing", () => {
    const ctx = buildKbContext([{ chunkIndex: 0, content: "x", score: 1 }]);
    expect(ctx).toContain("[Document]");
  });
});

// ───────────────────────── VALIDATION ─────────────────────────

describe("validateTitle", () => {
  it("accepts normal titles", () => {
    expect(validateTitle("My pricing notes").ok).toBe(true);
  });

  it("rejects empty and over-long titles", () => {
    expect(validateTitle("").ok).toBe(false);
    expect(validateTitle("   ").ok).toBe(false);
    expect(validateTitle("x".repeat(KB_LIMITS.maxTitleLen + 1)).ok).toBe(false);
  });
});

describe("validateExtractedText", () => {
  it("accepts normal text", () => {
    expect(validateExtractedText("This is enough text to index.").ok).toBe(true);
  });

  it("rejects near-empty text", () => {
    expect(validateExtractedText("tiny").ok).toBe(false);
  });

  it("rejects text over the char cap", () => {
    expect(validateExtractedText("a".repeat(KB_LIMITS.maxContentChars + 1)).ok).toBe(false);
  });
});

describe("validateUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(validateUrl("https://example.com/page").ok).toBe(true);
    expect(validateUrl("http://example.com").url).toBe("http://example.com/");
  });

  it("rejects non-http protocols", () => {
    expect(validateUrl("ftp://example.com").ok).toBe(false);
    expect(validateUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateUrl("file:///etc/passwd").ok).toBe(false);
  });

  it("rejects garbage", () => {
    expect(validateUrl("not a url").ok).toBe(false);
    expect(validateUrl("").ok).toBe(false);
  });
});
