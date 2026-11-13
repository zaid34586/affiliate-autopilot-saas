/**
 * Phase 4 — Render enqueue: product → script → scenes → quota check →
 * contents + videos rows (+ top-up charge + jobs_audit), queued for the worker.
 */
import { db } from "@/lib/db";
import { contents, jobsAudit, products, videos } from "@aa/db";
import { and, eq, sql } from "drizzle-orm";
import { checkRenderQuota, consumeTopupCredit } from "./credits";
import type { QuotaDecision } from "./quota";
import { generateScript, VIDEO_MODES, type VideoMode } from "./scripts";
import { splitScriptIntoScenes } from "./scenes";
import { resolveProviderChoice } from "./providers";

export class QuotaExceededError extends Error {
  constructor(public readonly decision: Extract<QuotaDecision, { allowed: false }>) {
    super(decision.message);
    this.name = "QuotaExceededError";
  }
}

export interface EnqueueInput {
  workspaceId: string;
  productId: string;
  mode: VideoMode;
}

export interface EnqueueResult {
  videoId: string;
  contentId: string;
  source: "plan" | "topup";
  sceneCount: number;
  provider: "platform_pool" | "byok";
}

export async function enqueueVideoRender(input: EnqueueInput): Promise<EnqueueResult> {
  if (!VIDEO_MODES.includes(input.mode)) {
    throw new Error("Invalid video mode. Supported: showcase, listicle.");
  }

  const productRows = await db
    .select()
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.workspaceId, input.workspaceId)))
    .limit(1);
  if (productRows.length === 0) throw new Error("Product not found");
  const product = productRows[0];

  // BYOK vs platform pool decides both the render key and cost attribution.
  const choice = await resolveProviderChoice(input.workspaceId);
  const provider: "platform_pool" | "byok" = choice.mode === "byok" ? "byok" : "platform_pool";

  const check = await checkRenderQuota(input.workspaceId, provider);
  if (!check.decision.allowed) throw new QuotaExceededError(check.decision);

  const script = generateScript(
    {
      title: product.title,
      price: product.price,
      currency: product.currency,
      category: product.category,
      rating: product.rating,
      reviewCount: product.reviewCount,
    },
    input.mode
  );
  const { scenes } = splitScriptIntoScenes(script, product.title);

  const [content] = await db
    .insert(contents)
    .values({
      workspaceId: input.workspaceId,
      productId: product.id,
      type: "video",
      platformTarget: "instagram",
      body: { script, scenes, mode: input.mode } as unknown as Record<string, unknown>,
      status: "draft",
      aiModelUsed: "template-v1", // deterministic generator (LLM swap comes with Phase 5 scripts)
    })
    .returning({ id: contents.id });

  const [video] = await db
    .insert(videos)
    .values({
      contentId: content.id,
      workspaceId: input.workspaceId,
      title: product.title,
      mode: input.mode,
      aspect: "9:16",
      provider,
      renderStatus: "queued",
      progressPct: 0,
    })
    .returning({ id: videos.id });

  // Charge one top-up credit only when the monthly plan quota was exhausted.
  if (check.chargeCredit) {
    const ok = await consumeTopupCredit(input.workspaceId, video.id);
    if (!ok) {
      // Race: credits ran out between check and charge → roll back the enqueue.
      await db.delete(videos).where(eq(videos.id, video.id));
      await db.delete(contents).where(eq(contents.id, content.id));
      throw new QuotaExceededError({
        allowed: false,
        reason: "monthly_quota_exceeded",
        message:
          "Video credits ran out. Buy the 10-video top-up pack ($19) or upgrade your plan to keep rendering.",
        upsell: {
          topupPack: { videos: 10, priceUsd: 19 },
          upgradeHint: "Upgrade your plan for a larger monthly allowance.",
        },
      });
    }
  }

  await db.insert(jobsAudit).values({
    workspaceId: input.workspaceId,
    jobType: "video",
    status: "running",
    input: { videoId: video.id, productId: product.id, mode: input.mode, provider },
  });

  return {
    videoId: video.id,
    contentId: content.id,
    source: check.decision.source,
    sceneCount: scenes.length,
    provider,
  };
}

/** Update jobs_audit when a render finishes (success or terminal failure). */
export async function finishVideoAudit(
  videoId: string,
  outcome: { status: "success" | "failed"; costUsd: number; error?: string; output?: Record<string, unknown> }
): Promise<void> {
  await db
    .update(jobsAudit)
    .set({
      status: outcome.status,
      finishedAt: new Date(),
      costUsd: String(outcome.costUsd.toFixed(4)),
      ...(outcome.error ? { error: outcome.error.slice(0, 1000) } : {}),
      ...(outcome.output ? { output: outcome.output } : {}),
    })
    .where(
      and(
        eq(jobsAudit.jobType, "video"),
        eq(jobsAudit.status, "running"),
        sql`${jobsAudit.input}->>'videoId' = ${videoId}`
      )
    );
}
