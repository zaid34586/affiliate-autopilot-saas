/**
 * PATCH /api/dashboard/trend-miner/[id] — approve/reject/create remix suggestion.
 * POST also supported for compatibility with verify scripts.
 */
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { trendRemixSuggestions } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { approveRemixSuggestion, rejectRemixSuggestion, markRemixCreated } from "@/lib/trend/trend";

async function handleAction(
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

  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "approve") {
      await approveRemixSuggestion(session.user.workspaceId, id);
      return NextResponse.json({ success: true, action: "approved" });
    } else if (action === "reject") {
      await rejectRemixSuggestion(session.user.workspaceId, id);
      return NextResponse.json({ success: true, action: "rejected" });
    } else if (action === "create") {
      await markRemixCreated(session.user.workspaceId, id);
      return NextResponse.json({ success: true, action: "created" });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (e) {
    console.error("Remix suggestion action error:", e);
    return NextResponse.json({ error: "Failed to update suggestion" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleAction(req, { params });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleAction(req, { params });
}