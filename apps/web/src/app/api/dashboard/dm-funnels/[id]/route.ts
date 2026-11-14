/**
 * GET/PATCH/DELETE /api/dashboard/dm-funnels/[id] — single funnel CRUD.
 */
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dmFunnels, dmFunnelSteps } from "@aa/db";
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
    const [funnel] = await db
      .select()
      .from(dmFunnels)
      .where(and(eq(dmFunnels.id, id), eq(dmFunnels.workspaceId, session.user.workspaceId)))
      .limit(1);

    if (!funnel) {
      return NextResponse.json({ error: "Funnel not found" }, { status: 404 });
    }

    const steps = await db
      .select()
      .from(dmFunnelSteps)
      .where(eq(dmFunnelSteps.funnelId, id))
      .orderBy(dmFunnelSteps.order);

    return NextResponse.json({ funnel: { ...funnel, steps } });
  } catch (e) {
    console.error("Get funnel error:", e);
    return NextResponse.json({ error: "Failed to load funnel" }, { status: 500 });
  }
}

export async function PATCH(
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

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description;
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
  updates.updatedAt = new Date();

  try {
    if (Object.keys(updates).length > 1) {
      await db
        .update(dmFunnels)
        .set(updates)
        .where(and(eq(dmFunnels.id, id), eq(dmFunnels.workspaceId, session.user.workspaceId)));
    }

    // If steps provided, replace all steps
    if (Array.isArray(body.steps)) {
      await db.delete(dmFunnelSteps).where(eq(dmFunnelSteps.funnelId, id));
      const validTypes = ["greet", "pitch", "link", "followup"];
      for (let i = 0; i < body.steps.length; i++) {
        const s = body.steps[i];
        if (!s.stepType || !validTypes.includes(s.stepType)) continue;
        await db.insert(dmFunnelSteps).values({
          funnelId: id,
          stepType: s.stepType,
          order: typeof s.order === "number" ? s.order : i,
          template: s.template,
          delayHours: typeof s.delayHours === "number" ? s.delayHours : 0,
          conditions: s.conditions ?? {},
        });
      }
    }

    const [funnel] = await db
      .select()
      .from(dmFunnels)
      .where(eq(dmFunnels.id, id))
      .limit(1);
    const steps = await db
      .select()
      .from(dmFunnelSteps)
      .where(eq(dmFunnelSteps.funnelId, id))
      .orderBy(dmFunnelSteps.order);

    return NextResponse.json({ funnel: { ...funnel, steps } });
  } catch (e) {
    console.error("Update funnel error:", e);
    return NextResponse.json({ error: "Failed to update funnel" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    await db
      .delete(dmFunnels)
      .where(and(eq(dmFunnels.id, id), eq(dmFunnels.workspaceId, session.user.workspaceId)));
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete funnel error:", e);
    return NextResponse.json({ error: "Failed to delete funnel" }, { status: 500 });
  }
}