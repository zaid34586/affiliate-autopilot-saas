/**
 * Phase 4 S3 — Render queue (DB-backed, BullMQ-ready).
 * Queue state lives on videos.render_status (queued → rendering → done/failed).
 * Claims use FOR UPDATE SKIP LOCKED → safe concurrent workers (10× parallel),
 * so multiple processes (local after(), cron endpoint, Docker worker) can share
 * the queue without double-processing. REDIS_URL wiring layers on top later.
 */
import { db } from "@/lib/db";
import { videos } from "@aa/db";
import { and, eq, sql } from "drizzle-orm";
import { RENDER_MAX_RETRIES } from "./constants";
import { hasRenderCharge, refundTopupCredit } from "./credits";

export type VideoRow = typeof videos.$inferSelect;

/** Atomically claim the oldest queued video for rendering (SKIP LOCKED). */
export async function claimNextQueuedVideo(): Promise<VideoRow | null> {
  const res = await db.execute<VideoRow>(sql`
    UPDATE videos
    SET render_status = 'rendering',
        started_at = now(),
        progress_pct = 3,
        failure_reason = NULL
    WHERE id = (
      SELECT id FROM videos
      WHERE render_status = 'queued'
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `);
  const rows = (res as unknown as { rows?: VideoRow[] }).rows ?? (res as unknown as VideoRow[]);
  return rows?.[0] ?? null;
}

/** Claim up to `limit` queued videos (fan-out for the worker loop). */
export async function claimQueuedVideos(limit: number): Promise<VideoRow[]> {
  const claimed: VideoRow[] = [];
  for (let i = 0; i < limit; i++) {
    const row = await claimNextQueuedVideo();
    if (!row) break;
    claimed.push(row);
  }
  return claimed;
}

export async function setProgress(videoId: string, pct: number): Promise<void> {
  await db
    .update(videos)
    .set({ progressPct: Math.max(0, Math.min(100, Math.round(pct))) })
    .where(eq(videos.id, videoId));
}

function mergeLog(videoId: string, patch: Record<string, unknown>): Promise<void> {
  // jsonb merge: existing log ← patch
  return db
    .update(videos)
    .set({ renderLog: sql`COALESCE(${videos.renderLog}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(videos.id, videoId))
    .then(() => undefined);
}

export async function logEvent(videoId: string, patch: Record<string, unknown>): Promise<void> {
  await mergeLog(videoId, patch);
}

export interface CompleteRenderInput {
  storageKey: string;
  thumbnailKey: string | null;
  durationSec: number;
  costUsd: number;
  provider: string;
  stats: Record<string, unknown>;
}

export async function completeVideo(videoId: string, input: CompleteRenderInput): Promise<void> {
  await db
    .update(videos)
    .set({
      renderStatus: "done",
      progressPct: 100,
      storageKey: input.storageKey,
      thumbnailKey: input.thumbnailKey,
      durationSec: input.durationSec,
      costUsd: String(input.costUsd.toFixed(4)),
      finishedAt: new Date(),
      failureReason: null,
      renderLog: sql`COALESCE(${videos.renderLog}, '{}'::jsonb) || ${JSON.stringify({
        provider: input.provider,
        stats: input.stats,
        finishedAt: new Date().toISOString(),
      })}::jsonb`,
    })
    .where(eq(videos.id, videoId));
}

export type FailureOutcome = "retrying" | "failed";

/**
 * Handle a render error: auto-requeue while retries remain (retryable errors),
 * otherwise mark failed — refunding the top-up credit if one was charged
 * (charge is derived from the ledger, no caller state needed).
 * Returns which outcome happened (queue UI shows failure reasons either way).
 */
export async function failOrRetry(video: VideoRow, error: Error): Promise<FailureOutcome> {
  const reason = error.message.slice(0, 500);
  const retryable = !("retryable" in error) || (error as { retryable?: boolean }).retryable !== false;

  if (retryable && video.retryCount < RENDER_MAX_RETRIES) {
    await db
      .update(videos)
      .set({
        renderStatus: "queued",
        progressPct: 0,
        retryCount: video.retryCount + 1,
        failureReason: reason,
        renderLog: sql`COALESCE(${videos.renderLog}, '{}'::jsonb) || ${JSON.stringify({
          lastError: reason,
          retryAttempt: video.retryCount + 1,
        })}::jsonb`,
      })
      .where(eq(videos.id, video.id));
    return "retrying";
  }

  await db
    .update(videos)
    .set({
      renderStatus: "failed",
      failureReason: reason,
      finishedAt: new Date(),
      renderLog: sql`COALESCE(${videos.renderLog}, '{}'::jsonb) || ${JSON.stringify({
        lastError: reason,
        retriesExhausted: video.retryCount >= RENDER_MAX_RETRIES,
      })}::jsonb`,
    })
    .where(eq(videos.id, video.id));

  const charged = await hasRenderCharge(video.workspaceId, video.id);
  if (charged) await refundTopupCredit(video.workspaceId, video.id);
  return "failed";
}

/** Manual re-render (user pressed Retry): failed → queued, quota re-checked by caller. */
export async function requeueVideo(videoId: string, workspaceId: string): Promise<boolean> {
  const updated = await db
    .update(videos)
    .set({
      renderStatus: "queued",
      progressPct: 0,
      startedAt: null,
      finishedAt: null,
      failureReason: null,
    })
    .where(and(eq(videos.id, videoId), eq(videos.workspaceId, workspaceId), eq(videos.renderStatus, "failed")))
    .returning({ id: videos.id });
  return updated.length > 0;
}
