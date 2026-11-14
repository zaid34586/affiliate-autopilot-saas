/**
 * Phase 7 — Public Help Articles API
 * GET /api/public/help/articles - List published articles (with search)
 */

import { NextResponse } from "next/server";
import { listHelpArticles, searchHelpArticles } from "@/lib/help/help-center";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || undefined;
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    let articles;
    if (query) {
      articles = await searchHelpArticles(query, {
        category,
        isPublished: true,
        limit,
      });
    } else {
      articles = await listHelpArticles({
        isPublished: true,
        category,
        limit,
        offset,
        sortBy: "sortOrder",
        sortOrder: "asc",
      });
    }

    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Public help articles error:", error);
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 });
  }
}