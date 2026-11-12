import { auth } from "@/auth";
import { db } from "@/lib/db";
import { connections } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId;

  try {
    const existing = await db
      .select()
      .from(connections)
      .where(and(eq(connections.workspaceId, workspaceId), eq(connections.provider, "gemini_byok")))
      .limit(1);

    let geminiKey = "";
    if (existing.length && existing[0].apiKeyEnc) {
      // TODO: decrypt
      geminiKey = existing[0].apiKeyEnc;
    }

    const elevenlabsExisting = await db
      .select()
      .from(connections)
      .where(and(eq(connections.workspaceId, workspaceId), eq(connections.provider, "elevenlabs")))
      .limit(1);

    let elevenlabsKey = "";
    if (elevenlabsExisting.length && elevenlabsExisting[0].apiKeyEnc) {
      elevenlabsKey = elevenlabsExisting[0].apiKeyEnc;
    }

    return NextResponse.json({ geminiKey, elevenlabsKey });
  } catch (e) {
    console.error("Fetch AI keys error:", e);
    return NextResponse.json({ error: "Failed to fetch AI keys" }, { status: 500 });
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
    const { geminiKey, elevenlabsKey } = body;

    if (geminiKey !== undefined) {
      await db
        .insert(connections)
        .values({
          workspaceId,
          provider: "gemini_byok",
          apiKeyEnc: geminiKey, // TODO: encrypt
          status: "active",
        })
        .onConflictDoUpdate({
          target: [connections.workspaceId, connections.provider],
          set: { apiKeyEnc: geminiKey, status: "active" },
        });
    }

    if (elevenlabsKey !== undefined) {
      await db
        .insert(connections)
        .values({
          workspaceId,
          provider: "elevenlabs",
          apiKeyEnc: elevenlabsKey, // TODO: encrypt
          status: "active",
        })
        .onConflictDoUpdate({
          target: [connections.workspaceId, connections.provider],
          set: { apiKeyEnc: elevenlabsKey, status: "active" },
        });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Save AI keys error:", e);
    return NextResponse.json({ error: "Failed to save AI keys" }, { status: 500 });
  }
}