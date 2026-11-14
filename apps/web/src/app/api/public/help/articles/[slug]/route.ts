/**
 * Phase 7 — Public Help Article by Slug API
 * GET /api/public/help/articles/[slug] - Get article by slug
 */

import { NextResponse } from "next/server";
import { getHelpArticleBySlug, incrementArticleViewCount, getRelatedArticles, getArticleFeedbackStats, listHelpArticles } from "@/lib/help/help-center";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    // Get article by slug (public, so workspaceId is undefined for global articles)
    const article = await getHelpArticleBySlug(slug, undefined);
    
    if (!article || !article.isPublished) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Increment view count
    await incrementArticleViewCount(article.id);

    // Get related articles
    const related = await getRelatedArticles(article, await listHelpArticles({ isPublished: true, limit: 100 }));

    // Get feedback stats
    const feedbackStats = await getArticleFeedbackStats(article.id);

    return NextResponse.json({
      article: {
        ...article,
        related,
        feedbackStats,
      },
    });
  } catch (error) {
    console.error("Public help article error:", error);
    return NextResponse.json({ error: "Failed to fetch article" }, { status: 500 });
  }
}