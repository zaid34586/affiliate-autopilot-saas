/**
 * Phase 8 — Admin API: Users
 * GET /api/admin/users - List users with filters, pagination
 * GET /api/admin/users/[id] - User detail
 * PATCH /api/admin/users/[id] - Update user (suspend, role, etc.)
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { users, workspaces, workspaceMembers, subscriptions } from "@aa/db";
import { eq, and, desc, asc, ilike, or, sql, count, gte, lte } from "drizzle-orm";

// Only these columns are safe/meaningful to sort by (avoids indexing table methods).
const SORTABLE_USER_COLUMNS = {
  createdAt: users.createdAt,
  email: users.email,
  name: users.name,
  id: users.id,
} as const;
type UserSortKey = keyof typeof SORTABLE_USER_COLUMNS;

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status"); // active|suspended|all
  const sort = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") || "desc";

  const offset = (page - 1) * limit;

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
  if (status === "active") whereConditions.push(eq(users.status, "active"));
  if (status === "suspended") whereConditions.push(eq(users.status, "suspended"));

  const orderColumn =
    SORTABLE_USER_COLUMNS[sort as UserSortKey] ?? SORTABLE_USER_COLUMNS.createdAt;
  const orderFn = order === "asc" ? asc : desc;

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
        status: users.status,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        workspaceCount: sql<number>`(
          select count(*) from ${workspaceMembers} where ${workspaceMembers.userId} = ${users.id}
        )::int`,
        subscriptionStatus: sql<string>`(
          select s.status from ${subscriptions} s
          join ${workspaces} w on w.id = s.workspace_id
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

  return NextResponse.json({
    users: userRows,
    pagination: {
      page,
      limit,
      total: totalResult[0]?.count || 0,
      totalPages: Math.ceil((totalResult[0]?.count || 0) / limit),
    },
  });
}