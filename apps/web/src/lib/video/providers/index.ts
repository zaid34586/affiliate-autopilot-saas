/**
 * VideoProvider resolution with I/O: DB lookup for the workspace BYOK key +
 * platform-pool key from env. Pure decision logic lives in ./resolve.ts.
 */
import { db } from "@/lib/db";
import { connections } from "@aa/db";
import { and, eq } from "drizzle-orm";
import { MockProvider } from "./mock";
import { chooseProvider, type ProviderChoice } from "./resolve";
import { VeoProvider } from "./veo";
import type { VideoProvider } from "./types";

const veoSingleton = new VeoProvider();

/** Mock is allowed in dev, or explicitly in prod via VIDEO_PROVIDER=mock. */
export function isMockAllowed(): boolean {
  if (process.env.VIDEO_PROVIDER === "mock") return true;
  return process.env.NODE_ENV !== "production";
}

/** Resolve BYOK > platform pool > mock for a workspace. */
export async function resolveProviderChoice(workspaceId: string): Promise<ProviderChoice> {
  const rows = await db
    .select({ apiKey: connections.apiKeyEnc })
    .from(connections)
    .where(
      and(
        eq(connections.workspaceId, workspaceId),
        eq(connections.provider, "gemini_byok"),
        eq(connections.status, "active")
      )
    )
    .limit(1);

  return chooseProvider({
    byokKey: rows[0]?.apiKey ?? null,
    platformKey: process.env.GEMINI_API_KEY ?? null,
    allowMock: isMockAllowed(),
  });
}

export async function getVideoProvider(
  workspaceId: string
): Promise<{ provider: VideoProvider; choice: ProviderChoice }> {
  const choice = await resolveProviderChoice(workspaceId);
  const provider: VideoProvider = choice.providerId === "mock" ? new MockProvider() : veoSingleton;
  return { provider, choice };
}
