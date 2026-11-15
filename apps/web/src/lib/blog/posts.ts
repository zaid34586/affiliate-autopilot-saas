/**
 * Phase 7 — Blog posts loader (server-only).
 *
 * Reads markdown files from src/content/blog, parses frontmatter,
 * validates, and exposes helpers used by pages + sitemap.
 */

import fs from "node:fs";
import path from "node:path";
import {
  parseFrontmatter,
  finalizePost,
  sortPostsByDate,
  filterPostsByTag,
  collectTags,
  relatedPosts,
  readingTimeMinutes,
  excerpt,
  BlogPost,
  PostListItem,
} from "./blog-core";

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "blog");

let cache: BlogPost[] | null = null;

/** Load + parse all posts (cached per process). */
export function getAllPosts(): BlogPost[] {
  if (cache) return cache;

  let files: string[] = [];
  try {
    files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    cache = [];
    return cache;
  }

  const posts: BlogPost[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
    const parsed = parseFrontmatter(raw);
    if (!parsed) {
      errors.push(`${file}: missing frontmatter`);
      continue;
    }

    const { post, errors: postErrors } = finalizePost(parsed.data, parsed.content);
    if (postErrors.length > 0) {
      errors.push(`${file}: ${postErrors.join(", ")}`);
      continue;
    }
    posts.push(post);
  }

  if (errors.length > 0) {
    // Fail loudly during build so bad posts never ship silently
    throw new Error(`Blog content errors:\n${errors.join("\n")}`);
  }

  cache = sortPostsByDate(posts);
  return cache;
}

export function getPostBySlug(slug: string): BlogPost | null {
  return getAllPosts().find((p) => p.slug === slug) || null;
}

/** List items with reading time + excerpt (for the index page). */
export function getPostList(): PostListItem[] {
  return getAllPosts().map((p) => ({
    title: p.title,
    slug: p.slug,
    date: p.date,
    description: p.description,
    tags: p.tags,
    author: p.author,
    readingMinutes: readingTimeMinutes(p.content),
  }));
}

export function getPostsByTag(tag: string): PostListItem[] {
  return sortPostsByDate(filterPostsByTag(getAllPosts(), tag)).map((p) => ({
    title: p.title,
    slug: p.slug,
    date: p.date,
    description: p.description,
    tags: p.tags,
    author: p.author,
    readingMinutes: readingTimeMinutes(p.content),
  }));
}

export function getAllTags(): Array<{ tag: string; count: number }> {
  return collectTags(getAllPosts());
}

export function getRelatedPosts(slug: string, limit = 3): PostListItem[] {
  return relatedPosts(getAllPosts(), slug, limit).map((p) => ({
    title: p.title,
    slug: p.slug,
    date: p.date,
    description: p.description,
    tags: p.tags,
    author: p.author,
    readingMinutes: readingTimeMinutes(p.content),
  }));
}

export function getExcerpt(content: string, maxLength = 160): string {
  return excerpt(content, maxLength);
}
