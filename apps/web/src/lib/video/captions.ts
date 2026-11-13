/**
 * Phase 4 S3 — Word-level captions (ROADMAP P4: "word-level captions").
 * Timings derive from planned scene durations; each word gets its own
 * caption event (short-form reel style), burned via libass in assembleReel.
 */
export interface WordTiming {
  word: string;
  startSec: number;
  endSec: number;
  sceneIndex: number;
}

export interface CaptionSceneInput {
  narration: string;
  durationSec: number;
}

const WORDS_PER_SEC = 2.6;
/** Padding inside each scene so the first/last word don't snap to the cut. */
const SCENE_HEAD_PAD_SEC = 0.15;
const SCENE_TAIL_PAD_SEC = 0.25;

export function computeWordTimings(scenes: CaptionSceneInput[]): WordTiming[] {
  const timings: WordTiming[] = [];
  let offset = 0;

  scenes.forEach((scene, sceneIndex) => {
    const words = scene.narration.split(/\s+/).filter(Boolean);
    const usable = Math.max(0.5, scene.durationSec - SCENE_HEAD_PAD_SEC - SCENE_TAIL_PAD_SEC);
    const perWord = words.length > 0 ? Math.min(usable / words.length, 1 / WORDS_PER_SEC + 0.4) : 0;

    words.forEach((word, i) => {
      const start = offset + SCENE_HEAD_PAD_SEC + i * perWord;
      const end = Math.min(offset + scene.durationSec - 0.05, start + perWord);
      timings.push({ word, startSec: Number(start.toFixed(3)), endSec: Number(end.toFixed(3)), sceneIndex });
    });

    offset += scene.durationSec;
  });

  return timings;
}

export function assTime(sec: number): string {
  const clamped = Math.max(0, sec);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.round((clamped - Math.floor(clamped)) * 100);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${h}:${pad(m)}:${pad(s)}.${pad(Math.min(cs, 99))}`;
}

function escapeAssText(text: string): string {
  return text.replace(/[{}\\]/g, "").replace(/,/g, "·").toUpperCase();
}

/** Build an ASS subtitle document (PlayRes 1080×1920, bottom-center bold captions). */
export function buildAss(timings: WordTiming[]): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,Arial,110,&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,7,0,2,60,60,560,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = timings
    .map(
      (t) =>
        `Dialogue: 0,${assTime(t.startSec)},${assTime(t.endSec)},Word,,0,0,0,,${escapeAssText(t.word)}`
    )
    .join("\n");

  return `${header}${events}\n`;
}
