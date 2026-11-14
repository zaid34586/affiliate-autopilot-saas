/**
 * GET /api/dashboard/dm-funnels — list all funnels with steps.
 * POST /api/dashboard/dm-funnels — create a new funnel with steps.
 */
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dmFunnels, dmFunnelSteps } from "@aa/db";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const funnels = await db
      .select()
      .from(dmFunnels)
      .where(eq(dmFunnels.workspaceId, session.user.workspaceId))
      .orderBy(desc(dmFunnels.createdAt));

    const funnelIds = funnels.map((f) => f.id);
    let stepsByFunnel: Record<string, unknown[]> = {};
    if (funnelIds.length > 0) {
      const steps = await db
        .select()
        .from(dmFunnelSteps)
        .where(inArray(dmFunnelSteps.funnelId, funnelIds));
      stepsByFunnel = steps.reduce((acc, s) => {
        acc[s.funnelId] = acc[s.funnelId] ?? [];
        acc[s.funnelId].push(s);
        return acc;
      }, {} as Record<string, unknown[]>);
    }

    const withSteps = funnels.map((f) => ({
      ...f,
      steps: (stepsByFunnel[f.id] ?? []).sort((a: any, b: any) => a.order - b.order),
    }));

    return NextResponse.json({ funnels: withSteps });
  } catch (e) {
    console.error("List funnels error:", e);
    return NextResponse.json({ error: "Failed to load funnels" }, { status: 500 });
  }
}

import { inArray } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description : null;
  const steps = Array.isArray(body.steps) ? body.steps : [];

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (steps.length === 0) {
    return NextResponse.json({ error: "At least one step is required" }, { status: 400 });
  }

  // Validate steps
  const validTypes = ["greet", "pitch", "link", "followup"];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s.stepType || !validTypes.includes(s.stepType)) {
      return NextResponse.json(
        { error: `Step ${i}: invalid stepType` },
        { status: 400 },
      );
    }
    if (!s.template || typeof s.template !== "string") {
      return NextResponse.json(
        { error: `Step ${i}: template is required` },
        { status: 400 },
      );
    }
  }

  try {
    const [funnel] = await db
      .insert(dmFunnels)
      .values({
        workspaceId: session.user.workspaceId,
        name,
        description,
        enabled: true,
      })
      .returning();

    const stepRows = await db
      .insert(dmFunnelSteps)
      .values(
        steps.map((s: any, i: number) => ({
          funnelId: funnel.id,
          stepType: s.stepType,
          order: typeof s.order === "number" ? s.order : i,
          template: s.template,
          delayHours: typeof s.delayHours === "number" ? s.delayHours : 0,
          conditions: s.conditions ?? {},
        })),
      )
      .returning();

    return NextResponse.json(
      { funnel: { ...funnel, steps: stepRows } },
      { status: 201 },
    );
  } catch (e) {
    console.error("Create funnel error:", e);
    return NextResponse.json({ error: "Failed to create funnel" }, { status: 500 });
  }
}