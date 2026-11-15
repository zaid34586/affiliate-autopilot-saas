/**
 * Phase 7 — Public Referral Click API
 * GET /api/public/referrals/[code] - record click, return referrer info
 */

import { NextResponse } from "next/server";
import { recordReferralClick, getReferralByCode } from "@/lib/referrals/referrals";
import { isValidReferralCode } from "@/lib/referrals/referrals-core";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const upper = (code || "").toUpperCase();

  if (!isValidReferralCode(upper)) {
    return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });
  }

  try {
    const ref = await recordReferralClick(upper);
    if (!ref) {
      return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        code: ref.code,
        clicks: ref.clicks,
        // Don't leak user identity — just confirm valid code
        valid: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Referral click error:", error);
    return NextResponse.json({ error: "Failed to record click" }, { status: 500 });
  }
}
