/**
 * Phase 8 — Admin Users Page
 */

import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { users, workspaceMembers, subscriptions, workspaces } from "@aa/db";
import { eq, and, desc, asc, ilike, or, sql, count } from "drizzle-orm";
import Link from "next/link";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; sort?: string; order?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit || "50")));
  const search = params.search?.trim();
  const sort = params.sort || "createdAt";
  const order = params.order || "desc";
  const offset = (page - 1) * limit;

  // Map sort parameter to actual column
  const orderColumnMap: Record<string, any> = {
    email: users.email,
    name: users.name,
    createdAt: users.createdAt,
    authProvider: users.authProvider,
    onboardingDone: users.onboardingDone,
    twoFactorEnabled: users.twoFactorEnabled,
  };
  const orderColumn = orderColumnMap[sort] || users.createdAt;
  const orderFn = order === "asc" ? asc : desc;

  const whereConditions = [];
  if (search) {
    whereConditions.push(
      or(
        ilike(users.email, `%${search}%`),
        ilike(users.name, `%${search}%`),
        eq(users.id, search),
      ),
    );
  }

  const [userRows, totalResult] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        authProvider: users.authProvider,
        onboardingDone: users.onboardingDone,
        twoFactorEnabled: users.twoFactorEnabled,
        createdAt: users.createdAt,
        workspaceCount: sql<number>`(
          select count(*) from ${workspaceMembers} where ${workspaceMembers.userId} = ${users.id}
        )::int`,
        subscriptionStatus: sql<string>`(
          select s.status from ${subscriptions} s
          join ${workspaces} w on s.workspace_id = w.id
          where w.owner_user_id = ${users.id}
          order by s.created_at desc limit 1
        )`,
      })
      .from(users)
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(users)
      .where(whereConditions.length ? and(...whereConditions) : undefined),
  ]);

  const total = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-bone">Users</h1>
          <p className="text-bone-2 mt-1">Manage platform users</p>
        </div>
      </header>

      <div className="panel">
        <div className="p-4 border-b border-ink-3 flex flex-col sm:flex-row gap-4">
          <form method="GET" className="flex-1">
            <input
              type="search"
              name="search"
              placeholder="Search by email, name, or ID..."
              value={search || ""}
              className="w-full sm:w-80 px-3 py-2 bg-ink border border-ink-3 rounded-lg text-bone placeholder-bone-3 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
            />
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="text-left text-xs font-medium text-bone-3 uppercase tracking-wider border-b border-ink-3">
                <th className="pb-3 px-4">User</th>
                <th className="pb-3 px-4 hidden md:table-cell">Provider</th>
                <th className="pb-3 px-4 hidden lg:table-cell">Workspaces</th>
                <th className="pb-3 px-4 hidden lg:table-cell">Subscription</th>
                <th className="pb-3 px-4 hidden xl:table-cell">Onboarded</th>
                <th className="pb-3 px-4 hidden xl:table-cell">2FA</th>
                <th className="pb-3 px-4">Joined</th>
                <th className="pb-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-3">
              {userRows.map((u) => (
                <tr key={u.id} className="hover:bg-ink-2/50 transition-colors">
                  <td className="py-3 px-4">
                    <div>
                      <Link href={`/admin/users/${u.id}`} className="font-medium text-bone hover:text-signal">
                        {u.name || "Unnamed"}
                      </Link>
                      <p className="text-xs text-bone-3">{u.email}</p>
                      <p className="text-xs text-bone-3 font-mono">{u.id.slice(0, 8)}...</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-ink-3 text-bone-2">
                      {u.authProvider}
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell text-bone-2">{u.workspaceCount}</td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs ${
                      u.subscriptionStatus === "active" ? "bg-emerald/10 text-emerald" :
                      u.subscriptionStatus === "trialing" ? "bg-amber/10 text-amber" :
                      "bg-ink-3 text-bone-2"
                    }`}>
                      {u.subscriptionStatus || "None"}
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden xl:table-cell">
                    <span className={u.onboardingDone ? "text-emerald" : "text-amber"}>
                      {u.onboardingDone ? "✓ Yes" : "✗ No"}
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden xl:table-cell">
                    <span className={u.twoFactorEnabled ? "text-emerald" : "text-bone-2"}>
                      {u.twoFactorEnabled ? "✓ Enabled" : "✗ Disabled"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-bone-2 whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-sm text-signal hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {userRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-bone-3">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-ink-3 flex items-center justify-between">
            <p className="text-sm text-bone-3">
              Page {page} of {totalPages} — {total.toLocaleString()} users
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                  className="px-3 py-1.5 text-sm border border-ink-3 rounded-lg hover:bg-ink-3 transition-colors"
                >
                  Previous
                </a>
              )}
              {page < totalPages && (
                <a
                  href={`?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
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