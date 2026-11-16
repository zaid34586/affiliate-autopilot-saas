/**
 * Token Encryption - AES-256-GCM for storing OAuth tokens securely.
 * Uses TOKEN_ENCRYPTION_KEY from environment (32 bytes base64).
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 32; // 256 bits

function getEncryptionKey(): Uint8Array {
  const keyB64 = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyB64) {
    throw new Error("TOKEN_ENCRYPTION_KEY environment variable is required (32 bytes base64)");
  }
  const key = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (key.length !== KEY_LENGTH) {
    throw new Error(`TOKEN_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (base64 encoded), got ${key.length}`);
  }
  return key;
}

async function getCryptoKey(key: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", key.buffer as ArrayBuffer, { name: ALGORITHM }, false, ["encrypt", "decrypt"]);
}

export async function encryptToken(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;

  const key = getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cryptoKey = await getCryptoKey(key);
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    cryptoKey,
    encoded
  );

  const encryptedArray = new Uint8Array(encrypted);
  // Format: iv + ciphertext + tag (all concatenated)
  const result = new Uint8Array(12 + encryptedArray.length);
  result.set(iv);
  result.set(encryptedArray, 12);

  return btoa(String.fromCharCode(...result));
}

export async function decryptToken(ciphertextB64: string): Promise<string> {
  if (!ciphertextB64) return ciphertextB64;

  // Check if it's already in our encrypted format (base64, minimum length)
  try {
    const decoded = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
    if (decoded.length < 12 + 16 + 1) {
      // Too short to be our format, likely legacy unencrypted token
      return ciphertextB64;
    }
  } catch {
    // Not valid base64, return as-is
    return ciphertextB64;
  }

  const key = getEncryptionKey();
  const decoded = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
  const iv = decoded.slice(0, 12);
  const encrypted = decoded.slice(12);

  try {
    const cryptoKey = await crypto.subtle.importKey("raw", key.buffer as ArrayBuffer, { name: ALGORITHM }, false, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      cryptoKey,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    // Decryption failed - could be legacy token or tampered data
    // Return original for backward compatibility
    return ciphertextB64;
  }
}

export function isEncryptedFormat(value: string): boolean {
  if (!value) return false;
  try {
    const decoded = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    return decoded.length >= 12 + 16 + 1;
  } catch {
    return false;
  }
}