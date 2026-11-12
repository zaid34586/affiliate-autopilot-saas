import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@aa/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Generate TOTP secret (base32 compatible)
    const secret = randomBytes(20).toString("base64").replace(/[+/=]/g, "").substring(0, 32);
    const otpauth = `otpauth://totp/AffiliateAutopilot:${session.user.email}?secret=${secret}&issuer=AffiliateAutopilot`;

    // TODO: Store encrypted secret in DB
    await db
      .update(users)
      .set({ twoFactorSecret: secret, twoFactorEnabled: true })
      .where(eq(users.id, userId));

    return NextResponse.json({ secret, otpauth });
  } catch (e) {
    console.error("Enable 2FA error:", e);
    return NextResponse.json({ error: "Failed to enable 2FA" }, { status: 500 });
  }
}