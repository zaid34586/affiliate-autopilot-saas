/**
 * Phase 7 — Support Tickets API (Dashboard)
 * GET /api/dashboard/support-tickets - List tickets
 * POST /api/dashboard/support-tickets - Create ticket
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { listSupportTickets, createSupportTicket, getTicketStats } from "@/lib/help/support-tickets";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || undefined;
  const status = searchParams.get("status") || undefined;
  const category = searchParams.get("category") || undefined;
  const priority = searchParams.get("priority") || undefined;
  const assignedTo = searchParams.get("assignedTo") || undefined;
  const stats = searchParams.get("stats") === "true";
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  try {
    if (stats) {
      const ticketStats = await getTicketStats(session.user.workspaceId);
      return NextResponse.json({ stats: ticketStats });
    }

    const tickets = await listSupportTickets({
      workspaceId: session.user.workspaceId,
      userId,
      status,
      category,
      priority,
      assignedTo,
      limit: Math.min(limit, 100),
      offset,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("List support tickets error:", error);
    return NextResponse.json({ error: "Failed to list tickets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: {
    subject: string;
    descriptionMd: string;
    category: "technical" | "billing" | "feature_request" | "bug_report" | "general";
    priority?: "low" | "medium" | "high" | "urgent";
    tags?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { subject, descriptionMd, category, priority, tags } = body;

  if (!subject || !descriptionMd || !category) {
    return NextResponse.json({ error: "subject, descriptionMd, and category required" }, { status: 400 });
  }

  try {
    const ticket = await createSupportTicket({
      workspaceId,
      userId: session.user.id,
      subject,
      descriptionMd,
      category,
      priority,
      tags,
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("Create support ticket error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create ticket" }, { status: 500 });
  }
}