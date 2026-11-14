import { auth } from "@/auth";
import { db } from "@/lib/db";
import { jobsAudit, notifications } from "@aa/db";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/autopilot/notifications
 * Returns in-app notifications from job completions, errors, etc.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    // Get stored notifications
    const storedNotifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.workspaceId, workspaceId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    // Also generate notifications from recent job failures
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFailures = await db
      .select({
        id: jobsAudit.id,
        jobType: jobsAudit.jobType,
        error: jobsAudit.error,
        finishedAt: jobsAudit.finishedAt,
      })
      .from(jobsAudit)
      .where(
        and(
          eq(jobsAudit.workspaceId, workspaceId),
          eq(jobsAudit.status, "failed"),
          gte(jobsAudit.finishedAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
        )
      )
      .orderBy(desc(jobsAudit.finishedAt))
      .limit(10);

    const failureNotifs = recentFailures.map((j) => ({
      id: `failure_${j.id}`,
      type: "error" as const,
      title: `${j.jobType} job failed`,
      message: j.error ?? "Unknown error",
      createdAt: j.finishedAt?.toISOString() ?? new Date().toISOString(),
      read: false,
    }));

    // Combine with stored
    const allNotifs = [
      ...storedNotifs.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.body ?? "",
        createdAt: n.createdAt.toISOString(),
        read: !!n.readAt,
      })),
      ...failureNotifs,
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);

    return NextResponse.json({ notifications: allNotifs });
  } catch (e) {
    console.error("Fetch notifications error:", e);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

/**
 * POST /api/dashboard/autopilot/notifications
 * Mark notifications as read (body: { ids: string[] })
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const body = await req.json();
    const { ids } = body as { ids: string[] };

    if (!ids?.length) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }

    // Only update stored notifications (not generated failure ones)
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.workspaceId, workspaceId), inArray(notifications.id, ids)));

    return NextResponse.json({ success: true, updated: ids.length });
  } catch (e) {
    console.error("Mark notifications read error:", e);
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 });
  }
}