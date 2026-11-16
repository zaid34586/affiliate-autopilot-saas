import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptToken,
  decryptToken,
  isEncryptedFormat,
} from "./secrets";

// 32 bytes, base64
const KEY = Buffer.alloc(32, 7).toString("base64");

describe("AES-256-GCM token encryption", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("round-trips a token", async () => {
    const token = "ya29.a0AfH6SMB-secret-token/with+special=chars";
    const enc = await encryptToken(token);
    expect(enc).not.toBe(token);
    expect(await decryptToken(enc)).toBe(token);
  });

  it("produces a different ciphertext each time (random IV)", async () => {
    const a = await encryptToken("same-token");
    const b = await encryptToken("same-token");
    expect(a).not.toBe(b);
    expect(await decryptToken(a)).toBe("same-token");
    expect(await decryptToken(b)).toBe("same-token");
  });

  it("detects tampering (GCM auth tag) and does not return garbage", async () => {
    const enc = await encryptToken("sensitive");
    const raw = Buffer.from(enc, "base64");
    raw[raw.length - 1] ^= 0xff; // flip a ciphertext byte
    const tampered = raw.toString("base64");
    // Tamper detection: decryption fails and the ORIGINAL value comes back
    // (legacy fallback), never a partially-decrypted string.
    const out = await decryptToken(tampered);
    expect(out).toBe(tampered);
    expect(out).not.toBe("sensitive");
  });

  it("reads legacy un-encrypted values gracefully", async () => {
    // Legacy rows stored raw tokens (may or may not be valid base64).
    expect(await decryptToken("legacy-raw-token")).toBe("legacy-raw-token");
    expect(await decryptToken("")).toBe("");
    // A short base64 string that decodes under our minimum length:
    expect(await decryptToken(Buffer.from("abc").toString("base64"))).toBe(
      Buffer.from("abc").toString("base64")
    );
  });

  it("isEncryptedFormat distinguishes formats", async () => {
    expect(isEncryptedFormat(await encryptToken("x"))).toBe(true);
    expect(isEncryptedFormat("plain-token")).toBe(false);
    expect(isEncryptedFormat("")).toBe(false);
  });

  it("fails loudly when the key is missing or malformed", async () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    await expect(encryptToken("x")).rejects.toThrow(/TOKEN_ENCRYPTION_KEY/);

    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
    await expect(encryptToken("x")).rejects.toThrow(/32 bytes/);
  });
});
