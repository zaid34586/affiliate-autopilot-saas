/**
 * Phase 6 — Character v3 Core (pure logic).
 * 
 * Character v3 features:
 * - Voice notes (TTS in character voice)
 * - Full-personality DM replies
 * - Voice settings management
 * - DM reply automation
 */

export interface CharacterVoiceSettings {
  voiceId: string; // ElevenLabs voice ID
  stability: number; // 0-1
  similarityBoost: number; // 0-1
  style?: number; // 0-1 (style exaggeration)
  useSpeakerBoost: boolean;
}

export interface CharacterDmReplySettings {
  maxLength: number; // max characters
  includeLink: boolean; // include tracked link
  tone: string; // friendly, professional, casual, enthusiastic
  language: string; // en, hi, hinglish
}

export interface CharacterV3Config {
  voiceId?: string;
  voiceSettings?: Partial<CharacterVoiceSettings>;
  dmReplyMode?: "off" | "suggested" | "auto";
  dmReplySettings?: Partial<CharacterDmReplySettings>;
  voiceNotesEnabled?: boolean;
}

export interface VoiceNoteRequest {
  text: string;
  characterId: string;
  format?: "mp3" | "wav";
}

export interface DmReplyRequest {
  incomingMessage: string;
  characterId: string;
  productId?: string;
  workspaceId: string;
  linkId?: string; // WhatsApp/affiliate link to include
}

/**
 * Get default voice settings for a character
 */
export function getDefaultVoiceSettings(): CharacterVoiceSettings {
  return {
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel (ElevenLabs default)
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    useSpeakerBoost: true,
  };
}

/**
 * Get default DM reply settings
 */
export function getDefaultDmReplySettings(): CharacterDmReplySettings {
  return {
    maxLength: 500,
    includeLink: true,
    tone: "friendly",
    language: "en",
  };
}

/**
 * Build character personality prompt for TTS/DM replies
 */
export function buildCharacterPrompt(
  character: {
    name: string;
    bio?: string;
    toneConfig?: Record<string, unknown>;
    voiceSettings?: CharacterVoiceSettings;
  },
  purpose: "voice_note" | "dm_reply"
): string {
  const tone = character.toneConfig as Record<string, unknown> || {};
  const traits = tone.traits as string[] || ["friendly", "helpful"];
  const style = tone.style as string || "conversational";
  const vocabulary = tone.vocabulary as string[] || [];

  const purposeContext = purpose === "voice_note"
    ? "You are recording a voice note for your audience. Speak naturally, warmly, and authentically."
    : "You are replying to a direct message from a follower. Be helpful, personal, and engaging.";

  return `${purposeContext}

CHARACTER PROFILE:
- Name: ${character.name}
- Bio: ${character.bio || "Not set"}
- Traits: ${traits.join(", ")}
- Style: ${style}
- Vocabulary preferences: ${vocabulary.join(", ") || "Natural, accessible language"}

VOICE SETTINGS:
- Voice ID: ${character.voiceSettings?.voiceId || "default"}
- Stability: ${character.voiceSettings?.stability ?? 0.5}
- Similarity Boost: ${character.voiceSettings?.similarityBoost ?? 0.75}
- Style: ${character.voiceSettings?.style ?? 0}

GUARDRAILS:
- Never promise specific earnings or guaranteed results
- Never share personal/private information
- Never make medical, legal, or financial advice claims
- Always disclose affiliate relationships when sharing links
- Keep responses under 500 characters for DMs
- Use the character's established tone and vocabulary`;
}

/**
 * Generate voice note script from text (adds natural speech markers)
 */
export function generateVoiceNoteScript(text: string, characterName: string): string {
  // Add natural pauses and emphasis
  let script = text
    .replace(/\.\s+/g, ". <break time='500ms'/> ")
    .replace(/\?\s+/g, "? <break time='300ms'/> ")
    .replace(/!\s+/g, "! <break time='300ms'/> ")
    .replace(/,/g, ", <break time='200ms'/> ");

  // Add greeting if not present
  if (!script.toLowerCase().startsWith("hey") && !script.toLowerCase().startsWith("hi") && !script.toLowerCase().startsWith("hello")) {
    script = `Hey there! <break time='300ms'/> ${script}`;
  }

  // Add sign-off if not present
  if (!script.toLowerCase().includes("talk soon") && !script.toLowerCase().includes("see you") && !script.toLowerCase().includes("bye")) {
    script = `${script} <break time='500ms'/> Talk soon! 👋`;
  }

  return script;
}

/**
 * Generate DM reply with character personality
 */
export function generateDmReply(
  incomingMessage: string,
  character: {
    name: string;
    bio?: string;
    toneConfig?: Record<string, unknown>;
    dmReplySettings?: CharacterDmReplySettings;
    guardrails?: Record<string, unknown>;
  },
  options: {
    productId?: string;
    productTitle?: string;
    linkUrl?: string;
    includeLink: boolean;
  }
): { reply: string; linkIncluded: boolean } {
  const settings = character.dmReplySettings || getDefaultDmReplySettings();
  const tone = settings.tone;
  const maxLength = settings.maxLength;
  const language = settings.language;

  // Analyze incoming message intent
  const lowerMsg = incomingMessage.toLowerCase();
  const isQuestion = lowerMsg.includes("?") || lowerMsg.startsWith("how") || lowerMsg.startsWith("what") || lowerMsg.startsWith("why") || lowerMsg.startsWith("where") || lowerMsg.startsWith("when");
  const isPriceQuery = lowerMsg.includes("price") || lowerMsg.includes("cost") || lowerMsg.includes("kitna") || lowerMsg.includes("rate");
  const isLinkRequest = lowerMsg.includes("link") || lowerMsg.includes("buy") || lowerMsg.includes("purchase") || lowerMsg.includes("where");
  const isComplaint = lowerMsg.includes("problem") || lowerMsg.includes("issue") || lowerMsg.includes("broken") || lowerMsg.includes("not working");

  let reply = "";

  // Build reply based on intent and tone
  const greetings = {
    friendly: ["Hey! ", "Hi there! ", "Hey! ", "Hello! "],
    professional: ["Hello. ", "Hi. ", "Good day. "],
    casual: ["Yo! ", "Hey! ", "What's up! "],
    enthusiastic: ["Hey!! ", "Hi there!! ", "Hello!! "],
  };

  const greeting = greetings[tone as keyof typeof greetings]?.[0] || greetings.friendly[0];
  reply += greeting;

  if (isQuestion) {
    const responses = {
      friendly: ["Great question! ", "Love that you asked! ", "Happy to help! "],
      professional: ["Certainly. ", "I'd be happy to clarify. ", "Let me address that. "],
      casual: ["Good one! ", "So, ", "Here's the deal: "],
      enthusiastic: ["Ooh, great question!! ", "Love this!! ", "So excited you asked!! "],
    };
    reply += responses[tone as keyof typeof responses]?.[0] || responses.friendly[0];
  }

  if (isPriceQuery) {
    // Guardrail: never quote specific prices
    reply += "I don't have exact pricing since it can vary, but I can send you the link to check current prices and any deals! ";
  } else if (isLinkRequest && options.includeLink && options.linkUrl) {
    reply += `Here's the link you're looking for: ${options.linkUrl} `;
  } else if (isComplaint) {
    reply += "Sorry to hear that! Let me see how I can help. ";
  } else {
    // General response
    const generalResponses = {
      friendly: ["Thanks for reaching out! ", "Appreciate your message! ", "So good to hear from you! "],
      professional: ["Thank you for your message. ", "I appreciate you reaching out. "],
      casual: ["Thanks for the msg! ", "Appreciate it! "],
      enthusiastic: ["Thank you so much!! ", "Love hearing from you!! "],
    };
    reply += generalResponses[tone as keyof typeof generalResponses]?.[0] || generalResponses.friendly[0];
  }

  // Add product context if relevant
  if (options.productTitle) {
    reply += `Regarding ${options.productTitle}, `;
  }

  // Add CTA based on tone
  const ctas = {
    friendly: ["Let me know if you need anything else! 😊", "Happy to help further! 🙌", "Just shout if you need more! 👋"],
    professional: ["Please let me know if you require further assistance.", "I'm here to help with any other questions.", "Don't hesitate to reach out if needed."],
    casual: ["LMK if you need anything else!", "Hit me up anytime!", "Around if you need me!"],
    enthusiastic: ["Let me know if you need ANYTHING else!! 🎉", "So happy to help!! 🌟", "Here for whatever you need!! ✨"],
  };
  reply += " " + ctas[tone as keyof typeof ctas]?.[0] || ctas.friendly[0];

  // Include link if requested and available
  let linkIncluded = false;
  if (options.includeLink && options.linkUrl) {
    if (reply.length + options.linkUrl.length + 2 < maxLength) {
      reply += ` ${options.linkUrl}`;
      linkIncluded = true;
    }
  }

  // Truncate if too long
  if (reply.length > maxLength) {
    reply = reply.substring(0, maxLength - 3) + "...";
  }

  return { reply: reply.trim(), linkIncluded };
}

/**
 * Validate character v3 config
 */
export function validateCharacterV3Config(config: CharacterV3Config): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.voiceSettings) {
    if (config.voiceSettings.stability !== undefined && (config.voiceSettings.stability < 0 || config.voiceSettings.stability > 1)) {
      errors.push("Voice stability must be between 0 and 1");
    }
    if (config.voiceSettings.similarityBoost !== undefined && (config.voiceSettings.similarityBoost < 0 || config.voiceSettings.similarityBoost > 1)) {
      errors.push("Voice similarity boost must be between 0 and 1");
    }
    if (config.voiceSettings.style !== undefined && (config.voiceSettings.style < 0 || config.voiceSettings.style > 1)) {
      errors.push("Voice style must be between 0 and 1");
    }
  }

  if (config.dmReplySettings) {
    if (config.dmReplySettings.maxLength !== undefined && config.dmReplySettings.maxLength < 50) {
      errors.push("DM max length must be at least 50 characters");
    }
    if (config.dmReplySettings.maxLength !== undefined && config.dmReplySettings.maxLength > 2000) {
      errors.push("DM max length must be at most 2000 characters");
    }
  }

  if (config.dmReplyMode && !["off", "suggested", "auto"].includes(config.dmReplyMode)) {
    errors.push("DM reply mode must be 'off', 'suggested', or 'auto'");
  }

  return { valid: errors.length === 0, errors };
}