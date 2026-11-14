/**
 * Phase 7 — Audit Log API
 * GET /api/dashboard/audit - Query audit logs
 * GET /api/dashboard/audit?summary=true - Get audit summary
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { queryAuditLogs, getAuditLogCount, getAuditLogSummary, AuditLogQuery } from "@/lib/audit/audit-log";
import { requireAdminAccess } from "@/lib/auth-utils";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const summary = searchParams.get("summary") === "true";
  const action = searchParams.get("action") || undefined;
  const actorType = searchParams.get("actorType") as "user" | "ai" | "system" | undefined;
  const resourceType = searchParams.get("resourceType") || undefined;
  const resourceId = searchParams.get("resourceId") || undefined;
  const fromDate = searchParams.get("fromDate") ? new Date(searchParams.get("fromDate")!) : undefined;
  const toDate = searchParams.get("toDate") ? new Date(searchParams.get("toDate")!) : undefined;
  const limit = parseInt(searchParams.get("limit") || "100");
  const offset = parseInt(searchParams.get("offset") || "0");
  const days = parseInt(searchParams.get("days") || "7");

  // Admin only for full audit log access
  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    if (summary) {
      const summaryData = await getAuditLogSummary(workspaceId, days);
      return NextResponse.json({ summary: summaryData });
    }

    const query: AuditLogQuery = {
      workspaceId,
      action: action as any,
      actorType: actorType as any,
      resourceType,
      resourceId,
      fromDate,
      toDate,
      limit: Math.min(limit, 500),
      offset,
    };

    const [logs, total] = await Promise.all([
      queryAuditLogs(query),
      getAuditLogCount({ ...query, limit: undefined, offset: undefined }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error) {
    console.error("Audit log query error:", error);
    return NextResponse.json({ error: "Failed to query audit logs" }, { status: 500 });
  }
}