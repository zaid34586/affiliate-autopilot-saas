/**
 * Phase 7 — Changelog API (Dashboard)
 * GET /api/dashboard/changelog - List changelog entries
 * POST /api/dashboard/changelog - Create changelog entry
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth-utils";
import { listChangelogEntries, createChangelogEntry } from "@/lib/help/changelog";

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
  const fromDate = searchParams.get("fromDate") ? new Date(searchParams.get("fromDate")!) : undefined;
  const toDate = searchParams.get("toDate") ? new Date(searchParams.get("toDate")!) : undefined;

  try {
    const entries = await listChangelogEntries({
      isPublished,
      limit,
      offset,
      fromDate,
      toDate,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("List changelog entries error:", error);
    return NextResponse.json({ error: "Failed to list entries" }, { status: 500 });
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
    version: string;
    title: string;
    description?: string;
    releaseDate?: string;
    categories?: string[];
    items?: Array<{
      type: "feature" | "fix" | "improvement" | "breaking" | "security";
      title: string;
      description: string;
    }>;
    isPublished?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { version, title, description, releaseDate, categories, items, isPublished } = body;

  if (!version || !title) {
    return NextResponse.json({ error: "version and title required" }, { status: 400 });
  }

  try {
    const entry = await createChangelogEntry({
      version,
      title,
      description: body.description,
      releaseDate: body.releaseDate ? new Date(body.releaseDate) : undefined,
      categories: body.categories,
      items: body.items,
      isPublished: body.isPublished,
      authorId: session.user.id,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Create changelog entry error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create entry" }, { status: 500 });
  }
}