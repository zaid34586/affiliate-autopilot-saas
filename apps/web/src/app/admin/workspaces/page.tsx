/**
 * Phase 8 — Admin Workspaces Page
 */

import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers, users, subscriptions, analyticsDaily } from "@aa/db";
import { eq, and, desc, asc, ilike, or, sql, count, gte } from "drizzle-orm";
import Link from "next/link";

const PLAN_VALUES = ["free", "starter", "pro", "agency"] as const;
type PlanValue = (typeof PLAN_VALUES)[number];

const planColors: Record<PlanValue, string> = {
  free: "bg-slate/10 text-slate",
  starter: "bg-blue/10 text-blue",
  pro: "bg-emerald/10 text-emerald",
  agency: "bg-amber/10 text-amber",
};

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; plan?: string; sort?: string; order?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit || "50")));
  const search = params.search?.trim();
  const plan = params.plan;
  const sort = params.sort || "createdAt";
  const order = params.order || "desc";
  const offset = (page - 1) * limit;

  const whereConditions = [];
  if (search) {
    whereConditions.push(
      or(
        ilike(workspaces.name, `%${search}%`),
        eq(workspaces.id, search),
      ),
    );
  }
  if (plan && PLAN_VALUES.includes(plan as PlanValue)) whereConditions.push(eq(workspaces.plan, plan as PlanValue));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Map sort parameter to actual column
  const orderColumnMap: Record<string, any> = {
    name: workspaces.name,
    plan: workspaces.plan,
    createdAt: workspaces.createdAt,
    creditsBalance: workspaces.creditsBalance,
  };
  const orderColumn = orderColumnMap[sort] || workspaces.createdAt;
  const orderFn = order === "asc" ? asc : desc;

  const [wsRows, totalResult] = await Promise.all([
    db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        ownerUserId: workspaces.ownerUserId,
        plan: workspaces.plan,
        creditsBalance: workspaces.creditsBalance,
        createdAt: workspaces.createdAt,
        memberCount: sql<number>`(
          select count(*) from ${workspaceMembers} where ${workspaceMembers.workspaceId} = ${workspaces.id}
        )::int`,
        subscriptionStatus: sql<string>`(
          select status from ${subscriptions} where ${subscriptions.workspaceId} = ${workspaces.id} order by created_at desc limit 1
        )`,
        recentActivity: sql<number>`(
          select count(*) from ${analyticsDaily} 
          where ${analyticsDaily.workspaceId} = ${workspaces.id} 
          and ${analyticsDaily.day} >= ${thirtyDaysAgo.toISOString().split("T")[0]}
        )::int`,
        ownerEmail: sql<string>`(
          select email from ${users} where ${users.id} = ${workspaces.ownerUserId}
        )`,
      })
      .from(workspaces)
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(workspaces)
      .where(whereConditions.length ? and(...whereConditions) : undefined),
  ]);

  const total = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-bone">Workspaces</h1>
          <p className="text-bone-2 mt-1">Organizations on the platform</p>
        </div>
      </header>

      <div className="panel">
        <div className="p-4 border-b border-ink-3 flex flex-col sm:flex-row gap-4">
          <form method="GET" className="flex-1 flex gap-2">
            <input
              type="search"
              name="search"
              placeholder="Search by name or ID..."
              value={search || ""}
              className="w-full sm:w-80 px-3 py-2 bg-ink border border-ink-3 rounded-lg text-bone placeholder-bone-3 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
            />
            <select
              name="plan"
              value={plan || ""}
              className="px-3 py-2 bg-ink border border-ink-3 rounded-lg text-bone focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
            >
              <option value="">All Plans</option>
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="agency">Agency</option>
            </select>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="text-left text-xs font-medium text-bone-3 uppercase tracking-wider border-b border-ink-3">
                <th className="pb-3 px-4">Workspace</th>
                <th className="pb-3 px-4 hidden md:table-cell">Plan</th>
                <th className="pb-3 px-4 hidden md:table-cell">Owner</th>
                <th className="pb-3 px-4 hidden lg:table-cell">Members</th>
                <th className="pb-3 px-4 hidden lg:table-cell">Credits</th>
                <th className="pb-3 px-4 hidden xl:table-cell">Subscription</th>
                <th className="pb-3 px-4 hidden xl:table-cell">Activity (30d)</th>
                <th className="pb-3 px-4">Created</th>
                <th className="pb-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-3">
              {wsRows.map((w) => (
                <tr key={w.id} className="hover:bg-ink-2/50 transition-colors">
                  <td className="py-3 px-4">
                    <Link href={`/admin/workspaces/${w.id}`} className="font-medium text-bone hover:text-signal">
                      {w.name}
                    </Link>
                    <p className="text-xs text-bone-3 font-mono">{w.id.slice(0, 8)}...</p>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs ${planColors[w.plan as PlanValue] || "bg-ink-3 text-bone-2"}`}>
                      {w.plan}
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <div className="text-bone-2">{w.ownerEmail || "Unknown"}</div>
                    <div className="text-xs text-bone-3 font-mono">{w.ownerUserId?.slice(0, 8)}...</div>
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell text-bone-2">{w.memberCount}</td>
                  <td className="py-3 px-4 hidden lg:table-cell text-bone-2">{w.creditsBalance?.toLocaleString() || 0}</td>
                  <td className="py-3 px-4 hidden xl:table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs ${
                      w.subscriptionStatus === "active" ? "bg-emerald/10 text-emerald" :
                      w.subscriptionStatus === "trialing" ? "bg-amber/10 text-amber" :
                      "bg-ink-3 text-bone-2"
                    }`}>
                      {w.subscriptionStatus || "None"}
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden xl:table-cell text-bone-2">{w.recentActivity}</td>
                  <td className="py-3 px-4 text-bone-2 whitespace-nowrap">
                    {new Date(w.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/admin/workspaces/${w.id}`}
                      className="text-sm text-signal hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {wsRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-bone-3">
                    No workspaces found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-ink-3 flex items-center justify-between">
            <p className="text-sm text-bone-3">
              Page {page} of {totalPages} — {total.toLocaleString()} workspaces
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}${plan ? `&plan=${plan}` : ""}`}
                  className="px-3 py-1.5 text-sm border border-ink-3 rounded-lg hover:bg-ink-3 transition-colors"
                >
                  Previous
                </a>
              )}
              {page < totalPages && (
                <a
                  href={`?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}${plan ? `&plan=${plan}` : ""}`}
                  className="px-3 py-1.5 text-sm border border-ink-3 rounded-lg hover:bg-ink-3 transition-colors"
                >
                  Next
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}