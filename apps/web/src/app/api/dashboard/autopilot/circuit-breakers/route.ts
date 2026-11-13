import { auth } from "@/auth";
import { db } from "@/lib/db";
import { autopilotConfig, posts, videos, jobsAudit } from "@aa/db";
import { and, count, eq, gte, lt, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/dashboard/autopilot/circuit-breakers
 * Returns current circuit breaker state per platform.
 * Counts errors in the last hour from jobs_audit.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    // Get autopilot config for thresholds
    const [cfg] = await db
      .select()
      .from(autopilotConfig)
      .where(eq(autopilotConfig.workspaceId, workspaceId))
      .limit(1);

    const config = cfg
      ? {
          circuitBreakers: cfg.circuitBreakers as {
            maxErrorsPerHour: number;
            maxRetries: number;
            pauseOnRateLimit: boolean;
          },
        }
      : {
          circuitBreakers: { maxErrorsPerHour: 10, maxRetries: 3, pauseOnRateLimit: true },
        };

    // Get all platforms that have had posts in the last hour
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const platformErrors = await db
      .select({
        platform: jobsAudit.jobType,
        count: count(),
        // Get latest error
        lastError: sql<string>`MAX(CASE WHEN ${jobsAudit.status} = 'failed' THEN ${jobsAudit.error} END)`,
        lastErrorAt: sql<string>`MAX(CASE WHEN ${jobsAudit.status} = 'failed' THEN ${jobsAudit.finishedAt}::text END)`,
      })
      .from(jobsAudit)
      .where(
        and(
          eq(jobsAudit.workspaceId, workspaceId),
          gte(jobsAudit.startedAt, hourAgo),
          // Only count publish/video jobs as platform operations
          inArray(jobsAudit.jobType, ["publish", "video", "dm_triggers", "analytics", "optimizer"])
        )
      )
      .groupBy(jobsAudit.jobType);

    // Map job types to platforms (simplified - in reality you'd track platform per job)
    // For now, we'll check posts table for platform-specific errors
    const platformPostErrors = await db
      .select({
        platform: posts.platform,
        count: count(),
        lastError: sql<string>`MAX(${posts.error})`,
        lastErrorAt: sql<string>`MAX(${posts.updatedAt}::text)`,
      })
      .from(posts)
      .where(
        and(
          eq(posts.workspaceId, workspaceId),
          eq(posts.status, "failed"),
          gte(posts.updatedAt, hourAgo)
        )
      )
      .groupBy(posts.platform);

    // Combine and format
    const breakers = platformPostErrors.map((p) => {
      const threshold = config.circuitBreakers?.maxErrorsPerHour ?? 10;
      const errors = Number(p.count ?? 0);
      return {
        platform: p.platform,
        errorsLastHour: errors,
        isOpen: errors >= threshold,
        lastError: p.lastError ?? undefined,
        lastErrorAt: p.lastErrorAt ? new Date(p.lastErrorAt).toISOString() : undefined,
      };
    });

    // Add any job types that aren't in posts but had errors
    for (const j of platformErrors) {
      if (!breakers.find((b) => b.platform === j.platform)) {
        const threshold = config.circuitBreakers?.maxErrorsPerHour ?? 10;
        const errors = Number(j.count ?? 0);
        breakers.push({
          platform: j.platform,
          errorsLastHour: errors,
          isOpen: errors >= threshold,
          lastError: j.lastError ? String(j.lastError) : "",
          lastErrorAt: j.lastErrorAt ? new Date(String(j.lastErrorAt)).toISOString() : undefined,
        });
      }
    }

    return NextResponse.json({ breakers });
  } catch (e) {
    console.error("Fetch circuit breakers error:", e);
    return NextResponse.json({ error: "Failed to fetch circuit breakers" }, { status: 500 });
  }
}