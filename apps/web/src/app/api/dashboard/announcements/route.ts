/**
 * Phase 7 — Announcements API (Dashboard)
 * GET /api/dashboard/announcements - List announcements
 * POST /api/dashboard/announcements - Create announcement
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth-utils";
import { listAnnouncements, createAnnouncement } from "@/lib/help/announcements";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const isPublished = searchParams.get("isPublished") === "true" ? true : 
    searchParams.get("isPublished") === "false" ? false : undefined;
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    const announcements = await listAnnouncements({
      workspaceId,
      isPublished,
      limit,
      offset,
    });

    return NextResponse.json({ announcements });
  } catch (error) {
    console.error("List announcements error:", error);
    return NextResponse.json({ error: "Failed to list announcements" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: {
    workspaceId?: string;
    title: string;
    bodyMd: string;
    type?: "info" | "warning" | "success" | "maintenance" | "feature";
    priority?: number;
    targetRoles?: string[];
    targetWorkspaces?: string[];
    startAt?: string;
    endAt?: string | null;
    isDismissible?: boolean;
    ctaText?: string;
    ctaUrl?: string;
    isPublished?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, bodyMd, type, priority, targetRoles, targetWorkspaces, startAt, endAt, isDismissible, ctaText, ctaUrl, isPublished } = body;

  if (!title || !bodyMd) {
    return NextResponse.json({ error: "title and bodyMd required" }, { status: 400 });
  }

  try {
    const announcement = await createAnnouncement({
      workspaceId,
      title,
      bodyMd,
      type: body.type,
      priority: body.priority,
      targetRoles: body.targetRoles,
      targetWorkspaces: body.targetWorkspaces,
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      endAt: body.endAt ? new Date(body.endAt) : undefined,
      isDismissible: body.isDismissible,
      ctaText: body.ctaText,
      ctaUrl: body.ctaUrl,
      isPublished: body.isPublished,
      createdBy: session.user.id,
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    console.error("Create announcement error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create announcement" }, { status: 500 });
  }
}