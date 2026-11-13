import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assTime, buildAss, computeWordTimings } from "./captions";
import { assembleReel, extractThumbnail, mapLimit, synthSceneClip } from "./ffmpeg";

describe("captions (word-level)", () => {
  const scenes = [
    { narration: "Meet the AeroRun earbuds today", durationSec: 4 },
    { narration: "Rated four point six out of five", durationSec: 5 },
    { narration: "Link in bio", durationSec: 2.5 },
  ];

  it("covers every word within its scene window", () => {
    const timings = computeWordTimings(scenes);
    const wordCount = scenes.reduce(
      (n, s) => n + s.narration.split(/\s+/).filter(Boolean).length,
      0
    );
    expect(timings).toHaveLength(wordCount);

    let offset = 0;
    scenes.forEach((scene, i) => {
      const inScene = timings.filter((t) => t.sceneIndex === i);
      for (const t of inScene) {
        expect(t.startSec).toBeGreaterThanOrEqual(offset);
        expect(t.endSec).toBeLessThanOrEqual(offset + scene.durationSec + 0.001);
        expect(t.endSec).toBeGreaterThan(t.startSec);
      }
      offset += scene.durationSec;
    });
  });

  it("builds a valid ASS document with one dialogue per word", () => {
    const timings = computeWordTimings(scenes);
    const ass = buildAss(timings);
    expect(ass).toContain("[Script Info]");
    expect(ass).toContain("PlayResX: 1080");
    expect(ass).toContain("PlayResY: 1920");
    expect(ass.split("Dialogue:").length - 1).toBe(timings.length);
    expect(ass).toContain("MEET"); // uppercased caption text
  });

  it("formats ASS timestamps", () => {
    expect(assTime(0)).toBe("0:00:00.00");
    expect(assTime(65.5)).toBe("0:01:05.50");
    expect(assTime(3661.25)).toBe("1:01:01.25");
  });
});

describe("mapLimit", () => {
  it("preserves order and never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(peak).toBeLessThanOrEqual(3);
  });
});

describe("ffmpeg pipeline (real binary)", () => {
  let dir: string;
  let storage: typeof import("./storage");

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "aa-render-test-"));
    process.env.RENDER_DIR = dir;
    storage = await import("./storage");
  });

  afterAll(async () => {
    delete process.env.RENDER_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it("synthesizes a 9:16 scene clip", async () => {
    const out = path.join(dir, "clip1.mp4");
    await synthSceneClip({ durationSec: 1, outPath: out, seed: 42 });
    const s = await stat(out);
    expect(s.size).toBeGreaterThan(10_000);
  }, 60_000);

  it("assembles clips + burned captions into a reel and extracts a thumbnail", async () => {
    const a = path.join(dir, "a.mp4");
    const b = path.join(dir, "b.mp4");
    await synthSceneClip({ durationSec: 1, outPath: a, seed: 1 });
    await synthSceneClip({ durationSec: 1, outPath: b, seed: 2 });

    const timings = computeWordTimings([
      { narration: "Scene one caption", durationSec: 1 },
      { narration: "Scene two caption", durationSec: 1 },
    ]);
    const assPath = path.join(dir, "captions.ass");
    await writeFile(assPath, buildAss(timings), "utf8");

    const finalPath = path.join(dir, "final.mp4");
    await assembleReel({
      clipPaths: [a, b],
      sceneDurationsSec: [1, 1],
      assPath,
      voiceoverPath: null,
      outPath: finalPath,
    });
    const reel = await stat(finalPath);
    expect(reel.size).toBeGreaterThan(20_000);

    const thumbPath = path.join(dir, "thumb.jpg");
    await extractThumbnail(finalPath, thumbPath, 0.3);
    const thumb = await stat(thumbPath);
    expect(thumb.size).toBeGreaterThan(1_000);
  }, 120_000);

  it("storage keys are uuid-scoped and traversal-safe", () => {
    expect(() => storage.assertSafeStorageKey("../escape.mp4")).toThrow();
    expect(() => storage.assertSafeStorageKey("not-a-uuid/final.mp4")).toThrow();
    expect(() =>
      storage.assertSafeStorageKey("123e4567-e89b-42d3-a456-426614174000/final.mp4")
    ).not.toThrow();
  });
});
