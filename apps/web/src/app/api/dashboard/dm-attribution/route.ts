/**
 * GET /api/dashboard/dm-attribution — attribution funnel analytics.
 * Returns: triggers → DMs → clicks → conversions + top keywords
 */
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dmTriggers, dmMessages, clickEvents, conversions } from "@aa/db";
import { eq, and, gte, sql, desc, count } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "30", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString().split("T")[0];

  try {
    // 1. Trigger performance: how many DMs started per trigger
    const triggerStats = await db
      .select({
        triggerId: dmTriggers.id,
        keywords: dmTriggers.keywords,
        funnelId: dmTriggers.id, // placeholder, actual mapping in dm_trigger_funnels
        dmsStarted: count(dmMessages.id),
        dmsSent: sql<number>`count(case when ${dmMessages.status} = 'sent' then 1 end)::int`,
        dmsApproved: sql<number>`count(case when ${dmMessages.status} = 'approved' then 1 end)::int`,
        dmsQueued: sql<number>`count(case when ${dmMessages.status} = 'queued' then 1 end)::int`,
      })
      .from(dmTriggers)
      .leftJoin(dmMessages, and(
        eq(dmMessages.triggerKeyword, sql`${dmTriggers.keywords}->>'set'`), // simplified
        eq(dmMessages.workspaceId, workspaceId),
        gte(dmMessages.createdAt, since),
      ))
      .where(eq(dmTriggers.workspaceId, workspaceId))
      .groupBy(dmTriggers.id, dmTriggers.keywords)
      .orderBy(desc(count(dmMessages.id)))
      .limit(50);

    // 2. Keyword breakdown from dmMessages.triggerKeyword
    const keywordStats = await db
      .select({
        keyword: dmMessages.triggerKeyword,
        count: count(dmMessages.id),
        sent: sql<number>`count(case when ${dmMessages.status} = 'sent' then 1 end)::int`,
        clicks: sql<number>`count(case when ${dmMessages.clickAt} is not null then 1 end)::int`,
        conversions: sql<number>`count(case when ${dmMessages.conversionId} is not null then 1 end)::int`,
      })
      .from(dmMessages)
      .where(and(
        eq(dmMessages.workspaceId, workspaceId),
        gte(dmMessages.createdAt, since),
      ))
      .groupBy(dmMessages.triggerKeyword)
      .orderBy(desc(count(dmMessages.id)))
      .limit(50);

    // 3. Funnel conversion rates (from dmConversations if available, else dmMessages)
    const funnelStats = await db
      .select({
        platform: dmMessages.platform,
        total: count(dmMessages.id),
        sent: sql<number>`count(case when ${dmMessages.status} = 'sent' then 1 end)::int`,
        clicked: sql<number>`count(case when ${dmMessages.clickAt} is not null then 1 end)::int`,
        converted: sql<number>`count(case when ${dmMessages.conversionId} is not null then 1 end)::int`,
        revenue: sql<number>`coalesce(sum(${dmMessages.conversionId}), 0)::numeric`, // placeholder
      })
      .from(dmMessages)
      .where(and(
        eq(dmMessages.workspaceId, workspaceId),
        gte(dmMessages.createdAt, since),
      ))
      .groupBy(dmMessages.platform);

    // 4. Top converting keywords
    const topConvertingKeywords = keywordStats
      .filter((k) => (k.conversions ?? 0) > 0)
      .sort((a, b) => (b.conversions ?? 0) - (a.conversions ?? 0))
      .slice(0, 10);

    // 5. Overall funnel summary
    const totals = keywordStats.reduce(
      (acc, k) => {
        acc.dms += k.count ?? 0;
        acc.sent += k.sent ?? 0;
        acc.clicks += k.clicks ?? 0;
        acc.conversions += k.conversions ?? 0;
        return acc;
      },
      { dms: 0, sent: 0, clicks: 0, conversions: 0 },
    );

    const ctr = totals.sent > 0 ? (totals.clicks / totals.sent) * 100 : 0;
    const cvr = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;

    return NextResponse.json({
      period: { days, since: sinceStr },
      summary: {
        ...totals,
        ctr: Math.round(ctr * 100) / 100,
        cvr: Math.round(cvr * 100) / 100,
      },
      triggers: triggerStats,
      keywords: keywordStats,
      platforms: funnelStats,
      topConvertingKeywords,
    });
  } catch (e) {
    console.error("DM attribution error:", e);
    return NextResponse.json(
      { error: "Failed to load attribution" },
      { status: 500 },
    );
  }
}