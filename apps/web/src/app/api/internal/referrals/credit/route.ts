/**
 * Phase 7 — Internal Referral Credit API
 * POST /api/internal/referrals/credit
 *
 * Called by billing webhooks when a referred workspace pays.
 * Auth: CRON_SECRET bearer token (internal service-to-service).
 *
 * Body: { workspaceId, paymentCents, periodEnd? }
 */

import { NextResponse } from "next/server";
import { creditCommission } from "@/lib/referrals/referrals";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Internal API not configured" }, { status: 500 });
  }

  let body: { workspaceId: string; paymentCents: number; periodEnd?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.workspaceId || typeof body.paymentCents !== "number") {
    return NextResponse.json({ error: "workspaceId and paymentCents required" }, { status: 400 });
  }
  if (body.paymentCents <= 0 || body.paymentCents > 10_000_000) {
    return NextResponse.json({ error: "paymentCents must be 1-10000000" }, { status: 400 });
  }

  try {
    const result = await creditCommission({
      referredWorkspaceId: body.workspaceId,
      paymentCents: body.paymentCents,
      periodEnd: body.periodEnd,
    });

    // null = not referred OR already credited this period (both fine, idempotent)
    return NextResponse.json({ success: true, credited: result !== null, result });
  } catch (error) {
    console.error("Credit commission error:", error);
    return NextResponse.json({ error: "Failed to credit commission" }, { status: 500 });
  }
}
