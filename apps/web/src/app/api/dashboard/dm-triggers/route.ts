import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dmTriggers } from "@aa/db";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId;

  try {
    const triggers = await db
      .select()
      .from(dmTriggers)
      .where(eq(dmTriggers.workspaceId, workspaceId))
      .orderBy(desc(dmTriggers.createdAt));

    return NextResponse.json({ triggers });
  } catch (e) {
    console.error("Fetch DM triggers error:", e);
    return NextResponse.json({ error: "Failed to fetch triggers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId;

  try {
    const body = await req.json();
    const { postId, keywords, replyTemplate, mode, cooldownHours, dailyCap, enabled } = body;

    if (!keywords?.set?.length || !replyTemplate) {
      return NextResponse.json({ error: "Keywords and reply template required" }, { status: 400 });
    }

    const trigger = await db
      .insert(dmTriggers)
      .values({
        workspaceId,
        postId: postId || null,
        keywords: keywords,
        replyTemplate,
        mode: mode || "semi",
        cooldownHours: cooldownHours || 24,
        dailyCap: dailyCap || 50,
        enabled: enabled ?? true,
      })
      .returning();

    return NextResponse.json({ trigger: trigger[0] });
  } catch (e) {
    console.error("Create DM trigger error:", e);
    return NextResponse.json({ error: "Failed to create trigger" }, { status: 500 });
  }
}