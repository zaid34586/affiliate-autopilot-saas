/**
 * Phase 7 — Incidents API (Dashboard, admin)
 * GET  /api/dashboard/status/incidents - list incidents (?open=true)
 * POST /api/dashboard/status/incidents - open incident
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth-utils";
import { listIncidents, createIncident } from "@/lib/status/status";

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
  const open = searchParams.get("open") === "true";
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));

  try {
    const incidents = await listIncidents({ open, limit });
    return NextResponse.json({ incidents });
  } catch (error) {
    console.error("List incidents error:", error);
    return NextResponse.json({ error: "Failed to list incidents" }, { status: 500 });
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

  let body: {
    provider: string;
    title: string;
    description?: string;
    severity?: "minor" | "major" | "critical";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.provider || !body.title) {
    return NextResponse.json({ error: "provider and title required" }, { status: 400 });
  }
  if (body.severity && !["minor", "major", "critical"].includes(body.severity)) {
    return NextResponse.json({ error: "severity must be minor|major|critical" }, { status: 400 });
  }

  try {
    const incident = await createIncident(body);
    return NextResponse.json({ incident }, { status: 201 });
  } catch (error) {
    console.error("Create incident error:", error);
    return NextResponse.json({ error: "Failed to create incident" }, { status: 500 });
  }
}
