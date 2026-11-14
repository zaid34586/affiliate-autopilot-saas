/**
 * Phase 6 — Command Center Cron
 * POST /api/cron/command-center
 * Generates proactive recommendations for all workspaces (runs daily at 1 AM)
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@aa/db";
import { getCommandCenterRecommendations } from "@/lib/analytics/command-center";

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Also allow in development
  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }

  try {
    // Get all workspaces
    const allWorkspaces = await db.select({ id: workspaces.id }).from(workspaces);
    
    const results = [];

    for (const { id: workspaceId } of allWorkspaces) {
      try {
        const recommendations = await getCommandCenterRecommendations(workspaceId, true);
        
        results.push({
          workspaceId,
          totalOpportunities: recommendations.summary.totalOpportunities,
          criticalCount: recommendations.summary.criticalCount,
          highCount: recommendations.summary.highCount,
          estimatedRevenueImpact: recommendations.summary.estimatedRevenueImpact,
          topPriority: recommendations.summary.topPriority?.title,
        });
      } catch (error) {
        console.error(`Command center failed for workspace ${workspaceId}:`, error);
        results.push({
          workspaceId,
          error: error instanceof Error ? error.message : "Failed",
        });
      }
    }

    const totalCritical = results.reduce((sum, r) => sum + (r.criticalCount || 0), 0);
    const totalHigh = results.reduce((sum, r) => sum + (r.highCount || 0), 0);

    return NextResponse.json({
      success: true,
      workspacesProcessed: results.length,
      totalCritical,
      totalHigh,
      totalEstimatedRevenueImpact: results.reduce((sum, r) => sum + (r.estimatedRevenueImpact || 0), 0),
      results,
    });
  } catch (error) {
    console.error("Command center cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 },
    );
  }
}