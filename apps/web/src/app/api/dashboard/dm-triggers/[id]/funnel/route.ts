/**
 * GET/POST /api/dashboard/dm-triggers/[id]/funnel — map trigger to funnel.
 */
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dmTriggerFunnels, dmTriggers, dmFunnels } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const [trigger] = await db
      .select()
      .from(dmTriggers)
      .where(and(eq(dmTriggers.id, id), eq(dmTriggers.workspaceId, session.user.workspaceId)))
      .limit(1);

    if (!trigger) {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }

    const mapping = await db
      .select({ funnelId: dmTriggerFunnels.funnelId })
      .from(dmTriggerFunnels)
      .where(eq(dmTriggerFunnels.triggerId, id));

    const funnels = await db
      .select()
      .from(dmFunnels)
      .where(eq(dmFunnels.workspaceId, session.user.workspaceId));

    return NextResponse.json({
      trigger,
      funnelIds: mapping.map((m) => m.funnelId),
      availableFunnels: funnels,
    });
  } catch (e) {
    console.error("Get trigger funnel error:", e);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const funnelId = typeof body.funnelId === "string" ? body.funnelId : null;
  const action = typeof body.action === "string" ? body.action : "set"; // "set" | "add" | "remove"

  if (!funnelId) {
    return NextResponse.json({ error: "funnelId is required" }, { status: 400 });
  }

  try {
    const [trigger] = await db
      .select()
      .from(dmTriggers)
      .where(and(eq(dmTriggers.id, id), eq(dmTriggers.workspaceId, session.user.workspaceId)))
      .limit(1);

    if (!trigger) {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }

    if (action === "remove") {
      await db
        .delete(dmTriggerFunnels)
        .where(and(eq(dmTriggerFunnels.triggerId, id), eq(dmTriggerFunnels.funnelId, funnelId)));
    } else {
      // "set" replaces all, "add" adds one
      if (action === "set") {
        await db.delete(dmTriggerFunnels).where(eq(dmTriggerFunnels.triggerId, id));
      }
      await db
        .insert(dmTriggerFunnels)
        .values({ triggerId: id, funnelId })
        .onConflictDoNothing();
    }

    const mappings = await db
      .select({ funnelId: dmTriggerFunnels.funnelId })
      .from(dmTriggerFunnels)
      .where(eq(dmTriggerFunnels.triggerId, id));

    return NextResponse.json({ funnelIds: mappings.map((m) => m.funnelId) });
  } catch (e) {
    console.error("Map trigger funnel error:", e);
    return NextResponse.json({ error: "Failed to map" }, { status: 500 });
  }
}