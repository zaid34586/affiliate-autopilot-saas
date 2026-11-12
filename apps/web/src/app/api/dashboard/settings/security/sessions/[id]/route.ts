import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // TODO: Implement session revocation
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Revoke session error:", e);
    return NextResponse.json({ error: "Failed to revoke session" }, { status: 500 });
  }
}