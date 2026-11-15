/**
 * Phase 7 — Blog Core (pure logic).
 *
 * Frontmatter parsing, slugs, reading time, excerpts, tagging,
 * related posts, and SEO metadata for the file-based blog.
 */

// ───────────────────────── TYPES ─────────────────────────

export interface BlogPostMeta {
  title: string;
  slug: string;
  /** ISO date string YYYY-MM-DD */
  date: string;
  description: string;
  tags: string[];
  author: string;
}

export interface BlogPost extends BlogPostMeta {
  /** Markdown body (frontmatter stripped) */
  content: string;
}

export interface PostListItem {
  title: string;
  slug: string;
  date: string;
  description: string;
  tags: string[];
  author: string;
  readingMinutes: number;
}

// ───────────────────────── FRONTMATTER ─────────────────────────

/**
 * Parse YAML-ish frontmatter delimited by `---` lines.
 * Supports: title, slug, date, description, tags (comma or array), author.
 * Returns null when frontmatter is missing or malformed.
 */
export function parseFrontmatter(raw: string): { data: Partial<BlogPostMeta>; content: string } | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const [, header, body] = match;
  const data: Partial<BlogPostMeta> = {};

  for (const line of header.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    // strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    switch (key) {
      case "title":
        data.title = value;
        break;
      case "slug":
        data.slug = value;
        break;
      case "date":
        data.date = value;
        break;
      case "description":
        data.description = value;
        break;
      case "author":
        data.author = value;
        break;
      case "tags":
        data.tags = value
          .replace(/^\[/, "")
          .replace(/\]$/, "")
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        break;
    }
  }

  return { data, content: body.replace(/^\r?\n/, "") };
}

/** Convert a title to a URL slug. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

/** Ensure a parsed post has all required fields; derive slug when missing. */
export function finalizePost(
  data: Partial<BlogPostMeta>,
  content: string,
): { post: BlogPost; errors: string[] } {
  const errors: string[] = [];
  if (!data.title) errors.push("title required");
  if (!data.date) errors.push("date required");
  if (!data.description) errors.push("description required");

  const slug = data.slug || (data.title ? slugify(data.title) : "");
  if (!slug) errors.push("slug could not be derived");

  if (errors.length > 0) return { post: undefined as unknown as BlogPost, errors };

  return {
    post: {
      title: data.title!,
      slug,
      date: data.date!,
      description: data.description!,
      tags: data.tags ?? [],
      author: data.author ?? "Affiliate Autopilot Team",
      content,
    },
    errors: [],
  };
}

// ───────────────────────── READING TIME / EXCERPT ─────────────────────────

/** Strip markdown syntax for word counting / excerpts. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ") // code blocks
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^\s*[-*+]\s+/gm, "") // list bullets
    .replace(/^\s*\d+\.\s+/gm, "") // ordered lists
    .replace(/\*\*|__|\*|_/g, "") // emphasis
    .replace(/^\s*>\s+/gm, "") // blockquotes
    .replace(/\|/g, " ") // tables
    .replace(/\s+/g, " ")
    .trim();
}

/** Reading time in minutes (min 1), at ~200 wpm. */
export function readingTimeMinutes(content: string): number {
  const words = stripMarkdown(content).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** First paragraph as excerpt, cut at `maxLength` chars on a word boundary. */
export function excerpt(content: string, maxLength = 160): string {
  const text = stripMarkdown(content);
  if (text.length <= maxLength) return text;

  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : maxLength).trimEnd()}…`;
}

// ───────────────────────── LIST OPERATIONS ─────────────────────────

/** Newest first. */
export function sortPostsByDate<T extends { date: string }>(posts: T[]): T[] {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date));
}

/** Filter by tag (case-insensitive). */
export function filterPostsByTag<T extends { tags: string[] }>(posts: T[], tag: string): T[] {
  const t = tag.toLowerCase();
  return posts.filter((p) => p.tags.includes(t));
}

/** Unique tags across posts with counts. */
export function collectTags<T extends { tags: string[] }>(posts: T[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.tags) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * Related posts: score by shared tags (then date proximity), exclude self.
 */
export function relatedPosts<T extends { slug: string; tags: string[]; date: string }>(
  posts: T[],
  slug: string,
  limit = 3,
): T[] {
  const current = posts.find((p) => p.slug === slug);
  if (!current) return [];

  const currentTags = new Set(current.tags);

  return posts
    .filter((p) => p.slug !== slug)
    .map((p) => {
      const shared = p.tags.filter((t) => currentTags.has(t)).length;
      return { p, score: shared };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.date.localeCompare(a.p.date))
    .slice(0, limit)
    .map((x) => x.p);
}

// ───────────────────────── SEO ─────────────────────────

export interface PostSeo {
  title: string;
  description: string;
  canonical: string;
  openGraph: {
    title: string;
    description: string;
    type: "article";
    publishedTime: string;
    authors: string[];
    tags: string[];
  };
}

/** Build SEO metadata for a post. */
export function postSeo(post: BlogPostMeta, siteUrl: string): PostSeo {
  const base = siteUrl.replace(/\/$/, "");
  const title = post.title.length > 60 ? `${post.title.slice(0, 57)}…` : post.title;

  return {
    title,
    description: post.description.slice(0, 160),
    canonical: `${base}/blog/${post.slug}`,
    openGraph: {
      title,
      description: post.description.slice(0, 160),
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
  };
}

/** JSON-LD structured data for a blog post (SEO). */
export function postJsonLd(post: BlogPostMeta, siteUrl: string): Record<string, unknown> {
  const base = siteUrl.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { "@type": "Person", name: post.author },
    keywords: post.tags.join(", "),
    mainEntityOfPage: `${base}/blog/${post.slug}`,
    publisher: { "@type": "Organization", name: "Affiliate Autopilot" },
  };
}

// ───────────────────────── MARKDOWN RENDERING ─────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Inline markdown: bold, italic, inline code, links. Input must be HTML-escaped first. */
function renderInline(escaped: string): string {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

/**
 * Render the blog's markdown subset to HTML.
 * Supports: h1–h3, paragraphs, ul/ol lists, tables, blockquotes,
 * fenced code blocks, bold/italic/inline-code/links.
 * Pure + deterministic (tested).
 */
export function renderBlogHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isTableSep = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l) && l.includes("-");
  const cells = (l: string) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      out.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // Blank
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${renderInline(escapeHtml(h[2].trim()))}</h${level}>`);
      i++;
      continue;
    }

    // Table: header row + separator
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        `<table><thead><tr>${header.map((c) => `<th>${renderInline(escapeHtml(c))}</th>`).join("")}</tr></thead>` +
          `<tbody>${rows
            .map((r) => `<tr>${r.map((c) => `<td>${renderInline(escapeHtml(c))}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`,
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(renderInline(escapeHtml(lines[i].replace(/^\s*[-*+]\s+/, "").trim())));
        i++;
      }
      out.push(`<ul>${items.map((li) => `<li>${li}</li>`).join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(renderInline(escapeHtml(lines[i].replace(/^\s*\d+\.\s+/, "").trim())));
        i++;
      }
      out.push(`<ol>${items.map((li) => `<li>${li}</li>`).join("")}</ol>`);
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderInline(escapeHtml(buf.join(" ")))}</blockquote>`);
      continue;
    }

    // Paragraph: consume until blank / structural line
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3})\s/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    if (buf.length > 0) {
      out.push(`<p>${renderInline(escapeHtml(buf.join(" ")))}</p>`);
    }
  }

  return out.join("\n");
}

// ───────────────────────── VALIDATION ─────────────────────────

/** Validate a full post before publishing. */
export function validatePost(post: Partial<BlogPost>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!post.title || post.title.trim().length < 5) errors.push("Title must be ≥ 5 chars");
  if (!post.slug || !/^[a-z0-9-]+$/.test(post.slug)) errors.push("Slug must be lowercase kebab-case");
  if (!post.date || !/^\d{4}-\d{2}-\d{2}$/.test(post.date)) errors.push("Date must be YYYY-MM-DD");
  if (!post.description || post.description.trim().length < 50) errors.push("Description must be ≥ 50 chars (SEO)");
  if (!post.content || stripMarkdown(post.content).length < 300) errors.push("Content must be ≥ 300 chars");
  if (post.tags && post.tags.length === 0) errors.push("At least one tag required");
  return { valid: errors.length === 0, errors };
}
