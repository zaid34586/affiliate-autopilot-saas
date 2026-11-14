/**
 * Phase 7 — Support Ticket Detail API (Dashboard)
 * GET /api/dashboard/support-tickets/[id] - Get ticket with messages
 * PATCH /api/dashboard/support-tickets/[id] - Update ticket
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getSupportTicket, updateSupportTicket, getTicketWithMessages } from "@/lib/help/support-tickets";

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
  const { searchParams } = new URL(req.url);
  const withMessages = searchParams.get("messages") === "true";

  try {
    let ticket;
    if (withMessages) {
      ticket = await getTicketWithMessages(id, workspaceId);
    } else {
      ticket = await getSupportTicket(id, workspaceId);
    }

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Get support ticket error:", error);
    return NextResponse.json({ error: "Failed to get ticket" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { id } = await params;

  let body: {
    subject?: string;
    descriptionMd?: string;
    category?: "technical" | "billing" | "feature_request" | "bug_report" | "general";
    priority?: "low" | "medium" | "high" | "urgent";
    status?: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
    assignedTo?: string | null;
    tags?: string[];
    satisfactionRating?: number;
    satisfactionFeedback?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const ticket = await updateSupportTicket(id, workspaceId, body);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Update support ticket error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update ticket" }, { status: 500 });
  }
}