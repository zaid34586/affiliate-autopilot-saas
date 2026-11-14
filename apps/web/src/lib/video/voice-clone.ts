/**
 * Phase 6 — Voice Clone (ElevenLabs).
 * 
 * Voice cloning workflow:
 * 1. User uploads 30-60s clean audio sample
 * 2. Send to ElevenLabs "add voice" API
 * 3. Store returned voice_id in brand_profiles.cloned_voice_id
 * 4. Use cloned voice_id for TTS instead of preset voices
 */

export interface VoiceCloneResult {
  success: boolean;
  voiceId?: string;
  error?: string;
}

/**
 * Create a custom voice on ElevenLabs from audio sample
 */
export async function createClonedVoice(
  apiKey: string,
  name: string,
  audioBuffer: Buffer,
  description?: string,
): Promise<VoiceCloneResult> {
  try {
    // Convert buffer to base64 for multipart/form-data
    const base64Audio = audioBuffer.toString("base64");
    
    // Create form data
    const formData = new FormData();
    formData.append("name", name);
    if (description) formData.append("description", description);
    
    // Create a blob from base64
    const byteCharacters = atob(base64Audio);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "audio/mpeg" });
    formData.append("files", blob, "sample.mp3");

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { success: false, error: `ElevenLabs voice clone failed (HTTP ${res.status}): ${body.slice(0, 500)}` };
    }

    const data = await res.json();
    return { success: true, voiceId: data.voice_id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Voice clone failed" };
  }
}

/**
 * Delete a custom voice from ElevenLabs
 */
export async function deleteClonedVoice(apiKey: string, voiceId: string): Promise<VoiceCloneResult> {
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: "DELETE",
      headers: { "xi-api-key": apiKey },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { success: false, error: `Delete voice failed (HTTP ${res.status}): ${body.slice(0, 300)}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Delete voice failed" };
  }
}

/**
 * Get voice details from ElevenLabs
 */
export async function getVoiceDetails(apiKey: string, voiceId: string) {
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      headers: { "xi-api-key": apiKey },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * List all voices (including custom) from ElevenLabs
 */
export async function listVoices(apiKey: string) {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.voices || [];
  } catch {
    return [];
  }
}

/**
 * Synthesize voiceover using cloned voice
 */
export async function synthesizeWithClonedVoice(
  text: string,
  apiKey: string,
  voiceId: string,
): Promise<{ bytes: Buffer; costUsd: number } | null> {
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "content-type": "application/json" },
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
    const costUsd = Number(Math.min(0.3, (text.length / 1000) * 0.3).toFixed(4));
    return { bytes, costUsd };
  } catch (error) {
    console.error("Cloned voice TTS error:", error);
    return null;
  }
}