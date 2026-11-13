/**
 * Phase 4 S3 — Render worker loop.
 * Claims queued jobs (SKIP LOCKED → safe across processes) and renders them
 * in parallel up to `concurrency` (DoD: queue handles 10 concurrent renders).
 *
 * Entry points:
 *  - after() hook in the enqueue route (instant local/demo feedback)
 *  - POST /api/cron/render (external cron / Vercel cron / Docker worker later)
 */
import { claimQueuedVideos } from "./queue";
import { mapLimit } from "./ffmpeg";
import { renderVideoJob, type RenderOutcome } from "./pipeline";

export interface LoopSummary {
  claimed: number;
  done: number;
  retrying: number;
  failed: number;
}

export async function runRenderLoop(opts?: {
  maxJobs?: number;
  concurrency?: number;
}): Promise<LoopSummary> {
  const maxJobs = opts?.maxJobs ?? 10;
  const concurrency = opts?.concurrency ?? 10;

  const claimed = await claimQueuedVideos(maxJobs);
  const summary: LoopSummary = { claimed: claimed.length, done: 0, retrying: 0, failed: 0 };
  if (claimed.length === 0) return summary;

  await mapLimit(claimed, concurrency, async (video) => {
    let result: RenderOutcome;
    try {
      result = await renderVideoJob(video);
    } catch (e) {
      // renderVideoJob handles its own failures; this is a last-resort guard.
      console.error("Render worker unexpected error:", e);
      summary.failed++;
      return;
    }
    summary[result.outcome]++;
  });

  return summary;
}
