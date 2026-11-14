/**
 * GET /api/dashboard/dm-daily-caps — view daily caps and usage.
 * PATCH /api/dashboard/dm-daily-caps — update platform daily cap limit.
 */
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dmDailyCaps } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const caps = await db
      .select()
      .from(dmDailyCaps)
      .where(eq(dmDailyCaps.workspaceId, session.user.workspaceId))
      .orderBy(dmDailyCaps.day);
    return NextResponse.json({ caps });
  } catch (e) {
    console.error("List daily caps error:", e);
    return NextResponse.json({ error: "Failed to load daily caps" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
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

  const platform = typeof body.platform === "string" ? body.platform : "";
  const limit = typeof body.limit === "number" ? body.limit : 50;

  if (!platform) {
    return NextResponse.json({ error: "Platform is required" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    const [existing] = await db
      .select()
      .from(dmDailyCaps)
      .where(
        and(
          eq(dmDailyCaps.workspaceId, session.user.workspaceId),
          eq(dmDailyCaps.platform, platform),
          eq(dmDailyCaps.day, today),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(dmDailyCaps)
        .set({ limit, updatedAt: new Date() })
        .where(eq(dmDailyCaps.id, existing.id));
    } else {
      await db.insert(dmDailyCaps).values({
        workspaceId: session.user.workspaceId,
        platform,
        day: today,
        sentCount: 0,
        limit,
      });
    }

    return NextResponse.json({ success: true, platform, limit });
  } catch (e) {
    console.error("Update daily cap error:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}