/**
 * Phase 6 — Character v3 DB Orchestration.
 * 
 * Handles: Character v3 config, voice note generation, DM reply automation
 */

import { db } from "@/lib/db";
import { characters, dmMessages, connections } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { openai } from "@ai-sdk/openai";
import { synthesizeVoiceover } from "@/lib/video/tts";
import {
  CharacterV3Config,
  CharacterVoiceSettings,
  CharacterDmReplySettings,
  VoiceNoteRequest,
  DmReplyRequest,
  buildCharacterPrompt,
  generateVoiceNoteScript,
  generateDmReply,
  validateCharacterV3Config,
  getDefaultVoiceSettings,
  getDefaultDmReplySettings,
} from "./character-v3-core";

export interface CharacterV3State {
  id: string;
  name: string;
  bio?: string;
  toneConfig: Record<string, unknown>;
  voiceId?: string;
  voiceSettings: CharacterVoiceSettings;
  dmReplyMode: "off" | "suggested" | "auto";
  dmReplySettings: CharacterDmReplySettings;
  voiceNotesEnabled: boolean;
}

/**
 * Get character v3 state
 */
export async function getCharacterV3(workspaceId: string): Promise<CharacterV3State | null> {
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId))
    .limit(1);

  if (!character) return null;

  const dbVoiceSettings = character.voiceSettings as Record<string, unknown> || {};

  const getVoiceSetting = <T>(key: string, snakeKey: string, defaultValue: T): T => {
    return (dbVoiceSettings[key] as T) ?? (dbVoiceSettings[snakeKey] as T) ?? defaultValue;
  };

  return {
    id: character.id,
    name: character.name,
    bio: character.bio ?? undefined,
    toneConfig: character.toneConfig as Record<string, unknown> || {},
    voiceId: character.voiceId ?? undefined,
    voiceSettings: {
      ...getDefaultVoiceSettings(),
      ...dbVoiceSettings,
      voiceId: character.voiceId || getVoiceSetting<string>("voiceId", "voiceId", getDefaultVoiceSettings().voiceId),
      stability: getVoiceSetting<number>("stability", "stability", getDefaultVoiceSettings().stability),
      similarityBoost: getVoiceSetting<number>("similarityBoost", "similarity_boost", getDefaultVoiceSettings().similarityBoost),
      style: getVoiceSetting<number | undefined>("style", "style", getDefaultVoiceSettings().style),
      useSpeakerBoost: getVoiceSetting<boolean>("useSpeakerBoost", "use_speaker_boost", getDefaultVoiceSettings().useSpeakerBoost),
    },
    dmReplyMode: character.dmReplyMode as "off" | "suggested" | "auto" || "suggested",
    dmReplySettings: {
      ...getDefaultDmReplySettings(),
      ...(character.dmReplySettings as CharacterDmReplySettings || {}),
    },
    voiceNotesEnabled: character.voiceNotesEnabled ?? false,
  };
}

/**
 * Update character v3 configuration
 */
export async function updateCharacterV3(workspaceId: string, config: CharacterV3Config): Promise<{ valid: boolean; errors: string[]; character?: CharacterV3State }> {
  const validation = validateCharacterV3Config(config);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors };
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  
  if (config.voiceId !== undefined) updateData.voiceId = config.voiceId;
  if (config.voiceSettings !== undefined) {
    const vs = config.voiceSettings;
    updateData.voiceSettings = {
      stability: vs.stability ?? getDefaultVoiceSettings().stability,
      similarity_boost: vs.similarityBoost ?? getDefaultVoiceSettings().similarityBoost,
      style: vs.style ?? getDefaultVoiceSettings().style,
      use_speaker_boost: vs.useSpeakerBoost ?? getDefaultVoiceSettings().useSpeakerBoost,
    };
  }
  if (config.dmReplyMode !== undefined) updateData.dmReplyMode = config.dmReplyMode;
  if (config.dmReplySettings !== undefined) updateData.dmReplySettings = { ...getDefaultDmReplySettings(), ...config.dmReplySettings };
  if (config.voiceNotesEnabled !== undefined) updateData.voiceNotesEnabled = config.voiceNotesEnabled;

  const [character] = await db
    .update(characters)
    .set(updateData)
    .where(eq(characters.workspaceId, workspaceId))
    .returning();

  if (!character) {
    return { valid: false, errors: ["Character not found"] };
  }

  const updated = await getCharacterV3(workspaceId);
  return { valid: true, errors: [], character: updated! };
}

/**
 * Generate voice note for character
 */
export async function generateVoiceNote(workspaceId: string, text: string): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
  const character = await getCharacterV3(workspaceId);
  if (!character) return { success: false, error: "Character not found" };
  if (!character.voiceNotesEnabled) return { success: false, error: "Voice notes not enabled" };

  const script = generateVoiceNoteScript(text, character.name);
  const voiceSettings = character.voiceSettings;

  try {
    const result = await synthesizeVoiceover(script, { 
      clonedVoiceId: voiceSettings.voiceId,
      // Note: preset voices don't support stability/similarity via API params in current implementation
    });

    if (!result) {
      return { success: false, error: "Voice synthesis failed - no API key or voice unavailable" };
    }

    // Save audio buffer (would need storage implementation)
    // For now, return success with base64 or storage path
    const audioBase64 = result.bytes.toString("base64");
    
    return { 
      success: true, 
      audioUrl: `data:audio/mpeg;base64,${audioBase64}`,
    };
  } catch (error) {
    console.error("Voice note generation error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Voice generation failed" };
  }
}

/**
 * Generate DM reply for incoming message
 */
export async function generateDmReplyForMessage(input: DmReplyRequest): Promise<{ success: boolean; reply?: string; linkIncluded?: boolean; error?: string }> {
  const { incomingMessage, characterId, productId, workspaceId, linkId } = input;

  const character = await getCharacterV3(workspaceId);
  if (!character) return { success: false, error: "Character not found" };
  if (character.dmReplyMode === "off") return { success: false, error: "DM replies disabled" };

  // Get product info if provided
  let productTitle: string | undefined;
  let linkUrl: string | undefined;

  if (productId) {
    // Fetch from products table
    const { products } = await import("@aa/db");
    const [product] = await db
      .select({ title: products.title })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.workspaceId, workspaceId)))
      .limit(1);
    productTitle = product?.title;
  }

  if (linkId) {
    // Get link URL - could be WhatsApp link or affiliate link
    // For now, placeholder
    linkId;
  }

  const replyResult = generateDmReply(incomingMessage, {
    name: character.name,
    bio: character.bio,
    toneConfig: character.toneConfig,
    dmReplySettings: character.dmReplySettings,
    guardrails: character.toneConfig.guardrails as Record<string, unknown>,
  }, {
    productId,
    productTitle,
    linkUrl,
    includeLink: character.dmReplySettings.includeLink,
  });

  // Log DM message if auto mode
  if (character.dmReplyMode === "auto") {
    await db.insert(dmMessages).values({
      workspaceId,
      characterId,
      platform: "dm",
      channel: "dm",
      recipientHandle: "unknown", // Would need actual sender
      triggerKeyword: incomingMessage.slice(0, 100),
      productId,
      body: replyResult.reply,
      status: "sent",
      sentAt: new Date(),
    });
  }

  return { success: true, reply: replyResult.reply, linkIncluded: replyResult.linkIncluded };
}

/**
 * Get ElevenLabs connection for workspace
 */
async function getElevenLabsConnection(workspaceId: string) {
  const [conn] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.provider, "elevenlabs")))
    .limit(1);
  return conn;
}

/**
 * Check if character can use voice features
 */
export async function canUseVoiceFeatures(workspaceId: string): Promise<{ canUse: boolean; reason?: string }> {
  const character = await getCharacterV3(workspaceId);
  if (!character) return { canUse: false, reason: "Character not found" };

  const conn = await getElevenLabsConnection(workspaceId);
  if (!conn?.apiKeyEnc) return { canUse: false, reason: "ElevenLabs API key not configured" };

  return { canUse: true };
}