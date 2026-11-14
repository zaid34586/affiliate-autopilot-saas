/**
 * Phase 7 — Feature Flag Evaluation API (Client-facing)
 * POST /api/feature-flags/evaluate - Evaluate flags for current user
 * 
 * Used by frontend to check feature availability
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { evaluateFlags } from "@/lib/feature-flags/feature-flags";
import { getUserRoleInWorkspace } from "@/lib/auth-utils";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;
  const userId = session.user.id;

  let body: { keys: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { keys } = body;

  if (!keys || !Array.isArray(keys) || keys.length === 0) {
    return NextResponse.json({ error: "keys array required" }, { status: 400 });
  }

  // Limit to prevent abuse
  if (keys.length > 50) {
    return NextResponse.json({ error: "Too many keys (max 50)" }, { status: 400 });
  }

  const userRole = await getUserRoleInWorkspace(workspaceId, userId);

  try {
    const results = await evaluateFlags(keys, {
      workspaceId,
      userId,
      userRole: userRole || undefined,
    });

    return NextResponse.json({ flags: results });
  } catch (error) {
    console.error("Feature flag evaluation error:", error);
    return NextResponse.json({ error: "Failed to evaluate flags" }, { status: 500 });
  }
}