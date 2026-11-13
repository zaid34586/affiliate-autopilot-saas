/**
 * Phase 4 S3 — Render artifact storage.
 * v1: local filesystem (RENDER_DIR, default apps/web/.renders — gitignored).
 * R2/S3 upload swaps in here once CLOUDFLARE R2 keys are provided —
 * every caller only sees storage keys, so the backend swap is one file.
 */
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";

export const RENDER_ROOT = process.env.RENDER_DIR
  ? path.resolve(process.env.RENDER_DIR)
  : path.join(process.cwd(), ".renders");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveWithinRoot(relKey: string): string {
  const full = path.resolve(RENDER_ROOT, relKey);
  const rootWithSep = RENDER_ROOT.endsWith(path.sep) ? RENDER_ROOT : RENDER_ROOT + path.sep;
  if (!full.startsWith(rootWithSep)) {
    throw new Error(`Storage key escapes render root: ${relKey}`);
  }
  return full;
}

/** `${videoId}/...` keys are only valid with a real UUID segment. */
export function assertSafeStorageKey(relKey: string): void {
  const [first] = relKey.split(/[\\/]/);
  if (!UUID_RE.test(first)) {
    throw new Error(`Invalid storage key: ${relKey}`);
  }
  resolveWithinRoot(relKey);
}

export async function saveBuffer(relKey: string, data: Buffer | Uint8Array): Promise<string> {
  const full = resolveWithinRoot(relKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return relKey;
}

export async function readArtifact(relKey: string): Promise<Buffer> {
  const full = resolveWithinRoot(relKey);
  return readFile(full);
}

export async function artifactExists(relKey: string): Promise<boolean> {
  try {
    const s = await stat(resolveWithinRoot(relKey));
    return s.isFile();
  } catch {
    return false;
  }
}

/** Absolute path for FFmpeg (local backend only — FFmpeg needs real paths). */
export function absolutePath(relKey: string): string {
  return resolveWithinRoot(relKey);
}

export function joinKey(...parts: string[]): string {
  return parts.join("/");
}
