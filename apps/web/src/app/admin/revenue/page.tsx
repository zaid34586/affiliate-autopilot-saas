/**
 * Phase 8 — Admin Revenue Page
 */

import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { subscriptions, workspaces, users } from "@aa/db";
import { eq, and, desc, asc, ilike, or, sql, count, sum, gte, lte } from "drizzle-orm";
import Link from "next/link";

export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string; limit?: string; search?: string; status?: string; plan?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const type = params.type || "overview";

  if (type === "subscriptions") {
    return renderSubscriptionsList(params);
  }
  return renderOverview();
}

async function renderOverview() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    activeSubs,
    mrrResult,
    arrResult,
    trialResult,
    churnResult,
    revenueByPlan,
    recentSubs,
  ] = await Promise.all([
    db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, "active")),
    db.select({ mrr: sql<number>`coalesce(sum(amount_cents), 0)::int / 100.0` }).from(subscriptions).where(eq(subscriptions.status, "active")),
    db.select({ arr: sql<number>`coalesce(sum(amount_cents) * 12, 0)::int / 100.0` }).from(subscriptions).where(eq(subscriptions.status, "active")),
    db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, "trialing")),
    db
      .select({ count: count() })
      .from(subscriptions)
      .where(and(eq(subscriptions.status, "canceled"), gte(subscriptions.canceledAt, startOfLastMonth), lte(subscriptions.canceledAt, endOfLastMonth))),
    db
      .select({
        plan: subscriptions.plan,
        count: count(),
        mrr: sql<number>`coalesce(sum(amount_cents), 0)::int / 100.0`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"))
      .groupBy(subscriptions.plan),
    db
      .select({
        id: subscriptions.id,
        workspaceId: subscriptions.workspaceId,
        amountCents: subscriptions.amountCents,
        plan: subscriptions.plan,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        workspaceName: workspaces.name,
        ownerEmail: users.email,
      })
      .from(subscriptions)
      .leftJoin(workspaces, eq(subscriptions.workspaceId, workspaces.id))
      .leftJoin(users, eq(workspaces.ownerUserId, users.id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(10),
  ]);

  const mrr = Math.round((mrrResult[0]?.mrr || 0) * 100) / 100;
  const arr = Math.round((arrResult[0]?.arr || 0) * 100) / 100;
  const activeCount = activeSubs[0]?.count || 0;
  const trialCount = trialResult[0]?.count || 0;
  const churnCount = churnResult[0]?.count || 0;
  const churnRate = activeCount > 0 ? Math.round((churnCount / activeCount) * 100 * 100) / 100 : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-bone">Revenue</h1>
          <p className="text-bone-2 mt-1">MRR, subscriptions, and growth metrics</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/revenue?type=subscriptions" className="px-4 py-2 border border-ink-3 rounded-lg hover:bg-ink-3 transition-colors text-sm">
            View All Subscriptions
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR" value={`$${mrr.toLocaleString()}`} color="text-signal" />
        <StatCard label="ARR" value={`$${arr.toLocaleString()}`} color="text-emerald" />
        <StatCard label="Active Subscriptions" value={activeCount.toLocaleString()} color="text-sky" />
        <StatCard label="Trials" value={trialCount.toLocaleString()} color="text-amber" />
        <StatCard label="Churn (30d)" value={`${churnRate}%`} color={churnRate > 5 ? "text-rose" : "text-emerald"} />
        <StatCard label="Trial → Paid" value={`${activeCount > 0 ? Math.round((activeCount / (activeCount + trialCount)) * 100) : 0}%`} color="text-violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-semibold text-bone mb-4">Revenue by Plan</h2>
          <div className="space-y-3">
            {revenueByPlan.length === 0 ? (
              <p className="text-bone-3 text-center py-8">No active subscriptions</p>
            ) : (
              revenueByPlan.map((r) => (
                <div key={r.plan} className="flex items-center justify-between p-3 bg-ink-2 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                      r.plan === "growth" ? "bg-emerald/20 text-emerald" :
                      r.plan === "scale" ? "bg-amber/20 text-amber" :
                      r.plan === "starter" ? "bg-blue/20 text-blue" :
                      "bg-slate/20 text-slate"
                    }`}>
                      {r.plan[0].toUpperCase()}
                    </span>
                    <span className="font-medium text-bone capitalize">{r.plan}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-bone">${(r.mrr || 0).toLocaleString()}/mo</p>
                    <p className="text-xs text-bone-3">{r.count} subscriptions</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-semibold text-bone mb-4">Recent Subscriptions</h2>
          <div className="space-y-3">
            {recentSubs.map((s) => (
              <Link key={s.id} href={`/admin/revenue?type=subscriptions&search=${s.id}`} className="block p-3 bg-ink-2 rounded-lg hover:bg-ink-3 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-bone">{s.workspaceName || "Unknown Workspace"}</p>
                    <p className="text-xs text-bone-3">{s.ownerEmail} • {s.plan}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-bone">${(s.amountCents / 100).toLocaleString()}</p>
                    <p className="text-xs text-bone-3">{s.status}</p>
                  </div>
                </div>
              </Link>
            ))}
            {recentSubs.length === 0 && <p className="text-bone-3 text-center py-8">No subscriptions yet</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="panel p-5">
      <p className="text-sm text-bone-3">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-bone {color}">{value}</p>
    </div>
  );
}

async function renderSubscriptionsList(params: any) {
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit || "50")));
  const status = params.status;
  const plan = params.plan;
  const search = params.search?.trim();
  const offset = (page - 1) * limit;

  const whereConditions = [];
  if (status && status !== "all") whereConditions.push(eq(subscriptions.status, status));
  if (plan) whereConditions.push(eq(subscriptions.plan, plan));
  if (search) {
    whereConditions.push(
      or(
        ilike(workspaces.name, `%${search}%`),
        ilike(users.email, `%${search}%`),
        eq(subscriptions.id, search),
      ),
    );
  }

  const [subRows, totalResult] = await Promise.all([
    db
      .select({
        id: subscriptions.id,
        workspaceId: subscriptions.workspaceId,
        status: subscriptions.status,
        plan: subscriptions.plan,
        amountCents: subscriptions.amountCents,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        canceledAt: subscriptions.canceledAt,
        createdAt: subscriptions.createdAt,
        workspaceName: workspaces.name,
        ownerEmail: users.email,
      })
      .from(subscriptions)
      .leftJoin(workspaces, eq(subscriptions.workspaceId, workspaces.id))
      .leftJoin(users, eq(workspaces.ownerUserId, users.id))
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .orderBy(desc(subscriptions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(subscriptions)
      .leftJoin(workspaces, eq(subscriptions.workspaceId, workspaces.id))
      .leftJoin(users, eq(workspaces.ownerUserId, users.id))
      .where(whereConditions.length ? and(...whereConditions) : undefined),
  ]);

  const total = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  const PLAN_VALUES = ["free", "starter", "pro", "agency"] as const;
  type PlanValue = (typeof PLAN_VALUES)[number];

  const statusColors: Record<string, string> = {
    active: "bg-emerald/10 text-emerald",
    trialing: "bg-amber/10 text-amber",
    past_due: "bg-rose/10 text-rose",
    canceled: "bg-slate/10 text-slate",
    incomplete: "bg-amber/10 text-amber",
  };

  const planOptions = [
    { value: "free", label: "Free" },
    { value: "starter", label: "Starter" },
    { value: "pro", label: "Pro" },
    { value: "agency", label: "Agency" },
  ] as const;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-bone">All Subscriptions</h1>
          <p className="text-bone-2 mt-1">Manage and filter subscriptions</p>
        </div>
        <Link href="/admin/revenue" className="px-4 py-2 border border-ink-3 rounded-lg hover:bg-ink-3 transition-colors text-sm">
          ← Back to Overview
        </Link>
      </header>

      <div className="panel">
        <div className="p-4 border-b border-ink-3 flex flex-col sm:flex-row gap-4">
          <form method="GET" className="flex gap-2 flex-1">
            <input type="hidden" name="type" value="subscriptions" />
            <input
              type="search"
              name="search"
              placeholder="Search workspace, email, or ID..."
              value={search || ""}
              className="w-full sm:w-80 px-3 py-2 bg-ink border border-ink-3 rounded-lg text-bone placeholder-bone-3 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
            />
            <select name="status" value={status || "all"} className="px-3 py-2 bg-ink border border-ink-3 rounded-lg text-bone focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past Due</option>
              <option value="canceled">Canceled</option>
            </select>
            <select name="plan" value={plan || ""} className="px-3 py-2 bg-ink border border-ink-3 rounded-lg text-bone focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal">
              <option value="">All Plans</option>
              {planOptions.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="text-left text-xs font-medium text-bone-3 uppercase tracking-wider border-b border-ink-3">
                <th className="pb-3 px-4">Subscription</th>
                <th className="pb-3 px-4 hidden md:table-cell">Workspace</th>
                <th className="pb-3 px-4 hidden md:table-cell">Plan</th>
                <th className="pb-3 px-4 hidden lg:table-cell">Amount</th>
                <th className="pb-3 px-4 hidden lg:table-cell">Status</th>
                <th className="pb-3 px-4 hidden xl:table-cell">Period End</th>
                <th className="pb-3 px-4 hidden xl:table-cell">Owner</th>
                <th className="pb-3 px-4">Created</th>
                <th className="pb-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-3">
              {subRows.map((s) => (
                <tr key={s.id} className="hover:bg-ink-2/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs text-bone-3">{s.id.slice(0, 12)}...</td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <Link href={`/admin/workspaces/${s.workspaceId}`} className="font-medium text-bone hover:text-signal">
                      {s.workspaceName || "Unknown"}
                    </Link>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell capitalize">{s.plan}</td>
                  <td className="py-3 px-4 hidden lg:table-cell text-bone">${(s.amountCents / 100).toLocaleString()}/{s.interval}</td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs ${statusColors[s.status] || "bg-ink-3 text-bone-2"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden xl:table-cell text-bone-2">
                    {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-3 px-4 hidden xl:table-cell text-bone-2">{s.ownerEmail || "—"}</td>
                  <td className="py-3 px-4 text-bone-2 whitespace-nowrap">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-right">
                    <Link href={`/admin/subscriptions/${s.id}`} className="text-sm text-signal hover:underline">View</Link>
                  </td>
                </tr>
              ))}
              {subRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-bone-3">No subscriptions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-ink-3 flex items-center justify-between">
            <p className="text-sm text-bone-3">Page {page} of {totalPages} — {total.toLocaleString()} subscriptions</p>
            <div className="flex gap-2">
              {page > 1 && <a href={`?type=subscriptions&page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}${status ? `&status=${status}` : ""}${plan ? `&plan=${plan}` : ""}`} className="px-3 py-1.5 text-sm border border-ink-3 rounded-lg hover:bg-ink-3 transition-colors">Previous</a>}
              {page < totalPages && <a href={`?type=subscriptions&page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}${status ? `&status=${status}` : ""}${plan ? `&plan=${plan}` : ""}`} className="px-3 py-1.5 text-sm border border-ink-3 rounded-lg hover:bg-ink-3 transition-colors">Next</a>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}