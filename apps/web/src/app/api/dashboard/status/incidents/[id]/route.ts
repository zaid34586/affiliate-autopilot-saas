/**
 * Phase 7 — Incident Detail API (Dashboard, admin)
 * PATCH /api/dashboard/status/incidents/[id] - update status/add message
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth-utils";
import { updateIncident } from "@/lib/status/status";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  let body: { status?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.status && !["investigating", "identified", "monitoring", "resolved"].includes(body.status)) {
    return NextResponse.json(
      { error: "status must be investigating|identified|monitoring|resolved" },
      { status: 400 },
    );
  }

  try {
    const incident = await updateIncident(id, body);
    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }
    return NextResponse.json({ incident });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update incident";
    const isTransition = msg.startsWith("Invalid transition");
    return NextResponse.json({ error: msg }, { status: isTransition ? 409 : 500 });
  }
}
