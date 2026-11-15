/**
 * Phase 7 — Email Unsubscribe API (public)
 * GET /api/public/email/unsubscribe?user=<id>&template=<optional>
 *
 * One-click unsubscribe from the email footer link.
 */

import { NextResponse } from "next/server";
import { unsubscribe } from "@/lib/email/email";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user");
  const template = searchParams.get("template") || undefined;

  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    await unsubscribe(userId, template, "email link");
    return NextResponse.json({ success: true, message: "You have been unsubscribed." });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
