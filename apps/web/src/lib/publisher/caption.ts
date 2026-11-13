/**
 * Phase 4 S6 — Post caption builder (pure, fact-safe).
 * Reuses the generated script (hook/points/cta) — every claim in the caption
 * already exists in the product record; no numbers or promises are invented.
 */
import type { ScriptDoc } from "@/lib/video/scripts";
import type { BuiltCaption, PublishPlatform } from "./types";

const YOUTUBE_TITLE_MAX = 100; // YT hard limit
const INSTAGRAM_CAPTION_MAX = 2200; // IG hard limit

/** Affiliate disclosure — honest by default (FTC / platform policy). */
const DISCLOSURE = "#ad";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function buildCaption(opts: {
  platform: PublishPlatform;
  productTitle: string;
  script: ScriptDoc;
  /** Short link to the tracked offer (from Phase 3 links) — omitted when absent. */
  offerUrl?: string | null;
}): BuiltCaption {
  const { platform, productTitle, script, offerUrl } = opts;

  const lines: string[] = [script.hook.trim()];
  for (const point of script.points) {
    const p = point.trim();
    if (p) lines.push(p);
  }
  lines.push(script.cta.trim());
  if (offerUrl) lines.push(offerUrl.trim());
  lines.push(DISCLOSURE);

  const body = lines.filter(Boolean).join("\n");

  if (platform === "youtube") {
    // Shorts surface best with a ≤100-char title; description carries the rest.
    const title = truncate(`${productTitle} — ${script.hook}`, YOUTUBE_TITLE_MAX);
    return { title, body: truncate(body, 5000) };
  }

  // Instagram: caption carries everything (title kept for UI display).
  return {
    title: truncate(productTitle, 120),
    body: truncate(body, INSTAGRAM_CAPTION_MAX),
  };
}
