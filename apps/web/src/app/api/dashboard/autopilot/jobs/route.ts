import { auth } from "@/auth";
import { db } from "@/lib/db";
import { jobsAudit } from "@aa/db";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/dashboard/autopilot/jobs — job history for the workspace.
 * Returns last 100 jobs with status, timing, cost, and error/output.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const rows = await db
      .select({
        id: jobsAudit.id,
        jobType: jobsAudit.jobType,
        status: jobsAudit.status,
        startedAt: jobsAudit.startedAt,
        finishedAt: jobsAudit.finishedAt,
        input: jobsAudit.input,
        output: jobsAudit.output,
        error: jobsAudit.error,
        costUsd: jobsAudit.costUsd,
      })
      .from(jobsAudit)
      .where(eq(jobsAudit.workspaceId, workspaceId))
      .orderBy(desc(jobsAudit.startedAt))
      .limit(100);

    return NextResponse.json({
      jobs: rows.map((r) => ({
        ...r,
        input: r.input as Record<string, unknown> | null,
        output: r.output as Record<string, unknown> | null,
      })),
    });
  } catch (e) {
    console.error("Fetch autopilot jobs error:", e);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}