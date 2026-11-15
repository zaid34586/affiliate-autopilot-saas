/**
 * Phase 7 — Emails API (Dashboard, admin)
 * GET  /api/dashboard/emails - stats + recent log
 * POST /api/dashboard/emails - run pipeline manually (?dryRun=true to preview)
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth-utils";
import { getEmailStats, runEmailLifecycle } from "@/lib/email/email";
import { db } from "@/lib/db";
import { emailLog } from "@aa/db";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30")));

  try {
    const stats = await getEmailStats(days);

    const recent = await db
      .select({
        id: emailLog.id,
        userId: emailLog.userId,
        template: emailLog.template,
        subject: emailLog.subject,
        status: emailLog.status,
        error: emailLog.error,
        sentAt: emailLog.sentAt,
        createdAt: emailLog.createdAt,
      })
      .from(emailLog)
      .orderBy(desc(emailLog.createdAt))
      .limit(50);

    return NextResponse.json({ stats, recent });
  } catch (error) {
    console.error("Get emails error:", error);
    return NextResponse.json({ error: "Failed to load emails" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  try {
    const outcomes = await runEmailLifecycle({ dryRun });

    return NextResponse.json({
      dryRun,
      sent: outcomes.filter((o) => o.status === "sent").length,
      failed: outcomes.filter((o) => o.status === "failed").length,
      skipped: outcomes.filter((o) => o.status === "skipped").length,
      outcomes: outcomes.slice(0, 100),
    });
  } catch (error) {
    console.error("Run email lifecycle error:", error);
    return NextResponse.json({ error: "Failed to run lifecycle" }, { status: 500 });
  }
}
