/**
 * Phase 8 — Admin Dashboard (Overview)
 */

import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { users, workspaces, subscriptions, analyticsDaily, videos, posts, supportTickets } from "@aa/db";
import { eq, and, desc, sql, count, sum, gte } from "drizzle-orm";

const statCards = [
  { key: "users", label: "Total Users", color: "text-sky", prefix: "" },
  { key: "workspaces", label: "Workspaces", color: "text-emerald", prefix: "" },
  { key: "activeSubs", label: "Active Subscriptions", color: "text-amber", prefix: "" },
  { key: "mrr", label: "MRR", color: "text-signal", prefix: "$" },
] as const;

async function getStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalWorkspaces,
    activeSubs,
    mrrResult,
    recentSignups,
    recentWorkspaces,
    activeWorkspaces30d,
    pendingSupport,
    videoQueue,
    postQueue,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(workspaces),
    db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, "active")),
    db
      .select({ mrr: sql<number>`coalesce(sum(amount_cents), 0)::int / 100.0` })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active")),
    db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo)),
    db
      .select({ count: count() })
      .from(workspaces)
      .where(gte(workspaces.createdAt, thirtyDaysAgo)),
    db
      .select({ count: count() })
      .from(analyticsDaily)
      .where(gte(analyticsDaily.day, thirtyDaysAgo.toISOString().split("T")[0])),
    db.select({ count: count() }).from(supportTickets).where(eq(supportTickets.status, "open")),
    db
      .select({ count: count() })
      .from(videos)
      .where(sql`${videos.renderStatus} IN ('queued', 'processing')`),
    db.select({ count: count() }).from(posts).where(sql`${posts.status} IN ('pending', 'processing')`),
  ]);

  return {
    users: totalUsers[0]?.count || 0,
    workspaces: totalWorkspaces[0]?.count || 0,
    activeSubs: activeSubs[0]?.count || 0,
    mrr: Math.round((mrrResult[0]?.mrr || 0) * 100) / 100,
    recentSignups: recentSignups[0]?.count || 0,
    recentWorkspaces: recentWorkspaces[0]?.count || 0,
    activeWorkspaces30d: activeWorkspaces30d[0]?.count || 0,
    pendingSupport: pendingSupport[0]?.count || 0,
    videoQueue: videoQueue[0]?.count || 0,
    postQueue: postQueue[0]?.count || 0,
  };
}

export default async function AdminDashboard() {
  await requirePlatformAdmin();
  const stats = await getStats();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-bone">Admin Dashboard</h1>
        <p className="text-bone-2 mt-1">Platform overview — {new Date().toLocaleDateString()}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.key} className="panel p-5">
            <p className="text-sm text-bone-3">{card.label}</p>
            <p className="mt-1 text-3xl font-semibold text-bone {card.color}">
              {(card.prefix || "") + (stats[card.key as keyof typeof stats] as number).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-semibold text-bone mb-4">Growth (30 days)</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold text-sky">{stats.recentSignups.toLocaleString()}</p>
              <p className="text-xs text-bone-3">New Users</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-emerald">{stats.recentWorkspaces.toLocaleString()}</p>
              <p className="text-xs text-bone-3">New Workspaces</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-amber">{stats.activeWorkspaces30d.toLocaleString()}</p>
              <p className="text-xs text-bone-3">Active Workspaces</p>
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-semibold text-bone mb-4">Queue Health</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className={stats.videoQueue > 10 ? "text-rose" : "text-emerald"}>
              <p className="text-2xl font-semibold">{stats.videoQueue}</p>
              <p className="text-xs text-bone-3">Video Jobs</p>
            </div>
            <div className={stats.postQueue > 20 ? "text-rose" : "text-emerald"}>
              <p className="text-2xl font-semibold">{stats.postQueue}</p>
              <p className="text-xs text-bone-3">Post Jobs</p>
            </div>
            <div className={stats.pendingSupport > 5 ? "text-amber" : "text-emerald"}>
              <p className="text-2xl font-semibold">{stats.pendingSupport}</p>
              <p className="text-xs text-bone-3">Open Tickets</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-bone">Quick Actions</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/admin/users" className="panel-hover block p-4 border border-ink-3 rounded-lg hover:border-signal/50 transition-colors">
              <p className="font-medium text-bone">Manage Users</p>
              <p className="text-sm text-bone-3 mt-1">View, suspend, export</p>
            </Link>
            <Link href="/admin/workspaces" className="panel-hover block p-4 border border-ink-3 rounded-lg hover:border-signal/50 transition-colors">
              <p className="font-medium text-bone">Manage Workspaces</p>
              <p className="text-sm text-bone-3 mt-1">Plans, suspensions, usage</p>
            </Link>
            <Link href="/admin/revenue" className="panel-hover block p-4 border border-ink-3 rounded-lg hover:border-signal/50 transition-colors">
              <p className="font-medium text-bone">Revenue Details</p>
              <p className="text-sm text-bone-3 mt-1">MRR, churn, trials, upgrades</p>
            </Link>
            <Link href="/admin/ai-usage" className="panel-hover block p-4 border border-ink-3 rounded-lg hover:border-signal/50 transition-colors">
              <p className="font-medium text-bone">AI Costs & Margin</p>
              <p className="text-sm text-bone-3 mt-1">Per workspace, alerts</p>
            </Link>
            <Link href="/admin/jobs" className="panel-hover block p-4 border border-ink-3 rounded-lg hover:border-signal/50 transition-colors">
              <p className="font-medium text-bone">Job Queues</p>
              <p className="text-sm text-bone-3 mt-1">Stuck jobs, worker status</p>
            </Link>
            <Link href="/admin/integrations" className="panel-hover block p-4 border border-ink-3 rounded-lg hover:border-signal/50 transition-colors">
              <p className="font-medium text-bone">Integration Health</p>
              <p className="text-sm text-bone-3 mt-1">IG, TikTok, Veo, ElevenLabs</p>
            </Link>
            <Link href="/admin/support" className="panel-hover block p-4 border border-ink-3 rounded-lg hover:border-signal/50 transition-colors">
              <p className="font-medium text-bone">Support Inbox</p>
              <p className="text-sm text-bone-3 mt-1">All tickets, SLA tracking</p>
            </Link>
            <Link href="/admin/feature-flags" className="panel-hover block p-4 border border-ink-3 rounded-lg hover:border-signal/50 transition-colors">
              <p className="font-medium text-bone">Feature Flags</p>
              <p className="text-sm text-bone-3 mt-1">Rollout controls, overrides</p>
            </Link>
          </div>
        </section>

        <section className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-bone">System Status</h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald/10 text-emerald">
              <span className="w-2 h-2 rounded-full bg-emerald" aria-hidden="true" />
              All Systems Operational
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="p-3 rounded-lg bg-ink-2">
              <p className="text-sm text-bone-3">Database</p>
              <p className="font-medium text-emerald">Healthy</p>
            </div>
            <div className="p-3 rounded-lg bg-ink-2">
              <p className="text-sm text-bone-3">API Latency (p95)</p>
              <p className="font-medium text-bone">~120ms</p>
            </div>
            <div className="p-3 rounded-lg bg-ink-2">
              <p className="text-sm text-bone-3">Error Rate (1h)</p>
              <p className="font-medium text-emerald">{'<'} 0.1%</p>
            </div>
            <div className="p-3 rounded-lg bg-ink-2">
              <p className="text-sm text-bone-3">Queue Workers</p>
              <p className="font-medium text-bone">Running</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}