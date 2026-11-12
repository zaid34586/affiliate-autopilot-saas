import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@aa/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length) {
      return NextResponse.json({ twoFactorEnabled: false, sessions: [] });
    }

    return NextResponse.json({
      twoFactorEnabled: user[0].twoFactorEnabled ?? false,
      sessions: [], // TODO: implement session tracking
    });
  } catch (e) {
    console.error("Fetch security settings error:", e);
    return NextResponse.json({ error: "Failed to fetch security settings" }, { status: 500 });
  }
}