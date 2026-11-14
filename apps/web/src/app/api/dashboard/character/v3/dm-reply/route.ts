/**
 * Phase 6 — Character v3 DM Reply API
 * POST /api/dashboard/character/v3/dm-reply - Generate DM reply
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { generateDmReplyForMessage, canUseVoiceFeatures } from "@/lib/character/character-v3";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: { incomingMessage: string; productId?: string; linkId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { incomingMessage, productId, linkId } = body;

  if (!incomingMessage || incomingMessage.trim().length === 0) {
    return NextResponse.json({ error: "incomingMessage required" }, { status: 400 });
  }

  // Check voice features availability (for DM replies, we need ElevenLabs key)
  const voiceCheck = await canUseVoiceFeatures(workspaceId);
  if (!voiceCheck.canUse) {
    return NextResponse.json({ error: voiceCheck.reason || "DM replies unavailable - configure ElevenLabs key" }, { status: 400 });
  }

  try {
    const result = await generateDmReplyForMessage({
      incomingMessage: incomingMessage.trim(),
      characterId: "current", // Will be resolved from workspace
      productId,
      workspaceId,
      linkId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      reply: result.reply,
      linkIncluded: result.linkIncluded,
      message: "DM reply generated successfully",
    });
  } catch (error) {
    console.error("DM reply generation error:", error);
    return NextResponse.json({ error: "Failed to generate DM reply" }, { status: 500 });
  }
}