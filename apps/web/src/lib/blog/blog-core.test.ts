/**
 * Phase 7 — Blog Core Tests
 */

import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  slugify,
  finalizePost,
  stripMarkdown,
  readingTimeMinutes,
  excerpt,
  sortPostsByDate,
  filterPostsByTag,
  collectTags,
  relatedPosts,
  postSeo,
  postJsonLd,
  validatePost,
  renderBlogHtml,
} from "./blog-core";

describe("parseFrontmatter", () => {
  const raw = `---
title: My First Post
slug: my-first-post
date: 2026-11-01
description: A description that is long enough.
tags: seo, growth
author: Jane
---

# Body

Hello world.
`;

  it("parses all supported fields", () => {
    const r = parseFrontmatter(raw);
    expect(r).not.toBeNull();
    expect(r!.data.title).toBe("My First Post");
    expect(r!.data.slug).toBe("my-first-post");
    expect(r!.data.date).toBe("2026-11-01");
    expect(r!.data.tags).toEqual(["seo", "growth"]);
    expect(r!.data.author).toBe("Jane");
  });

  it("extracts body content after frontmatter", () => {
    const r = parseFrontmatter(raw);
    expect(r!.content).toContain("# Body");
    expect(r!.content).toContain("Hello world.");
    expect(r!.content).not.toContain("title:");
  });

  it("returns null without frontmatter", () => {
    expect(parseFrontmatter("# Just a heading")).toBeNull();
    expect(parseFrontmatter("")).toBeNull();
  });

  it("handles quoted values and array-style tags", () => {
    const r = parseFrontmatter(`---
title: "Quoted: Title"
tags: [one, two, three]
---
body`);
    expect(r!.data.title).toBe("Quoted: Title");
    expect(r!.data.tags).toEqual(["one", "two", "three"]);
  });

  it("handles CRLF line endings", () => {
    const r = parseFrontmatter("---\r\ntitle: CRLF Post\r\ndate: 2026-01-01\r\n---\r\nbody");
    expect(r!.data.title).toBe("CRLF Post");
    expect(r!.content.trim()).toBe("body");
  });
});

describe("slugify", () => {
  it("kebab-cases titles", () => {
    expect(slugify("My First Post")).toBe("my-first-post");
    expect(slugify("The Complete 2026 Playbook!")).toBe("the-complete-2026-playbook");
  });

  it("strips special characters and collapses dashes", () => {
    expect(slugify("A  B --- C")).toBe("a-b-c");
    expect(slugify("Café & Résumé")).toBe("caf-rsum"); // accented chars stripped, not transliterated
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("caps at 100 chars", () => {
    expect(slugify("x".repeat(200)).length).toBeLessThanOrEqual(100);
  });
});

describe("finalizePost", () => {
  it("accepts complete data and derives slug when missing", () => {
    const { post, errors } = finalizePost(
      { title: "Great Post Title", date: "2026-11-01", description: "desc" },
      "body",
    );
    expect(errors).toHaveLength(0);
    expect(post.slug).toBe("great-post-title");
    expect(post.author).toBe("Affiliate Autopilot Team"); // default
    expect(post.tags).toEqual([]); // default
  });

  it("reports missing required fields", () => {
    const { errors } = finalizePost({}, "body");
    expect(errors).toContain("title required");
    expect(errors).toContain("date required");
    expect(errors).toContain("description required");
  });
});

describe("stripMarkdown", () => {
  it("removes headings, bold, links, lists", () => {
    const s = stripMarkdown("## Heading\n\n**bold** and [link](https://x.com) and - item");
    expect(s).not.toContain("##");
    expect(s).not.toContain("**");
    expect(s).not.toContain("](");
    expect(s).toContain("bold");
    expect(s).toContain("link");
    expect(s).toContain("item");
  });

  it("removes code blocks entirely", () => {
    const s = stripMarkdown("before\n```\ncode here\n```\nafter");
    expect(s).not.toContain("code here");
    expect(s).toContain("before");
    expect(s).toContain("after");
  });
});

describe("readingTimeMinutes", () => {
  it("returns at least 1 minute", () => {
    expect(readingTimeMinutes("short")).toBe(1);
  });

  it("scales with word count (~200 wpm)", () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`).join(" ");
    expect(readingTimeMinutes(words)).toBe(3);
  });
});

describe("excerpt", () => {
  it("returns full text when under limit", () => {
    expect(excerpt("Short text.", 100)).toBe("Short text.");
  });

  it("truncates on a word boundary with ellipsis", () => {
    const text = "alpha beta gamma delta epsilon zeta eta theta";
    const e = excerpt(text, 20);
    expect(e.endsWith("…")).toBe(true);
    expect(e.length).toBeLessThanOrEqual(21);
    expect(e.startsWith("alpha beta gamma")).toBe(true); // cut at word boundary, not mid-word
  });

  it("keeps whole words inside the excerpt", () => {
    const e = excerpt("one two three four five six seven", 15);
    const withoutEllipsis = e.replace("…", "");
    const lastWord = withoutEllipsis.split(" ").pop()!;
    expect(["one", "two", "three", "four", "five", "six", "seven"]).toContain(lastWord);
  });
});

describe("sortPostsByDate", () => {
  it("sorts newest first", () => {
    const posts = [{ date: "2026-01-01" }, { date: "2026-11-01" }, { date: "2026-05-01" }];
    expect(sortPostsByDate(posts).map((p) => p.date)).toEqual(["2026-11-01", "2026-05-01", "2026-01-01"]);
  });
});

describe("filterPostsByTag / collectTags", () => {
  const posts = [
    { tags: ["seo", "growth"] },
    { tags: ["seo"] },
    { tags: ["dm", "growth"] },
  ];

  it("filters case-insensitively", () => {
    expect(filterPostsByTag(posts, "SEO")).toHaveLength(2);
    expect(filterPostsByTag(posts, "dm")).toHaveLength(1);
    expect(filterPostsByTag(posts, "nope")).toHaveLength(0);
  });

  it("collects tags with counts sorted by count, then alphabetically", () => {
    const tags = collectTags(posts);
    expect(tags[0]).toEqual({ tag: "growth", count: 2 }); // tie at 2 → alphabetical
    expect(tags[1]).toEqual({ tag: "seo", count: 2 });
    expect(tags.find((t) => t.tag === "dm")).toEqual({ tag: "dm", count: 1 });
  });
});

describe("relatedPosts", () => {
  const posts = [
    { slug: "a", tags: ["seo", "instagram"], date: "2026-11-01" },
    { slug: "b", tags: ["seo"], date: "2026-11-02" },
    { slug: "c", tags: ["instagram"], date: "2026-11-03" },
    { slug: "d", tags: ["unrelated"], date: "2026-11-04" },
  ];

  it("excludes self and zero-overlap posts", () => {
    const r = relatedPosts(posts, "a");
    expect(r.map((p) => p.slug)).toEqual(["c", "b"]); // equal score → newest first; d excluded
    expect(r.find((p) => p.slug === "a")).toBeUndefined();
  });

  it("sorts by shared tag count", () => {
    const withTwo = [...posts, { slug: "e", tags: ["seo", "instagram"], date: "2026-11-05" }];
    const r = relatedPosts(withTwo, "a", 1);
    expect(r[0].slug).toBe("e"); // 2 shared tags beats 1
  });

  it("respects limit", () => {
    expect(relatedPosts(posts, "a", 1)).toHaveLength(1);
  });

  it("returns empty for unknown slug", () => {
    expect(relatedPosts(posts, "zzz")).toEqual([]);
  });
});

describe("postSeo / postJsonLd", () => {
  const post = {
    title: "A" + " ".repeat(70) + "Very Long Title For SEO Truncation Check",
    slug: "long-title",
    date: "2026-11-01",
    description: "d".repeat(200),
    tags: ["seo"],
    author: "Jane",
  };

  it("truncates long titles to 60 chars", () => {
    const seo = postSeo(post, "https://example.com/");
    expect(seo.title.length).toBeLessThanOrEqual(60);
  });

  it("builds canonical without double slash", () => {
    const seo = postSeo(post, "https://example.com");
    expect(seo.canonical).toBe("https://example.com/blog/long-title");
  });

  it("descriptions capped at 160", () => {
    const seo = postSeo(post, "https://example.com");
    expect(seo.description.length).toBeLessThanOrEqual(160);
  });

  it("JSON-LD has required schema.org fields", () => {
    const ld = postJsonLd(post, "https://example.com") as Record<string, any>;
    expect(ld["@type"]).toBe("BlogPosting");
    expect(ld.headline).toBe(post.title);
    expect(ld.datePublished).toBe("2026-11-01");
    expect(ld.mainEntityOfPage).toBe("https://example.com/blog/long-title");
    expect(ld.author.name).toBe("Jane");
  });
});

describe("renderBlogHtml", () => {
  it("renders headings, paragraphs, bold, links", () => {
    const html = renderBlogHtml("# Title\n\nSome **bold** and [a link](https://x.com).");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('<a href="https://x.com" target="_blank" rel="noopener">a link</a>');
    expect(html).toContain("<p>");
  });

  it("renders unordered lists as <ul>", () => {
    const html = renderBlogHtml("- first\n- second\n- third");
    expect(html).toContain("<ul>");
    expect(html.match(/<li>/g)).toHaveLength(3);
    expect(html).toContain("<li>first</li>");
    expect(html).not.toContain("- first");
  });

  it("renders ordered lists as <ol>", () => {
    const html = renderBlogHtml("1. one\n2. two");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<li>two</li>");
  });

  it("renders tables with header and body", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |";
    const html = renderBlogHtml(md);
    expect(html).toContain("<thead>");
    expect(html).toContain("<th>A</th>");
    expect(html).toContain("<td>2</td>");
    expect(html).toContain("<td>4</td>");
    expect(html.match(/<tr>/g)).toHaveLength(3); // header + 2 rows
  });

  it("renders fenced code blocks with escaping", () => {
    const html = renderBlogHtml("```\nconst a = 1 < 2;\n```");
    expect(html).toContain("<pre><code>");
    expect(html).toContain("const a = 1 &lt; 2;");
    expect(html).not.toContain("1 < 2");
  });

  it("escapes raw HTML in content", () => {
    const html = renderBlogHtml("<script>alert('xss')</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders blockquotes", () => {
    const html = renderBlogHtml("> quoted wisdom");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("quoted wisdom");
  });

  it("keeps inline code", () => {
    const html = renderBlogHtml("Use `npm run build` here.");
    expect(html).toContain("<code>npm run build</code>");
  });
});

describe("validatePost", () => {
  const good = {
    title: "Valid Title Here",
    slug: "valid-title-here",
    date: "2026-11-01",
    description: "x".repeat(60),
    tags: ["seo"],
    author: "Jane",
    content: Array.from({ length: 100 }, (_, i) => `word${i}`).join(" "),
  };

  it("accepts a valid post", () => {
    expect(validatePost(good)).toEqual({ valid: true, errors: [] });
  });

  it("rejects short description (SEO)", () => {
    expect(validatePost({ ...good, description: "too short" }).valid).toBe(false);
  });

  it("rejects bad slug format", () => {
    expect(validatePost({ ...good, slug: "Bad Slug!" }).valid).toBe(false);
  });

  it("rejects bad date format", () => {
    expect(validatePost({ ...good, date: "01-11-2026" }).valid).toBe(false);
  });

  it("rejects thin content", () => {
    expect(validatePost({ ...good, content: "too thin" }).valid).toBe(false);
  });

  it("rejects empty tags", () => {
    expect(validatePost({ ...good, tags: [] }).valid).toBe(false);
  });
});
