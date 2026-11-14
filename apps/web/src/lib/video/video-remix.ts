/**
 * Phase 6 — Video Remix DB Orchestration.
 * 
 * Creates a new video job from a winning video for a new product.
 * Handles: content creation, video job enqueueing, cost tracking.
 */

import { db } from "@/lib/db";
import { contents, videos, products, videoClips, postPerformance } from "@aa/db";
import { eq, and, desc, sql, sum } from "drizzle-orm";
import { generateRemixPlan, RemixInput, VideoRemixPlan, RemixResult } from "./video-remix-core";
import { getVideoProvider } from "./providers";

export interface CreateRemixJobInput {
  workspaceId: string;
  sourceVideoId: string;
  newProductId: string;
  adaptations?: RemixInput["adaptations"];
  userId?: string;
}

/**
 * Create a video remix job
 */
export async function createVideoRemixJob(input: CreateRemixJobInput): Promise<RemixResult> {
  const { workspaceId, sourceVideoId, newProductId, adaptations, userId } = input;

  // 1. Fetch source video with scenes
  const [sourceVideo] = await db
    .select()
    .from(videos)
    .where(and(eq(videos.id, sourceVideoId), eq(videos.workspaceId, workspaceId)))
    .limit(1);

  if (!sourceVideo) {
    return { success: false, error: "Source video not found" };
  }

  // Get the script content with scenes
  const [sourceContent] = await db
    .select()
    .from(contents)
    .where(eq(contents.id, sourceVideo.contentId))
    .limit(1);

  if (!sourceContent || !sourceContent.body) {
    return { success: false, error: "Source video script not found" };
  }

  const scriptBody = sourceContent.body as any;
  const scenes = scriptBody?.scenes;
  const script = scriptBody?.script;

  if (!scenes || scenes.length === 0) {
    return { success: false, error: "Source video has no scenes" };
  }

  // 2. Fetch new product
  const [newProduct] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, newProductId), eq(products.workspaceId, workspaceId)))
    .limit(1);

  if (!newProduct) {
    return { success: false, error: "New product not found" };
  }

  // 3. Generate remix plan
  const sourceVideoData = {
    id: sourceVideo.id,
    title: sourceVideo.title || "Untitled",
    format: sourceVideo.mode,
    aspect: sourceVideo.aspect || "9:16",
    mode: sourceVideo.mode,
    scenes: scenes.map((s: any) => ({
      visualPrompt: s.visualPrompt,
      narration: s.narration,
      durationSec: s.durationSec,
      negativePrompt: s.negativePrompt,
    })),
    script: script ? {
      fullText: script.fullText,
      hook: script.hook,
      cta: script.cta,
    } : undefined,
  };

  const newProductData = {
    id: newProduct.id,
    title: newProduct.title,
    category: newProduct.category ?? undefined,
    keyBenefits: extractKeyBenefits(newProduct),
    imageUrl: newProduct.imageUrl ?? undefined,
  };

  const plan = generateRemixPlan(sourceVideoData, newProductData, adaptations);

  // 4. Create new content entry for the remix
  const [newContent] = await db
    .insert(contents)
    .values({
      workspaceId,
      productId: newProductId,
      type: "video",
      platformTarget: "instagram", // default, can be overridden
      variantNumber: 1,
      body: {
        script: {
          fullText: plan.fullNarration,
          hook: plan.scenePlan[0]?.narration.split(".")[0],
          cta: plan.scenePlan[plan.scenePlan.length - 1]?.narration.split(".").pop(),
        },
        scenes: plan.scenePlan.map(s => ({
          visualPrompt: s.visualPrompt,
          narration: s.narration,
          durationSec: s.durationSec,
          negativePrompt: s.negativePrompt,
        })),
        remix: {
          sourceVideoId: sourceVideoId,
          originalProductId: sourceContent.productId,
          adaptations,
        },
      },
      language: "en",
      status: "draft",
      aiModelUsed: "remix",
    })
    .returning();

  // 5. Create new video job
  const [newVideo] = await db
    .insert(videos)
    .values({
      contentId: newContent.id,
      workspaceId,
      title: `Remix: ${plan.newProductTitle} (${sourceVideo.mode})`,
      mode: sourceVideo.mode,
      aspect: sourceVideo.aspect || "9:16",
      provider: "platform_pool", // Use platform pool for remix
      renderStatus: "queued",
      progressPct: 0,
      autoPostPlatform: sourceVideo.autoPostPlatform,
      createdAt: new Date(),
    })
    .returning();

  // 6. Update content status (remains "draft" - video will update when queued)
  await db
    .update(contents)
    .set({ status: "draft" })
    .where(eq(contents.id, newContent.id));

  // 7. Log the remix creation
  console.log(`[VideoRemix] Created remix job ${newVideo.id} from ${sourceVideoId} for product ${newProduct.title}`);

  return {
    success: true,
    newVideoId: newVideo.id,
    newContentId: newContent.id,
    plan,
  };
}

/**
 * Extract key benefits from product data
 */
function extractKeyBenefits(product: any): string[] {
  const benefits: string[] = [];
  if (product.commissionValue) benefits.push(`${product.commissionValue}% commission`);
  if (product.commissionType === "recurring") benefits.push("Recurring revenue");
  if (product.rating && product.rating > 4) benefits.push(`${product.rating}/5 stars`);
  if (product.reviewCount && product.reviewCount > 100) benefits.push(`${product.reviewCount}+ reviews`);
  if (product.aiScore && product.aiScore > 70) benefits.push(`AI Score: ${product.aiScore}/100`);
  return benefits.slice(0, 3);
}

/**
 * Get remix history for a workspace
 */
export async function getRemixHistory(workspaceId: string, limit = 20) {
  return db
    .select({
      id: contents.id,
      videoId: videos.id,
      videoTitle: videos.title,
      productId: products.id,
      productTitle: products.title,
      sourceVideoId: sql<string>`${contents.body}->>'remix'->>'sourceVideoId'`,
      createdAt: contents.createdAt,
      renderStatus: videos.renderStatus,
    })
    .from(contents)
    .leftJoin(videos, eq(videos.contentId, contents.id))
    .leftJoin(products, eq(products.id, contents.productId))
    .where(and(
      eq(contents.workspaceId, workspaceId),
      eq(contents.type, "video"),
      sql`${contents.body}->'remix' IS NOT NULL`
    ))
    .orderBy(desc(contents.createdAt))
    .limit(limit);
}

/**
 * Check if a video can be remixed (has scenes, completed render)
 */
export async function canRemixVideo(workspaceId: string, videoId: string): Promise<{ canRemix: boolean; reason?: string }> {
  const [video] = await db
    .select({
      id: videos.id,
      renderStatus: videos.renderStatus,
      contentId: videos.contentId,
    })
    .from(videos)
    .where(and(eq(videos.id, videoId), eq(videos.workspaceId, workspaceId)))
    .limit(1);

  if (!video) return { canRemix: false, reason: "Video not found" };
  if (video.renderStatus !== "done") return { canRemix: false, reason: "Video render not completed successfully" };

  const [content] = await db
    .select({ body: contents.body })
    .from(contents)
    .where(eq(contents.id, video.contentId))
    .limit(1);

  if (!content?.body) return { canRemix: false, reason: "Script content missing" };

  const scriptBody = content.body as any;
  if (!scriptBody?.scenes || scriptBody.scenes.length === 0) {
    return { canRemix: false, reason: "Video has no scene data" };
  }

  return { canRemix: true };
}