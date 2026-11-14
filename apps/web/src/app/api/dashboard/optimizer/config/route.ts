/**
 * GET/PATCH /api/dashboard/optimizer/config — get/update optimizer config.
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getOptimizerConfig, updateOptimizerConfig } from "@/lib/optimizer/optimizer";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await getOptimizerConfig(session.user.workspaceId);
    return NextResponse.json({ config });
  } catch (e) {
    console.error("Get optimizer config error:", e);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
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

  const allowedKeys = [
    "enabled",
    "mode",
    "minCtrThreshold",
    "minConversionRate",
    "boostThreshold",
    "pauseThreshold",
    "lookbackDays",
    "minPostsForDecision",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (body[key] !== undefined) {
      if (key === "mode" && !["conservative", "balanced", "aggressive"].includes(body[key] as string)) {
        return NextResponse.json({ error: `Invalid mode` }, { status: 400 });
      }
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates provided" }, { status: 400 });
  }

  try {
    await updateOptimizerConfig(session.user.workspaceId, updates);
    const config = await getOptimizerConfig(session.user.workspaceId);
    return NextResponse.json({ config });
  } catch (e) {
    console.error("Update optimizer config error:", e);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}