import { describe, expect, it } from "vitest";
import { SCENE_COUNT, SCENE_MAX_DURATION_SEC } from "./constants";
import { buildScenePrompt, NEGATIVE_PROMPT } from "./prompts";
import { generateScript, type ProductScriptContext } from "./scripts";
import { splitScriptIntoScenes } from "./scenes";

const richProduct: ProductScriptContext = {
  title: "AeroRun Wireless Earbuds",
  price: "49.99",
  currency: "USD",
  category: "electronics",
  rating: "4.6",
  reviewCount: 1284,
};

const bareProduct: ProductScriptContext = { title: "Classic Leather Wallet" };

describe("generateScript (no fake numbers)", () => {
  it("showcase: states price/rating only when real fields exist", () => {
    const doc = generateScript(richProduct, "showcase");
    expect(doc.fullText).toContain("AeroRun Wireless Earbuds");
    expect(doc.fullText).toContain("$49.99");
    expect(doc.fullText).toContain("4.6");
    expect(doc.fullText).toContain("1284");
    expect(doc.points.length).toBeGreaterThanOrEqual(3);
    expect(doc.points.length).toBeLessThanOrEqual(4);
  });

  it("bare product: no invented price or ratings", () => {
    for (const mode of ["showcase", "listicle"] as const) {
      const doc = generateScript(bareProduct, mode);
      expect(doc.fullText).not.toMatch(/\$\d/);
      expect(doc.fullText).not.toMatch(/\d\.\d out of 5/);
      expect(doc.fullText).not.toMatch(/\d+ reviews/);
    }
  });

  it("listicle points are numbered", () => {
    const doc = generateScript(richProduct, "listicle");
    expect(doc.points[0]).toMatch(/^1\./);
    expect(doc.points[1]).toMatch(/^2\./);
    expect(doc.fullText).toContain("Quick list");
  });
});

describe("splitScriptIntoScenes", () => {
  it("produces 5–6 scenes, hook first and cta last", () => {
    const script = generateScript(richProduct, "showcase");
    const { scenes, totalDurationSec } = splitScriptIntoScenes(script, richProduct.title);
    expect(scenes.length).toBeGreaterThanOrEqual(SCENE_COUNT.min);
    expect(scenes.length).toBeLessThanOrEqual(SCENE_COUNT.max);
    expect(scenes[0].role).toBe("hook");
    expect(scenes[scenes.length - 1].role).toBe("cta");
    expect(scenes.map((s) => s.index)).toEqual(scenes.map((_, i) => i + 1));
    expect(totalDurationSec).toBeGreaterThan(0);
    expect(totalDurationSec).toBeLessThanOrEqual(SCENE_COUNT.max * SCENE_MAX_DURATION_SEC);
  });

  it("every scene respects the 8s cap and carries prompts", () => {
    const script = generateScript(richProduct, "listicle");
    const { scenes } = splitScriptIntoScenes(script, richProduct.title);
    for (const scene of scenes) {
      expect(scene.durationSec).toBeLessThanOrEqual(SCENE_MAX_DURATION_SEC);
      expect(scene.durationSec).toBeGreaterThanOrEqual(2);
      expect(scene.visualPrompt).toContain(richProduct.title);
      expect(scene.visualPrompt).toContain("9:16");
      expect(scene.negativePrompt).toBe(NEGATIVE_PROMPT);
      expect(scene.captionText.length).toBeGreaterThan(0);
    }
  });

  it("pads short scripts up to 5 scenes by splitting long points", () => {
    const script = {
      mode: "showcase" as const,
      hook: "Take a close look at this everyday essential right here.",
      points: [
        "It is lightweight, portable, and comfortable to carry everywhere.",
        "The build quality feels solid and the price stays friendly.",
      ],
      cta: "Link in bio for full details.",
      fullText: "",
    };
    const short = splitScriptIntoScenes(script, "Tiny Product");
    expect(short.scenes.length).toBeGreaterThanOrEqual(SCENE_COUNT.min);

    const full = splitScriptIntoScenes(generateScript(richProduct, "showcase"), "X");
    expect(full.scenes.length).toBeLessThanOrEqual(SCENE_COUNT.max);
  });

  it("handles tiny scripts without crashing (returns every segment)", () => {
    const tiny = {
      mode: "showcase" as const,
      hook: "Look at this.",
      points: ["Nice.", "Cheap."],
      cta: "Link in bio.",
      fullText: "Look at this. Nice. Cheap. Link in bio.",
    };
    const out = splitScriptIntoScenes(tiny, "Tiny Product");
    expect(out.scenes.length).toBe(4);
    expect(out.scenes.every((s) => s.narration.length > 0)).toBe(true);
  });
});

describe("buildScenePrompt", () => {
  it("mode-specific style and role-specific framing", () => {
    const showcase = buildScenePrompt({ mode: "showcase", role: "hook", productTitle: "Mug" });
    const listicle = buildScenePrompt({ mode: "listicle", role: "cta", productTitle: "Mug" });
    expect(showcase).toContain("commercial");
    expect(listicle).toContain("UGC");
    expect(showcase).toContain("Mug");
    expect(showcase).toContain("no text");
  });
});
