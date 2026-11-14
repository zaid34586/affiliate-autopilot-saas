/**
 * Phase 6 — Character v3 Voice Note API
 * POST /api/dashboard/character/v3/voice-note - Generate voice note
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { generateVoiceNote, canUseVoiceFeatures } from "@/lib/character/character-v3";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: { text: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text } = body;

  if (!text || text.trim().length === 0) {
    return NextResponse.json({ error: "Text required" }, { status: 400 });
  }

  if (text.length > 2000) {
    return NextResponse.json({ error: "Text too long (max 2000 characters)" }, { status: 400 });
  }

  // Check voice features availability
  const voiceCheck = await canUseVoiceFeatures(workspaceId);
  if (!voiceCheck.canUse) {
    return NextResponse.json({ error: voiceCheck.reason || "Voice features unavailable" }, { status: 400 });
  }

  try {
    const result = await generateVoiceNote(workspaceId, text.trim());
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ 
      success: true, 
      audioUrl: result.audioUrl,
      message: "Voice note generated successfully" 
    });
  } catch (error) {
    console.error("Voice note generation error:", error);
    return NextResponse.json({ error: "Failed to generate voice note" }, { status: 500 });
  }
}