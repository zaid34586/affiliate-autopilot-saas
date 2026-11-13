/**
 * Pure provider-mode resolution: BYOK > platform pool > mock (dev only).
 * No I/O here — the async DB/env lookup lives in ./index.ts.
 */
import { ProviderNotConfiguredError } from "./types";

export type ProviderMode = "byok" | "platform_pool" | "mock";

export interface ProviderChoice {
  mode: ProviderMode;
  /** undefined for mock mode */
  apiKey?: string;
  providerId: "veo" | "mock";
}

export function chooseProvider(opts: {
  /** Workspace's own Gemini key (connections.provider = gemini_byok, active). */
  byokKey?: string | null;
  /** Our server-side platform-pool key. */
  platformKey?: string | null;
  /** True in dev, or when VIDEO_PROVIDER=mock (demo / no keys yet). */
  allowMock: boolean;
}): ProviderChoice {
  const byok = opts.byokKey?.trim();
  if (byok) return { mode: "byok", apiKey: byok, providerId: "veo" };

  const platform = opts.platformKey?.trim();
  if (platform) return { mode: "platform_pool", apiKey: platform, providerId: "veo" };

  if (opts.allowMock) return { mode: "mock", providerId: "mock" };

  throw new ProviderNotConfiguredError();
}
