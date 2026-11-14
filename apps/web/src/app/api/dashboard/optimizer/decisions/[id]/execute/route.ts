/**
 * POST /api/dashboard/optimizer/decisions/[id]/execute — execute a pending decision.
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { executeDecision } from "@/lib/optimizer/optimizer";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const result = await executeDecision(session.user.workspaceId, id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, result });
  } catch (e) {
    console.error("Execute decision error:", e);
    return NextResponse.json({ error: "Failed to execute decision" }, { status: 500 });
  }
}