/**
 * Phase 7 — Article Feedback API
 * POST /api/dashboard/help/articles/[id]/feedback - Submit feedback
 * GET /api/dashboard/help/articles/[id]/feedback - Get feedback stats
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth-utils";
import { submitArticleFeedback, getArticleFeedbackStats } from "@/lib/help/help-center";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { id } = await params;

  let body: { isHelpful: boolean; comment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { isHelpful, comment } = body;

  if (typeof isHelpful !== "boolean") {
    return NextResponse.json({ error: "isHelpful (boolean) required" }, { status: 400 });
  }

  try {
    const feedback = await submitArticleFeedback(id, workspaceId, session.user.id, isHelpful, comment);
    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error("Submit feedback error:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}

export async function GET(
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

  try {
    const stats = await getArticleFeedbackStats(id);
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Get feedback stats error:", error);
    return NextResponse.json({ error: "Failed to get feedback stats" }, { status: 500 });
  }
}