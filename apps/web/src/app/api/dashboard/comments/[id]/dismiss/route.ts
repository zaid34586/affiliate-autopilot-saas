/**
 * POST /api/dashboard/comments/[id]/dismiss — mark a comment dismissed.
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { dismissComment } from "@/lib/character/replies";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;
  const { id } = await params;

  try {
    await dismissComment(workspaceId, id);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to dismiss";
    const status = msg === "Comment not found" ? 404 : 500;
    if (status === 500) console.error("Dismiss comment error:", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
