// Phase 5 Module B — Analytics Cron.
// Syncs platform insights + affiliate conversions.
// Vercel Cron sends GET; POST works too — both are authorized via CRON_SECRET
// and run the same job (see src/lib/cron-auth.ts).
import { db } from "@/lib/db";
import { autopilotConfig, workspaces } from "@aa/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { syncPlatformInsights, syncAffiliateConversions } from "@/lib/analytics/sync";
import { cronGuard } from "@/lib/cron-auth";

export const maxDuration = 120; // 2 min for sync

export async function GET(req: Request) {
  return runAnalyticsSync(req);
}

export async function POST(req: Request) {
  return runAnalyticsSync(req);
}

async function runAnalyticsSync(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

  try {
    const url = new URL(req.url);
    const onlyWorkspace = url.searchParams.get("workspace");

    const where = onlyWorkspace ? eq(workspaces.id, onlyWorkspace) : undefined;
    const workspaceRows = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(where);

    const results: Array<{
      workspaceId: string;
      insights: { synced: number; errors: string[] };
      conversions: { imported: number; errors: string[] };
    }> = [];

    for (const ws of workspaceRows) {
      // Skip if autopilot is paused
      const [cfg] = await db
        .select({ paused: autopilotConfig.paused })
        .from(autopilotConfig)
        .where(eq(autopilotConfig.workspaceId, ws.id))
        .limit(1);

      if (cfg?.paused) {
        results.push({
          workspaceId: ws.id,
          insights: { synced: 0, errors: ["paused"] },
          conversions: { imported: 0, errors: ["paused"] },
        });
        continue;
      }

      const [insightsResult, conversionsResult] = await Promise.all([
        syncPlatformInsights(ws.id),
        syncAffiliateConversions(ws.id),
      ]);

      results.push({
        workspaceId: ws.id,
        insights: insightsResult,
        conversions: conversionsResult,
      });
    }

    return NextResponse.json({
      ok: true,
      workspaceCount: results.length,
      results,
    });
  } catch (e) {
    console.error("Analytics cron error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analytics sync failed" },
      { status: 500 }
    );
  }
}