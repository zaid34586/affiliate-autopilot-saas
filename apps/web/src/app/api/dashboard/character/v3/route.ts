/**
 * Phase 6 — Character v3 API
 * GET /api/dashboard/character/v3 - Get character v3 config
 * PATCH /api/dashboard/character/v3 - Update character v3 config
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getCharacterV3, updateCharacterV3, canUseVoiceFeatures } from "@/lib/character/character-v3";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const character = await getCharacterV3(workspaceId);
    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const voiceCheck = await canUseVoiceFeatures(workspaceId);

    return NextResponse.json({ 
      character,
      voiceFeaturesAvailable: voiceCheck.canUse,
      voiceUnavailableReason: voiceCheck.reason,
    });
  } catch (error) {
    console.error("Get character v3 error:", error);
    return NextResponse.json({ error: "Failed to get character" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: {
    voiceId?: string;
    voiceSettings?: { stability?: number; similarityBoost?: number; style?: number; useSpeakerBoost?: boolean };
    dmReplyMode?: "off" | "suggested" | "auto";
    dmReplySettings?: { maxLength?: number; includeLink?: boolean; tone?: string; language?: string };
    voiceNotesEnabled?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await updateCharacterV3(workspaceId, body);
    if (!result.valid) {
      return NextResponse.json({ error: result.errors.join(", ") }, { status: 400 });
    }
    return NextResponse.json({ character: result.character });
  } catch (error) {
    console.error("Update character v3 error:", error);
    return NextResponse.json({ error: "Failed to update character" }, { status: 500 });
  }
}