/**
 * Phase 4 S2 — Scene splitter (plan.md P3: "script → 5–8 scenes, each ≤8s";
 * ROADMAP P4: "script → 5–6 scenes → parallel clip generation").
 *
 * Deterministic: script segments (hook / points / cta) map to scenes with a
 * visual prompt (./prompts.ts) and narration-driven duration (≤ SCENE_MAX_DURATION_SEC).
 * Output shape is the contract the render queue (S3) consumes.
 */
import { SCENE_COUNT, SCENE_MAX_DURATION_SEC } from "./constants";
import { buildScenePrompt, NEGATIVE_PROMPT, type SceneRole } from "./prompts";
import { estimateDurationSec, type ScriptDoc, type VideoMode } from "./scripts";

export interface Scene {
  /** 1-based order in the reel */
  index: number;
  role: SceneRole;
  /** What the voiceover says in this scene (word-level captions derive from this). */
  narration: string;
  /** Prompt sent to the clip provider (parallel generation — S3). */
  visualPrompt: string;
  negativePrompt: string;
  durationSec: number;
  /** Narration cleaned for burned-in captions. */
  captionText: string;
}

export interface SplitResult {
  scenes: Scene[];
  totalDurationSec: number;
}

function cleanCaption(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function toScene(
  role: SceneRole,
  narration: string,
  opts: { mode: VideoMode; productTitle: string; aspect: string },
  index: number
): Scene {
  const text = cleanCaption(narration);
  return {
    index,
    role,
    narration: text,
    visualPrompt: buildScenePrompt({
      mode: opts.mode,
      role,
      productTitle: opts.productTitle,
      aspect: opts.aspect,
    }),
    negativePrompt: NEGATIVE_PROMPT,
    durationSec: Math.min(SCENE_MAX_DURATION_SEC, estimateDurationSec(text)),
    captionText: text,
  };
}

/**
 * Split a generated script into 5–6 scenes (hook → points → cta).
 * Guards: min scene count (pad by splitting the longest point),
 * max scene count (merge shortest adjacent points).
 */
export function splitScriptIntoScenes(
  script: ScriptDoc,
  productTitle: string,
  aspect: string = "9:16"
): SplitResult {
  const opts = { mode: script.mode, productTitle, aspect };
  const segments: Array<{ role: SceneRole; text: string }> = [
    { role: "hook", text: script.hook },
    ...script.points.map((text) => ({ role: "point" as const, text })),
    { role: "cta", text: script.cta },
  ];

  // Enforce minimum: split the longest point until we reach SCENE_COUNT.min.
  let guard = 0;
  while (segments.length < SCENE_COUNT.min && guard++ < 5) {
    let longestIdx = -1;
    let longestWords = 0;
    for (let i = 1; i < segments.length - 1; i++) {
      const words = segments[i].text.split(/\s+/).length;
      if (words > longestWords) {
        longestWords = words;
        longestIdx = i;
      }
    }
    if (longestIdx === -1 || longestWords < 8) break; // cannot split further

    const words = segments[longestIdx].text.split(/\s+/);
    const mid = Math.ceil(words.length / 2);
    const split: [string, string] = [
      words.slice(0, mid).join(" "),
      words.slice(mid).join(" "),
    ];
    segments.splice(
      longestIdx,
      1,
      { role: "point", text: split[0] },
      { role: "point", text: split[1] }
    );
  }

  // Enforce maximum: merge shortest adjacent points.
  guard = 0;
  while (segments.length > SCENE_COUNT.max && guard++ < 5) {
    let mergeIdx = -1;
    let shortest = Infinity;
    for (let i = 1; i < segments.length - 2; i++) {
      const len = segments[i].text.length + segments[i + 1].text.length;
      if (len < shortest) {
        shortest = len;
        mergeIdx = i;
      }
    }
    if (mergeIdx === -1) break;
    const merged = `${segments[mergeIdx].text} ${segments[mergeIdx + 1].text}`;
    segments.splice(mergeIdx, 2, { role: "point", text: merged });
  }

  const scenes = segments.map((seg, i) => toScene(seg.role, seg.text, opts, i + 1));
  return {
    scenes,
    totalDurationSec: scenes.reduce((sum, s) => sum + s.durationSec, 0),
  };
}
