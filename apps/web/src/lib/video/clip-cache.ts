/**
 * Clip cache key (plan.md §18: "same product ke clips reuse, script edits pe
 * video re-render na ho"). Hash covers provider + prompt + duration + aspect —
 * an exact prompt match reuses the stored clip from video_clips.
 */
import { createHash } from "node:crypto";

export interface ClipCacheKey {
  provider: string;
  prompt: string;
  durationSec: number;
  aspect: string;
}

export function clipPromptHash(key: ClipCacheKey): string {
  return createHash("sha256")
    .update([key.provider, key.prompt, String(key.durationSec), key.aspect].join("|"))
    .digest("hex");
}
