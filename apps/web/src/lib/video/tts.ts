/**
 * Phase 4 S3 — ElevenLabs voiceover (ROADMAP P4: "ElevenLabs voiceover (preset voices)").
 * Uses the platform-pool ELEVENLABS_API_KEY when set; returns null otherwise so the
 * render pipeline can continue voiceover-less and record the skip honestly.
 * Preset voices: extend PRESET_VOICES with your own voice IDs from the ElevenLabs lab.
 */

export const PRESET_VOICES = {
  rachel: { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel — warm, conversational" },
  adam: { id: "pNInz6obpgDQGcFmaJgB", label: "Adam — deep, confident" },
  antoni: { id: "ErXwobaYiN019PkySvjV", label: "Antoni — bright, friendly" },
} as const;

export type PresetVoiceKey = keyof typeof PRESET_VOICES;

export const DEFAULT_VOICE: PresetVoiceKey = "rachel";

export interface VoiceoverResult {
  bytes: Buffer;
  voiceId: string;
  costUsd: number;
}

/** ~$0.30 / 1k characters (plan.md §18 reel voiceover ≈ $0.10–0.30). */
function estimateCost(chars: number): number {
  return Number(Math.min(0.3, (chars / 1000) * 0.3).toFixed(4));
}

/**
 * Synthesize narration for the whole reel. Returns null when no key is
 * configured (render continues without voiceover — logged as skipped).
 */
export async function synthesizeVoiceover(
  text: string,
  voice: PresetVoiceKey = DEFAULT_VOICE
): Promise<VoiceoverResult | null> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) return null;

  const voiceId = PRESET_VOICES[voice].id;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, voiceId, costUsd: estimateCost(text.length) };
}
