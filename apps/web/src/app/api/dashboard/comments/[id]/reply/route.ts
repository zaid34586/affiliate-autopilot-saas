/**
 * POST /api/dashboard/comments/[id]/reply — approve + send a reply.
 * Body (optional): { reply } to override the suggested text.
 * Delivery is sandbox until platform reply APIs are connected.
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { approveComment } from "@/lib/character/replies";

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

  let override: string | undefined;
  try {
    const body = await req.json();
    if (typeof body.reply === "string") override = body.reply;
  } catch {
    /* empty body = use suggested reply */
  }

  try {
    const result = await approveComment(workspaceId, id, override);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to reply";
    const status =
      msg === "Comment not found"
        ? 404
        : msg.includes("No reply") || msg.includes("Already") || msg.includes("dismissed")
          ? 400
          : 500;
    if (status === 500) console.error("Reply comment error:", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
