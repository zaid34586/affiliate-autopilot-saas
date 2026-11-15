/**
 * Phase 8 — Admin API: System Health
 * GET /api/admin/health - Overall system health, DB, Redis, queue depths, error rates
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const start = Date.now();
  
  // Database health
  let dbHealthy = false;
  let dbLatency = 0;
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    dbLatency = Date.now() - dbStart;
    dbHealthy = true;
  } catch (e) {
    dbLatency = Date.now() - start;
  }

  // Table sizes (approximate)
  const tableSizes = await db.execute(sql`
    SELECT 
      schemaname,
      relname as table_name,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as size,
      pg_total_relation_size(schemaname||'.'||relname) as size_bytes
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC
    LIMIT 20
  `);

  // Connection pool (if available via pg pool stats)
  const poolStats = await db.execute(sql`
    SELECT 
      count(*) as active_connections,
      max(now() - backend_start) as oldest_connection_age
    FROM pg_stat_activity
    WHERE datname = current_database()
  `);

  // Recent error rate (from audit log)
  const errorRate = await db.execute(sql`
    SELECT 
      count(*) as total_actions,
      count(*) filter (where action like '%error%' or action like '%fail%') as error_actions,
      (count(*) filter (where action like '%error%' or action like '%fail%') * 100.0 / nullif(count(*), 0)) as error_rate_pct
    FROM audit_log
    WHERE created_at >= now() - interval '1 hour'
  `);

  // Active workspaces (last 24h activity)
  const activeWorkspaces = await db.execute(sql`
    SELECT count(DISTINCT workspace_id) as count
    FROM analytics_daily
    WHERE day >= (CURRENT_DATE - 1)::text
  `);

  // Queue depths
  const queueDepths = await db.execute(sql`
    SELECT 
      'videos' as queue,
      count(*) filter (where status in ('pending', 'processing')) as pending
    FROM videos
    UNION ALL
    SELECT 
      'posts' as queue,
      count(*) filter (where status in ('pending', 'processing')) as pending
    FROM posts
    UNION ALL
    SELECT 
      'optimizer' as queue,
      count(*) as pending
    FROM optimizer_decisions
    WHERE executed = false
  `);

  return NextResponse.json({
    status: dbHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    database: {
      healthy: dbHealthy,
      latencyMs: dbLatency,
      connections: (poolStats as any).rows?.[0]?.active_connections || 0,
      oldestConnectionAge: (poolStats as any).rows?.[0]?.oldest_connection_age || null,
    },
    tables: (tableSizes as any).rows?.map((r: any) => ({
      name: r.table_name,
      size: r.size,
      sizeBytes: parseInt(r.size_bytes),
    })) || [],
    errorRate: {
      totalActionsLastHour: parseInt((errorRate as any).rows?.[0]?.total_actions || "0"),
      errorActions: parseInt((errorRate as any).rows?.[0]?.error_actions || "0"),
      errorRatePct: parseFloat((errorRate as any).rows?.[0]?.error_rate_pct || "0"),
    },
    activeWorkspaces24h: parseInt((activeWorkspaces as any).rows?.[0]?.count || "0"),
    queues: (queueDepths as any).rows?.map((r: any) => ({
      queue: r.queue,
      pending: parseInt(r.pending),
    })) || [],
  });
}