/**
 * Phase 6 — Voice Clone API
 * POST /api/dashboard/settings/voice-clone - Create voice clone from uploaded sample
 * DELETE /api/dashboard/settings/voice-clone - Delete cloned voice
 * GET /api/dashboard/settings/voice-clone - Get voice clone status
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { brandProfiles, connections } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { createClonedVoice, deleteClonedVoice, getVoiceDetails } from "@/lib/video/voice-clone";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  // Check if user has ElevenLabs key configured
  const [elevenlabsConn] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.provider, "elevenlabs")))
    .limit(1);

  if (!elevenlabsConn?.apiKeyEnc) {
    return NextResponse.json({ error: "ElevenLabs API key not configured. Add it in Settings → AI Keys." }, { status: 400 });
  }

  const apiKey = elevenlabsConn.apiKeyEnc; // TODO: decrypt

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const name = formData.get("name") as string || "My Cloned Voice";
    const description = formData.get("description") as string || "";

    if (!audioFile) {
      return NextResponse.json({ error: "Audio file required" }, { status: 400 });
    }

    // Validate file type and size
    const allowedTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm"];
    if (!allowedTypes.includes(audioFile.type)) {
      return NextResponse.json({ error: "Invalid audio format. Use MP3, WAV, OGG, or WebM." }, { status: 400 });
    }

    if (audioFile.size > 20 * 1024 * 1024) { // 20MB limit
      return NextResponse.json({ error: "Audio file too large. Max 20MB." }, { status: 400 });
    }

    // Update status to pending
    await db
      .update(brandProfiles)
      .set({
        voiceCloneStatus: "pending",
        voiceCloneError: null,
      })
      .where(eq(brandProfiles.workspaceId, workspaceId));

    // Convert file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Create voice clone on ElevenLabs
    const result = await createClonedVoice(apiKey, name, audioBuffer, description);

    if (!result.success) {
      await db
        .update(brandProfiles)
        .set({
          voiceCloneStatus: "failed",
          voiceCloneError: result.error,
        })
        .where(eq(brandProfiles.workspaceId, workspaceId));

      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Store cloned voice ID
    await db
      .update(brandProfiles)
      .set({
        clonedVoiceId: result.voiceId,
        voiceCloneStatus: "completed",
        voiceCloneError: null,
        voiceCloneCreatedAt: new Date(),
      })
      .where(eq(brandProfiles.workspaceId, workspaceId));

    return NextResponse.json({ 
      success: true, 
      voiceId: result.voiceId,
      message: "Voice clone created successfully!" 
    });
  } catch (error) {
    console.error("Voice clone error:", error);
    
    await db
      .update(brandProfiles)
      .set({
        voiceCloneStatus: "failed",
        voiceCloneError: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(brandProfiles.workspaceId, workspaceId));

    return NextResponse.json({ error: "Voice clone failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  // Get ElevenLabs key
  const [elevenlabsConn] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.provider, "elevenlabs")))
    .limit(1);

  if (!elevenlabsConn?.apiKeyEnc) {
    return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 400 });
  }

  // Get current cloned voice ID
  const [brand] = await db
    .select({ clonedVoiceId: brandProfiles.clonedVoiceId })
    .from(brandProfiles)
    .where(eq(brandProfiles.workspaceId, workspaceId))
    .limit(1);

  if (!brand?.clonedVoiceId) {
    return NextResponse.json({ error: "No cloned voice to delete" }, { status: 404 });
  }

  try {
    const apiKey = elevenlabsConn.apiKeyEnc; // TODO: decrypt

    // Delete from ElevenLabs
    const result = await deleteClonedVoice(apiKey, brand.clonedVoiceId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Clear from database
    await db
      .update(brandProfiles)
      .set({
        clonedVoiceId: null,
        voiceCloneStatus: "none",
        voiceCloneError: null,
        voiceCloneCreatedAt: null,
      })
      .where(eq(brandProfiles.workspaceId, workspaceId));

    return NextResponse.json({ success: true, message: "Cloned voice deleted" });
  } catch (error) {
    console.error("Delete voice clone error:", error);
    return NextResponse.json({ error: "Failed to delete voice clone" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const [brand] = await db
    .select({
      clonedVoiceId: brandProfiles.clonedVoiceId,
      voiceCloneStatus: brandProfiles.voiceCloneStatus,
      voiceCloneError: brandProfiles.voiceCloneError,
      voiceCloneCreatedAt: brandProfiles.voiceCloneCreatedAt,
      voiceSampleRef: brandProfiles.voiceSampleRef,
    })
    .from(brandProfiles)
    .where(eq(brandProfiles.workspaceId, workspaceId))
    .limit(1);

  // Also check if ElevenLabs key is configured
  const [elevenlabsConn] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.provider, "elevenlabs")))
    .limit(1);

  return NextResponse.json({
    hasElevenLabsKey: !!elevenlabsConn?.apiKeyEnc,
    clonedVoiceId: brand?.clonedVoiceId || null,
    voiceCloneStatus: brand?.voiceCloneStatus || "none",
    voiceCloneError: brand?.voiceCloneError || null,
    voiceCloneCreatedAt: brand?.voiceCloneCreatedAt || null,
    voiceSampleRef: brand?.voiceSampleRef || null,
  });
}