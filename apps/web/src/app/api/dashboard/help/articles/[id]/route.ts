/**
 * Phase 7 — Help Article Detail API (Dashboard)
 * GET /api/dashboard/help/articles/[id] - Get article
 * PATCH /api/dashboard/help/articles/[id] - Update article
 * DELETE /api/dashboard/help/articles/[id] - Delete article
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth-utils";
import { getHelpArticle, updateHelpArticle } from "@/lib/help/help-center";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const article = await getHelpArticle(id, workspaceId);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    return NextResponse.json({ article });
  } catch (error) {
    console.error("Get help article error:", error);
    return NextResponse.json({ error: "Failed to get article" }, { status: 500 });
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

  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  let body: {
    title?: string;
    description?: string;
    contentMd?: string;
    category?: string;
    tags?: string[];
    isPublished?: boolean;
    isFeatured?: boolean;
    sortOrder?: number;
    seoTitle?: string;
    seoDescription?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const article = await updateHelpArticle(id, workspaceId, body);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    return NextResponse.json({ article });
  } catch (error) {
    console.error("Update help article error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update article" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
  if (!hasAdminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  // Note: We don't have a delete function yet, but this would be the structure
  return NextResponse.json({ error: "Delete not implemented yet" }, { status: 501 });
}