/**
 * Phase 7 — Support Ticket Messages API
 * GET /api/dashboard/support-tickets/[id]/messages - Get ticket messages
 * POST /api/dashboard/support-tickets/[id]/messages - Add message
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getTicketMessages, addTicketMessage } from "@/lib/help/support-tickets";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { id } = await params;

  try {
    const messages = await getTicketMessages(id);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Get ticket messages error:", error);
    return NextResponse.json({ error: "Failed to get messages" }, { status: 500 });
  }
}

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

  let body: { bodyMd: string; isInternal?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { bodyMd, isInternal } = body;

  if (!bodyMd || bodyMd.trim().length === 0) {
    return NextResponse.json({ error: "bodyMd required" }, { status: 400 });
  }

  try {
    const message = await addTicketMessage({
      ticketId: id,
      userId: session.user.id,
      isStaff: true, // Dashboard users are staff
      bodyMd: bodyMd.trim(),
      isInternal: isInternal || false,
    }, workspaceId);

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Add ticket message error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to add message" }, { status: 500 });
  }
}