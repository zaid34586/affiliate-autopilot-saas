/**
 * Phase 7 — Referrals API (Dashboard)
 * GET  /api/dashboard/referrals - get code + stats
 * PUT  /api/dashboard/referrals/settings - update program settings (admin)
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requireAdminAccess, requireOwnerAccess } from "@/lib/auth-utils";
import {
  getOrCreateReferralCode,
  getReferralStats,
  getReferralSettings,
  updateReferralSettings,
  getTopReferrers,
} from "@/lib/referrals/referrals";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "me";

  try {
    if (scope === "top") {
      const hasAdminAccess = await requireAdminAccess(workspaceId, session.user.id);
      if (!hasAdminAccess) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
      const top = await getTopReferrers();
      return NextResponse.json({ referrers: top });
    }

    // Ensure user has a code, then return stats
    await getOrCreateReferralCode(session.user.id, workspaceId);
    const stats = await getReferralStats(session.user.id);

    if (!stats) {
      return NextResponse.json({ error: "Referral record not found" }, { status: 404 });
    }

    const origin = new URL(req.url).origin;
    return NextResponse.json({
      ...stats,
      shareUrl: `${origin}/signup?ref=${stats.code}`,
    });
  } catch (error) {
    console.error("Get referrals error:", error);
    return NextResponse.json({ error: "Failed to load referrals" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const isOwner = await requireOwnerAccess(workspaceId, session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  let body: {
    enabled?: boolean;
    commissionPct?: number;
    creditBonusCents?: number;
    referredCreditCents?: number;
    minPayoutCents?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validation
  if (body.commissionPct != null && (body.commissionPct < 0 || body.commissionPct > 50)) {
    return NextResponse.json({ error: "commissionPct must be 0-50" }, { status: 400 });
  }
  for (const key of ["creditBonusCents", "referredCreditCents", "minPayoutCents"] as const) {
    if (body[key] != null && (body[key] < 0 || body[key] > 1_000_000)) {
      return NextResponse.json({ error: `${key} must be 0-1000000` }, { status: 400 });
    }
  }

  try {
    const settings = await updateReferralSettings(body);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Update referral settings error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
