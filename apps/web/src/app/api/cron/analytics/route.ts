// Phase 5 Module B — Analytics Cron.
// Syncs platform insights + affiliate conversions.
// Runs every 4 hours: "0 */4 * * *"
import { db } from "@/lib/db";
import { autopilotConfig, workspaces } from "@aa/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { syncPlatformInsights, syncAffiliateConversions } from "@/lib/analytics/sync";

const CRON_SECRET = process.env.ANALYTICS_CRON_SECRET?.trim();

export const maxDuration = 120; // 2 min for sync

export async function POST(req: Request) {
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (CRON_SECRET) {
    if (provided !== CRON_SECRET) {
      return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "ANALYTICS_CRON_SECRET not configured" }, { status: 503 });
  }

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

export async function GET() {
  return NextResponse.json({ ok: true, service: "analytics-cron" });
}