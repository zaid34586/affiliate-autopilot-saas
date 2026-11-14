/**
 * Phase 6 — Video Remix Core (pure logic).
 * 
 * Takes a high-performing video and creates a new version for a different product.
 * Reuses: scene structure, format, visual style, narration pattern, music style
 * Adapts: product-specific visuals, product name, key selling points, hooks
 */

export interface RemixInput {
  sourceVideoId: string;
  newProductId: string;
  adaptations?: {
    hookStyle?: "same" | "benefit-focused" | "problem-solution" | "curiosity";
    ctaStyle?: "same" | "direct" | "soft" | "urgency";
    narrationTone?: "same" | "enthusiastic" | "authoritative" | "conversational";
  };
}

export interface VideoRemixPlan {
  sourceVideoId: string;
  newProductId: string;
  newProductTitle: string;
  format: string;
  aspect: string;
  scenePlan: Array<{
    sceneIndex: number;
    durationSec: number;
    visualPrompt: string;
    narration: string;
    negativePrompt?: string;
  }>;
  fullNarration: string;
  musicStyle?: string;
  estimatedCostUsd: number;
}

export interface RemixResult {
  success: boolean;
  newVideoId?: string;
  newContentId?: string;
  error?: string;
  plan?: VideoRemixPlan;
}

/**
 * Generate a remix plan from source video and new product
 */
export function generateRemixPlan(
  sourceVideo: {
    id: string;
    title: string;
    format: string;
    aspect: string;
    mode: string;
    scenes: Array<{
      visualPrompt: string;
      narration: string;
      durationSec: number;
      negativePrompt?: string;
    }>;
    script?: {
      fullText: string;
      hook?: string;
      cta?: string;
    };
  },
  newProduct: {
    id: string;
    title: string;
    category?: string;
    keyBenefits?: string[];
    imageUrl?: string;
  },
  adaptations?: RemixInput["adaptations"],
): VideoRemixPlan {
  const hook = sourceVideo.script?.hook || sourceVideo.scenes[0]?.narration.split(".")[0] || "Check this out!";
  const cta = sourceVideo.script?.cta || sourceVideo.scenes[sourceVideo.scenes.length - 1]?.narration.split(".").pop() || "Link in bio";

  // Adapt hooks based on style
  let adaptedHook = hook;
  if (adaptations?.hookStyle === "benefit-focused") {
    adaptedHook = `Get ${newProduct.keyBenefits?.[0] || "amazing results"} with ${newProduct.title}!`;
  } else if (adaptations?.hookStyle === "problem-solution") {
    adaptedHook = `Tired of ${newProduct.category || "the struggle"}? ${newProduct.title} solves it!`;
  } else if (adaptations?.hookStyle === "curiosity") {
    adaptedHook = `What if I told you ${newProduct.title} could change everything?`;
  }

  // Adapt CTA
  let adaptedCta = cta;
  if (adaptations?.ctaStyle === "direct") {
    adaptedCta = `Get ${newProduct.title} now →`;
  } else if (adaptations?.ctaStyle === "soft") {
    adaptedCta = `Learn more about ${newProduct.title} →`;
  } else if (adaptations?.ctaStyle === "urgency") {
    adaptedCta = `Limited stock on ${newProduct.title} →`;
  }

  // Adapt narration tone
  const narrationPrefix = adaptations?.narrationTone === "enthusiastic" ? "🎉 " : 
    adaptations?.narrationTone === "authoritative" ? "📋 " :
    adaptations?.narrationTone === "conversational" ? "☕ " : "";

  // Build adapted scenes
  const scenePlan = sourceVideo.scenes.map((scene, idx) => {
    let adaptedVisualPrompt = scene.visualPrompt;
    let adaptedNarration = scene.narration;

    // Replace product mentions in visual prompt
    adaptedVisualPrompt = adaptedVisualPrompt
      .replace(/product/gi, newProduct.title)
      .replace(/item/gi, newProduct.title)
      .replace(/this/gi, newProduct.title);

    // Replace product mentions in narration
    adaptedNarration = adaptedNarration
      .replace(/product/gi, newProduct.title)
      .replace(/item/gi, newProduct.title)
      .replace(/this/gi, newProduct.title)
      .replace(/it/gi, newProduct.title);

    // Inject hook in first scene
    if (idx === 0) {
      adaptedNarration = adaptedHook + " " + adaptedNarration;
    }

    // Inject CTA in last scene
    if (idx === sourceVideo.scenes.length - 1) {
      adaptedNarration = adaptedNarration + " " + adaptedCta;
    }

    // Add narration tone prefix
    if (narrationPrefix) {
      adaptedNarration = narrationPrefix + adaptedNarration;
    }

    return {
      sceneIndex: idx,
      durationSec: scene.durationSec,
      visualPrompt: adaptedVisualPrompt,
      narration: adaptedNarration,
      negativePrompt: scene.negativePrompt,
    };
  });

  const fullNarration = scenePlan.map(s => s.narration).join(" ");

  // Estimate cost (based on original format + standard rates)
  const estimatedCostUsd = estimateRemixCost(sourceVideo.format, sourceVideo.scenes.length);

  return {
    sourceVideoId: sourceVideo.id,
    newProductId: newProduct.id,
    newProductTitle: newProduct.title,
    format: sourceVideo.format,
    aspect: sourceVideo.aspect,
    scenePlan,
    fullNarration,
    musicStyle: sourceVideo.format, // Use format as music style hint
    estimatedCostUsd,
  };
}

/**
 * Estimate remix cost based on format and scene count
 */
function estimateRemixCost(format: string, sceneCount: number): number {
  const baseCost = {
    showcase: 0.50,
    listicle: 0.45,
    ugc: 0.40,
    testimonial: 0.35,
    comparison: 0.55,
  };
  const perScene = 0.08; // clip generation
  return (baseCost[format as keyof typeof baseCost] || 0.40) + (sceneCount * perScene);
}

/**
 * Validate remix input
 */
export function validateRemixInput(input: RemixInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.sourceVideoId) errors.push("Source video ID required");
  if (!input.newProductId) errors.push("New product ID required");
  return { valid: errors.length === 0, errors };
}