/**
 * Phase 5 Module A — Master scheduler cron endpoint.
 * Runs the full daily cycle: research → script → video → publish → analytics → optimizer → report.
 * Triggered by Vercel Cron (once daily at 04:00 UTC) or manually.
 * Each workspace is processed independently.
 */
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { autopilotConfig, workspaces } from "@aa/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  generateRunId,
  isQuietHours,
  runJob,
  type JobContext,
  type JobType,
} from "@/lib/scheduler/jobs";

const CRON_SECRET = process.env.SCHEDULER_CRON_SECRET?.trim();

export const maxDuration = 300; // 5 min for full cycle across workspaces

export async function POST(req: Request) {
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (CRON_SECRET) {
    if (provided !== CRON_SECRET) {
      return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "SCHEDULER_CRON_SECRET not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const manualRun = url.searchParams.get("manual") === "true";
  const onlyWorkspace = url.searchParams.get("workspace");

  try {
    // Fetch all active workspaces (or just one if manual)
    const where = onlyWorkspace ? eq(workspaces.id, onlyWorkspace) : undefined;
    const workspaceRows = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(where);

    const results: Array<{
      workspaceId: string;
      runId: string;
      jobs: Record<string, { success: boolean; error?: string }>;
      durationMs: number;
    }> = [];

    for (const ws of workspaceRows) {
      const runId = generateRunId();
      const start = Date.now();

      // Load autopilot config for this workspace
      const [cfg] = await db
        .select()
        .from(autopilotConfig)
        .where(eq(autopilotConfig.workspaceId, ws.id))
        .limit(1);

      const config = cfg
        ? {
            level: cfg.level,
            dailyPostLimits: cfg.dailyPostLimits as Record<string, number>,
            activePlatforms: cfg.activePlatforms as string[],
            quietHours: cfg.quietHours as { from: string; to: string },
            paused: cfg.paused ?? false,
            circuitBreakers: cfg.circuitBreakers as {
              maxErrorsPerHour: number;
              maxRetries: number;
              pauseOnRateLimit: boolean;
            },
          }
        : {
            level: "semi" as const,
            dailyPostLimits: { instagram: 3, youtube: 2, tiktok: 3, facebook: 2, x: 5 },
            activePlatforms: ["instagram", "youtube"],
            quietHours: { from: "22:00", to: "08:00" },
            paused: false,
            circuitBreakers: { maxErrorsPerHour: 10, maxRetries: 3, pauseOnRateLimit: true },
          };

      // Skip if paused
      if (config.paused) {
        results.push({
          workspaceId: ws.id,
          runId,
          jobs: {},
          durationMs: Date.now() - start,
        });
        continue;
      }

      const ctxBase: JobContext = { workspaceId: ws.id, runId, jobType: "research" };
      const jobResults: Record<string, { success: boolean; error?: string }> = {};

      // Define daily job sequence (order matters)
      const jobSequence: JobType[] = [
        "research",
        "script",
        "video",
        "publish",
        "analytics",
        "optimizer",
        "report",
      ];

      // Run each job in sequence
      for (const jobType of jobSequence) {
        // Skip research/script/video in manual mode if they take too long
        if (manualRun && ["research", "script", "video"].includes(jobType)) {
          jobResults[jobType] = { success: true, error: "skipped in manual run" };
          continue;
        }

        const ctx: JobContext = { ...ctxBase, jobType };
        const result = await runJob(ctx);
        jobResults[jobType] = { success: result.success, error: result.error };
      }

      // DM triggers runs separately (more frequent) — not in daily cycle
      results.push({
        workspaceId: ws.id,
        runId,
        jobs: jobResults,
        durationMs: Date.now() - start,
      });
    }

    return NextResponse.json({
      ok: true,
      runCount: results.length,
      results,
    });
  } catch (e) {
    console.error("Scheduler cron error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scheduler failed" },
      { status: 500 }
    );
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({ ok: true, service: "scheduler" });
}