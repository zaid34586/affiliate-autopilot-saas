/**
 * GET/PUT /api/dashboard/character/settings — discussion approval levels.
 * { comments: "off"|"manual"|"semi"|"auto", dm: "off"|"manual"|"semi"|"auto" }
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getDiscussSettings, updateDiscussSettings } from "@/lib/character/replies";

const MODES = ["off", "manual", "semi", "auto"] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getDiscussSettings(session.user.workspaceId);
    if (!result) {
      return NextResponse.json(
        { error: "No character yet — finish onboarding first." },
        { status: 404 },
      );
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("Get discuss settings error:", e);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: { comments?: (typeof MODES)[number]; dm?: (typeof MODES)[number] } = {};
  for (const key of ["comments", "dm"] as const) {
    const v = body[key];
    if (v !== undefined) {
      if (!MODES.includes(v as (typeof MODES)[number])) {
        return NextResponse.json(
          { error: `${key} must be one of: ${MODES.join(", ")}` },
          { status: 400 },
        );
      }
      patch[key] = v as (typeof MODES)[number];
    }
  }

  try {
    const settings = await updateDiscussSettings(workspaceId, patch);
    return NextResponse.json({ settings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save settings";
    const status = msg.includes("character") ? 404 : 500;
    if (status === 500) console.error("Update discuss settings error:", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
