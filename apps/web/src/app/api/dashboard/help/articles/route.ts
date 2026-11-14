/**
 * Phase 7 — Help Center Articles API (Dashboard)
 * GET /api/dashboard/help/articles - List articles
 * POST /api/dashboard/help/articles - Create article
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth-utils";
import { listHelpArticles, createHelpArticle } from "@/lib/help/help-center";

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
  const category = searchParams.get("category") || undefined;
  const isPublished = searchParams.get("isPublished") === "true" ? true : 
    searchParams.get("isPublished") === "false" ? false : undefined;
  const isFeatured = searchParams.get("isFeatured") === "true" ? true : 
    searchParams.get("isFeatured") === "false" ? false : undefined;
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");
  const sortBy = searchParams.get("sortBy") || "sortOrder";
  const sortOrder = searchParams.get("sortOrder") || "asc";

  try {
    const articles = await listHelpArticles({
      workspaceId,
      category,
      isPublished,
      isFeatured,
      limit,
      offset,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    });

    return NextResponse.json({ articles });
  } catch (error) {
    console.error("List help articles error:", error);
    return NextResponse.json({ error: "Failed to list articles" }, { status: 500 });
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
    slug?: string;
    title: string;
    description?: string;
    contentMd: string;
    category: string;
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

  const { slug, title, description, contentMd, category, tags, isPublished, isFeatured, sortOrder, seoTitle, seoDescription } = body;

  if (!title || !contentMd || !category) {
    return NextResponse.json({ error: "title, contentMd, and category required" }, { status: 400 });
  }

  const { generateSlug } = await import("@/lib/help/help-center-core");
  const finalSlug = slug || generateSlug(title);

  try {
    const article = await createHelpArticle({
      workspaceId,
      slug: finalSlug,
      title,
      description: body.description,
      contentMd,
      category,
      tags,
      isPublished,
      isFeatured,
      sortOrder,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
      authorId: session.user.id,
    });

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    console.error("Create help article error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create article" }, { status: 500 });
  }
}