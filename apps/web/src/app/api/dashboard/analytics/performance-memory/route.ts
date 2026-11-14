/**
 * Phase 6 — Performance Memory API
 * GET /api/dashboard/analytics/performance-memory?niche=fitness&platform=instagram
 * POST /api/dashboard/analytics/performance-memory - Sync recent performance to memory
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  findSimilarContent,
  getNicheInsights,
  getWhatWorksRecommendations,
  syncPostPerformanceToMemory,
  syncVideoPerformanceToMemory,
} from "@/lib/analytics/performance-memory";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "recommendations";
  const niche = searchParams.get("niche") || undefined;
  const platform = searchParams.get("platform") || undefined;
  const format = searchParams.get("format") || undefined;
  const query = searchParams.get("query") || undefined;
  const limit = parseInt(searchParams.get("limit") || "10");

  try {
    switch (action) {
      case "recommendations": {
        if (!niche) {
          return NextResponse.json({ error: "niche parameter required" }, { status: 400 });
        }
        const recommendations = await getWhatWorksRecommendations(workspaceId, niche, platform, format);
        return NextResponse.json({ niche, platform, format, recommendations });
      }

      case "insights": {
        if (!niche) {
          return NextResponse.json({ error: "niche parameter required" }, { status: 400 });
        }
        const insights = await getNicheInsights(workspaceId, niche, limit);
        return NextResponse.json({ niche, insights });
      }

      case "similar": {
        if (!query) {
          return NextResponse.json({ error: "query parameter required" }, { status: 400 });
        }
        const similar = await findSimilarContent(workspaceId, query, {
          platform,
          niche,
          limit,
        });
        return NextResponse.json({ query, results: similar });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Performance memory API error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: { syncType?: "posts" | "videos" | "all"; lookbackDays?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { syncType = "all", lookbackDays = 30 } = body;

  try {
    let postsSynced = 0;
    let videosSynced = 0;

    if (syncType === "posts" || syncType === "all") {
      postsSynced = await syncPostPerformanceToMemory(workspaceId, lookbackDays);
    }

    if (syncType === "videos" || syncType === "all") {
      videosSynced = await syncVideoPerformanceToMemory(workspaceId, lookbackDays);
    }

    return NextResponse.json({
      success: true,
      postsSynced,
      videosSynced,
      totalSynced: postsSynced + videosSynced,
    });
  } catch (error) {
    console.error("Performance memory sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}