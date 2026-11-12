import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dmMessages, dmTriggers } from "@aa/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId;

  try {
    const msgs = await db
      .select()
      .from(dmMessages)
      .where(eq(dmMessages.workspaceId, workspaceId))
      .orderBy(desc(dmMessages.createdAt))
      .limit(500);

    return NextResponse.json({ messages: msgs });
  } catch (e) {
    console.error("Fetch DM messages error:", e);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}