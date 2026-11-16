/**
 * Phase 6 — WhatsApp Bot Cron
 * Daily cleanup and analytics for WhatsApp bot.
 * GET (Vercel Cron default) and POST both run the job; both are authorized
 * with the shared CRON_SECRET (see src/lib/cron-auth.ts).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, whatsappLinks, whatsappWebhookEvents, dmMessages } from "@aa/db";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { cronGuard } from "@/lib/cron-auth";

export async function GET(req: Request) {
  return runWhatsAppBotCron(req);
}

export async function POST(req: Request) {
  return runWhatsAppBotCron(req);
}

async function runWhatsAppBotCron(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

  try {
    // Get all workspaces
    const allWorkspaces = await db.select({ id: workspaces.id }).from(workspaces);
    
    const results = [];

    for (const { id: workspaceId } of allWorkspaces) {
      try {
        // 1. Get WhatsApp link stats
        const linkStats = await db
          .select({
            id: whatsappLinks.id,
            name: whatsappLinks.name,
            clicks: whatsappLinks.clicks,
            conversions: whatsappLinks.conversions,
            enabled: whatsappLinks.enabled,
          })
          .from(whatsappLinks)
          .where(eq(whatsappLinks.workspaceId, workspaceId));

        // 2. Get recent webhook events (last 24h)
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [eventsCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(whatsappWebhookEvents)
          .where(and(
            eq(whatsappWebhookEvents.workspaceId, workspaceId),
            gte(whatsappWebhookEvents.createdAt, since),
          ))
          .limit(1);

        // 3. Get DM messages sent via WhatsApp (last 24h)
        const [dmCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(dmMessages)
          .where(and(
            eq(dmMessages.workspaceId, workspaceId),
            eq(dmMessages.platform, "whatsapp"),
            gte(dmMessages.createdAt, since),
          ))
          .limit(1);

        // 4. Mark old unprocessed events as processed (cleanup)
        await db
          .update(whatsappWebhookEvents)
          .set({ processed: true })
          .where(and(
            eq(whatsappWebhookEvents.workspaceId, workspaceId),
            eq(whatsappWebhookEvents.processed, false),
            sql`${whatsappWebhookEvents.createdAt} < NOW() - INTERVAL '7 days'`,
          ));

        results.push({
          workspaceId,
          links: linkStats.length,
          totalClicks: linkStats.reduce((sum, l) => sum + l.clicks, 0),
          totalConversions: linkStats.reduce((sum, l) => sum + l.conversions, 0),
          eventsLast24h: eventsCount?.count || 0,
          dmsSentLast24h: dmCount?.count || 0,
        });
      } catch (e) {
        results.push({
          workspaceId,
          error: e instanceof Error ? e.message : "Workspace error",
        });
      }
    }

    const totalLinks = results.reduce((sum, r) => sum + (r.links || 0), 0);
    const totalClicks = results.reduce((sum, r) => sum + (r.totalClicks || 0), 0);
    const totalConversions = results.reduce((sum, r) => sum + (r.totalConversions || 0), 0);

    return NextResponse.json({
      success: true,
      workspacesProcessed: results.length,
      totalLinks,
      totalClicks,
      totalConversions,
      overallConversionRate: totalClicks > 0 ? totalConversions / totalClicks : 0,
      results,
    });
  } catch (error) {
    console.error("WhatsApp bot cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 },
    );
  }
}