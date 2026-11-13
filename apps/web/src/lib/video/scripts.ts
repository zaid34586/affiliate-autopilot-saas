/**
 * Phase 4 S2 — Deterministic script generator for the 2 MVP video modes
 * (ROADMAP P4: "2 modes live: product showcase + listicle").
 *
 * Honesty rules (non-negotiable):
 *  - Copy is professional English only.
 *  - Numbers (price, rating, review count) are ONLY stated when the real
 *    product record has them — no invented figures, no fake testimonials.
 *
 * This is a template engine so the pipeline runs without an LLM key.
 * When an LLM key is wired (Phase 5 scripts cron), swap the body —
 * the ScriptDoc shape below stays the contract.
 */
import { SCENE_COUNT } from "./constants";

export type VideoMode = "showcase" | "listicle";

export const VIDEO_MODES: VideoMode[] = ["showcase", "listicle"];

export interface ProductScriptContext {
  title: string;
  price?: string | null;
  currency?: string | null;
  category?: string | null;
  rating?: string | null;
  reviewCount?: number | null;
}

export interface ScriptDoc {
  mode: VideoMode;
  hook: string;
  /** 3–4 body lines (listicle lines are numbered in narration). */
  points: string[];
  cta: string;
  fullText: string;
}

const MAX_POINTS = 4;
const MIN_POINTS = 3;

/** Fact-safe filler lines (claim nothing that isn't in the product record). */
const FILLER_POINTS = [
  "Everything you need to decide is on the product page.",
  "Save it now and compare before you buy.",
  "Open the link to see full details and current availability.",
];

function formatPrice(ctx: ProductScriptContext): string | null {
  if (!ctx.price) return null;
  const symbol = ctx.currency === "USD" || !ctx.currency ? "$" : `${ctx.currency} `;
  return `${symbol}${ctx.price}`;
}

function factPoints(ctx: ProductScriptContext): string[] {
  const points: string[] = [];
  const price = formatPrice(ctx);

  if (ctx.rating && ctx.reviewCount) {
    points.push(`Rated ${ctx.rating} out of 5 across ${ctx.reviewCount} reviews.`);
  } else if (ctx.rating) {
    points.push(`Rated ${ctx.rating} out of 5 by buyers.`);
  }

  if (price) {
    points.push(`Listed at ${price} — check the link for today's price.`);
  }

  if (ctx.category) {
    points.push(`A ${ctx.category} pick that's easy to shortlist.`);
  }

  points.push("Full photos, details, and reviews live in one place.");
  return points;
}

function pickPoints(ctx: ProductScriptContext): string[] {
  const points = factPoints(ctx);
  let i = 0;
  while (points.length < MIN_POINTS) points.push(FILLER_POINTS[i++ % FILLER_POINTS.length]);
  return points.slice(0, MAX_POINTS);
}

export function generateScript(ctx: ProductScriptContext, mode: VideoMode): ScriptDoc {
  const price = formatPrice(ctx);
  const title = ctx.title.trim();

  if (mode === "listicle") {
    const facts = pickPoints(ctx);
    const points = facts.map((text, i) => `${i + 1}. ${text}`);
    const hook = `Quick list: ${points.length} reasons to check out the ${title}.`;
    const cta = "Link in bio for the current price, photos, and reviews.";
    return {
      mode,
      hook,
      points,
      cta,
      fullText: [hook, ...points, cta].join(" "),
    };
  }

  // showcase
  const hook = price
    ? `Meet the ${title}, listed at ${price}.`
    : `Meet the ${title}.`;
  const points = pickPoints(ctx);
  const cta = "Tap the link in our bio to see it for yourself.";
  return {
    mode,
    hook,
    points,
    cta,
    fullText: [hook, ...points, cta].join(" "),
  };
}

/** Rough narration duration: ~2.6 words/sec, clamped per segment limits. */
export function estimateDurationSec(text: string, min = 2, max = 8): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  const secs = words / 2.6;
  return Math.max(min, Math.min(max, Math.round(secs)));
}

export function targetSceneCount(): number {
  return SCENE_COUNT.max; // 6 — splitter may land on min (5) for short scripts
}
