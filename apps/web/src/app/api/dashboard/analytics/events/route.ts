/**
 * Phase 7 — Product Events API
 * POST /api/dashboard/analytics/events - track a product event (funnel or feature)
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { trackProductEvent } from "@/lib/analytics/product-analytics";

/** Canonical funnel events we accept. */
const FUNNEL_EVENTS = new Set([
  "signup",
  "activation",
  "trial",
  "paid",
  "churned",
  "login",
]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: { event: string; properties?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { event, properties } = body;
  if (!event || typeof event !== "string" || event.length > 100) {
    return NextResponse.json({ error: "event (string, max 100 chars) required" }, { status: 400 });
  }

  // Allow funnel events or feature:* events; reject other arbitrary names to keep data clean
  const isFeature = event.startsWith("feature:");
  if (!FUNNEL_EVENTS.has(event) && !isFeature) {
    return NextResponse.json(
      { error: `event must be one of: ${Array.from(FUNNEL_EVENTS).join(", ")} or feature:<name>` },
      { status: 400 },
    );
  }

  try {
    const row = await trackProductEvent({
      workspaceId,
      userId: session.user.id,
      event,
      properties,
    });
    return NextResponse.json({ id: row.id, success: true }, { status: 201 });
  } catch (error) {
    console.error("Track product event error:", error);
    return NextResponse.json({ error: "Failed to track event" }, { status: 500 });
  }
}
