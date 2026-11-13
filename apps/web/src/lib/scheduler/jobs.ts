/**
 * Phase 5 Module A — Scheduler job definitions.
 * Each job is a self-contained async function that can be invoked via cron
 * or manually. All jobs write to jobs_audit for observability.
 */
import { db } from "@/lib/db";
import { jobsAudit, workspaces } from "@aa/db";
import { eq } from "drizzle-orm";

export type JobType =
  | "research"
  | "script"
  | "video"
  | "publish"
  | "analytics"
  | "optimizer"
  | "report"
  | "dm_triggers";

export interface JobContext {
  workspaceId: string;
  jobType: JobType;
  /** Correlation ID for tracing a full daily run. */
  runId: string;
}

export interface JobResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  costUsd?: number;
}

/** Job function signature — returns structured result for audit. */
export type JobFn = (ctx: JobContext) => Promise<JobResult>;

/** Registry of all scheduled jobs. */
export const jobRegistry: Record<JobType, JobFn> = {
  research: async (ctx) => {
    // TODO: Phase 5 - fetch trending products, save to products table
    return { success: true, output: { message: "Research job not yet implemented" } };
  },
  script: async (ctx) => {
    // TODO: Phase 5 - generate scripts for pending products
    return { success: true, output: { message: "Script job not yet implemented" } };
  },
  video: async (ctx) => {
    // TODO: Phase 5 - enqueue video renders for scripted content
    return { success: true, output: { message: "Video job not yet implemented" } };
  },
  publish: async (ctx) => {
    // TODO: Phase 5 - publish due posts respecting caps/quiet hours
    return { success: true, output: { message: "Publish job not yet implemented" } };
  },
  analytics: async (ctx) => {
    // TODO: Phase 5 - sync platform insights + affiliate conversions
    return { success: true, output: { message: "Analytics job not yet implemented" } };
  },
  optimizer: async (ctx) => {
    // TODO: Phase 5 - score posts, boost winners, pause losers
    return { success: true, output: { message: "Optimizer job not yet implemented" } };
  },
  report: async (ctx) => {
    // TODO: Phase 5 - generate daily/weekly report, send email
    return { success: true, output: { message: "Report job not yet implemented" } };
  },
  dm_triggers: async (ctx) => {
    // TODO: Phase 5 - process comment/DM triggers, send replies
    return { success: true, output: { message: "DM triggers job not yet implemented" } };
  },
};

/**
 * Run a single job with full audit trail (jobs_audit row).
 * Handles errors gracefully — never throws, always records outcome.
 */
export async function runJob(ctx: JobContext): Promise<JobResult> {
  const start = Date.now();
  const jobFn = jobRegistry[ctx.jobType];

  // Create audit row
  const [audit] = await db
    .insert(jobsAudit)
    .values({
      workspaceId: ctx.workspaceId,
      jobType: ctx.jobType,
      status: "running",
      startedAt: new Date(),
      input: { runId: ctx.runId },
    })
    .returning({ id: jobsAudit.id });

  try {
    const result = await jobFn(ctx);
    await db
      .update(jobsAudit)
      .set({
        status: result.success ? "success" : "failed",
        finishedAt: new Date(),
        output: result.output ?? null,
        error: result.error ?? null,
        costUsd: result.costUsd ? String(result.costUsd.toFixed(4)) : null,
      })
      .where(eq(jobsAudit.id, audit.id));
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db
      .update(jobsAudit)
      .set({
        status: "failed",
        finishedAt: new Date(),
        error: message.slice(0, 1000),
      })
      .where(eq(jobsAudit.id, audit.id));
    return { success: false, error: message };
  }
}

/**
 * Get the autopilot config for a workspace (with defaults).
 * Respects the "paused" flag and circuit breakers.
 */
export async function getSchedulerConfig(workspaceId: string) {
  const [ws] = await db
    .select({
      level: workspaces.id, // placeholder - actual config in autopilotConfig
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  // The real config lives in autopilotConfig table
  // This is a stub — the API route already handles this
  return null;
}

/** Generate a run ID for correlating a full daily cycle. */
export function generateRunId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 8);
  return `run_${dateStr}_${random}`;
}

/** Check if current time is within quiet hours (UTC). */
export function isQuietHours(
  quietHours: { from: string; to: string } = { from: "22:00", to: "08:00" },
  now: Date = new Date()
): boolean {
  const [fromH, fromM] = quietHours.from.split(":").map(Number);
  const [toH, toM] = quietHours.to.split(":").map(Number);

  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const fromMinutes = fromH * 60 + fromM;
  const toMinutes = toH * 60 + toM;

  if (fromMinutes === toMinutes) return false; // disabled

  if (fromMinutes < toMinutes) {
    // Same day (e.g., 09:00–17:00)
    return currentMinutes >= fromMinutes && currentMinutes < toMinutes;
  } else {
    // Overnight (e.g., 22:00–08:00)
    return currentMinutes >= fromMinutes || currentMinutes < toMinutes;
  }
}

/** Check daily post cap for a platform. */
export async function checkDailyPostCap(
  workspaceId: string,
  platform: string,
  limit: number,
  now: Date = new Date()
): Promise<{ allowed: boolean; used: number }> {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const { posts } = await import("@aa/db");
  const { count, and, eq, gte, lt } = await import("drizzle-orm");

  const [row] = await db
    .select({ value: count() })
    .from(posts)
    .where(
      and(
        eq(posts.workspaceId, workspaceId),
        eq(posts.platform, platform),
        gte(posts.publishedAt, dayStart),
        lt(posts.publishedAt, dayEnd)
      )
    );

  const used = Number(row?.value ?? 0);
  return { allowed: used < limit, used };
}