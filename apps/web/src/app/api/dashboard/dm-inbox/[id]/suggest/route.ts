/**
 * POST /api/dashboard/dm-inbox/[id]/suggest — AI suggested DM body in
 * the character's voice (rules-v1 engine, honest label).
 *
 * Read-only: returns the suggestion without touching the DM body — the
 * existing draft → edit → approve flow remains the only mutation path.
 * Delivery is sandbox until platform DM APIs are connected.
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { suggestDmReply } from "@/lib/character/dm-replies";

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
    const result = await suggestDmReply(workspaceId, id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("Suggest DM error:", e);
    return NextResponse.json(
      { error: "Failed to generate suggestion" },
      { status: 500 },
    );
  }
}
