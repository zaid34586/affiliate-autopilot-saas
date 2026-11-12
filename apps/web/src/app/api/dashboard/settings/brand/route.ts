import { auth } from "@/auth";
import { db } from "@/lib/db";
import { brandProfiles } from "@aa/db";
import { eq } from "drizzle-orm";
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
      .from(brandProfiles)
      .where(eq(brandProfiles.workspaceId, workspaceId))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json({
        niche: "",
        audienceDesc: "",
        tone: "friendly",
        languages: ["en"],
        bannedWords: [],
        voiceSampleRef: null,
      });
    }

    const bp = existing[0];
    return NextResponse.json({
      niche: bp.niche,
      audienceDesc: bp.audienceDesc ?? "",
      tone: bp.tone ?? "friendly",
      languages: (bp.languages as string[]) ?? ["en"],
      bannedWords: (bp.bannedWords as string[]) ?? [],
      voiceSampleRef: bp.voiceSampleRef ?? null,
    });
  } catch (e) {
    console.error("Fetch brand profile error:", e);
    return NextResponse.json({ error: "Failed to fetch brand profile" }, { status: 500 });
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
    const { niche, audienceDesc, tone, languages, bannedWords, voiceSampleRef } = body;

    await db
      .insert(brandProfiles)
      .values({
        workspaceId,
        niche: niche ?? "",
        audienceDesc: audienceDesc ?? null,
        tone: tone ?? "friendly",
        languages: languages ?? ["en"],
        bannedWords: bannedWords ?? [],
        voiceSampleRef: voiceSampleRef ?? null,
      })
      .onConflictDoUpdate({
        target: brandProfiles.workspaceId,
        set: {
          niche: niche ?? undefined,
          audienceDesc: audienceDesc ?? undefined,
          tone: tone ?? undefined,
          languages: languages ?? undefined,
          bannedWords: bannedWords ?? undefined,
          voiceSampleRef: voiceSampleRef ?? undefined,
        },
      });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Save brand profile error:", e);
    return NextResponse.json({ error: "Failed to save brand profile" }, { status: 500 });
  }
}