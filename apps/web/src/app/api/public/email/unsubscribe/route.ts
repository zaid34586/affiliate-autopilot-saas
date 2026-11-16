/**
 * Phase 7 — Email Unsubscribe API (public)
 * GET /api/public/email/unsubscribe?user=<id>&template=<optional>&sig=<hmac>
 *
 * One-click unsubscribe from the email footer link.
 * Phase 4: the link must carry a valid HMAC signature — otherwise anyone
 * could mass-unsubscribe users by guessing UUIDs.
 */

import { NextResponse } from "next/server";
import { unsubscribe } from "@/lib/email/email";
import { verifyUnsubscribeToken } from "@/lib/email/email-core";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user");
  const template = searchParams.get("template") || undefined;
  const sig = searchParams.get("sig");

  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const secret = process.env.AUTH_SECRET || "";
  if (!verifyUnsubscribeToken(userId, template, sig, secret)) {
    return NextResponse.json({ error: "Invalid or missing signature" }, { status: 400 });
  }

  try {
    await unsubscribe(userId, template, "email link");
    return NextResponse.json({ success: true, message: "You have been unsubscribed." });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
