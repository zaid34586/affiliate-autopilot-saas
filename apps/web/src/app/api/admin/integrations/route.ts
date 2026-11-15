/**
 * Phase 8 — Admin API: Integration Health
 * GET /api/admin/integrations - Health of external APIs (IG, TikTok, Veo, ElevenLabs, OpenAI, etc.)
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/admin-auth";
import { db } from "@/lib/db";
import { connections } from "@aa/db";
import { eq, and, sql, count } from "drizzle-orm";

// Provider health check endpoints (for actual probing)
const PROVIDER_HEALTH = {
  instagram: "https://graph.instagram.com/me?fields=id",
  tiktok: "https://open.tiktokapis.com/v2/user/info/",
  veo: "https://veo.googleapis.com/v1/operations",
  elevenlabs: "https://api.elevenlabs.io/v1/user",
  openai: "https://api.openai.com/v1/models",
  stripe: "https://api.stripe.com/v1/account",
  resend: "https://api.resend.com/domains",
} as const;

type Provider = keyof typeof PROVIDER_HEALTH;

async function checkProviderHealth(provider: Provider, apiKey?: string): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
  const url = PROVIDER_HEALTH[provider];
  const start = Date.now();
  
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      if (provider === "openai" || provider === "elevenlabs") {
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (provider === "stripe") {
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (provider === "resend") {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(url, { 
      method: provider === "stripe" ? "GET" : "GET",
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    const latency = Date.now() - start;
    
    return { 
      healthy: res.ok, 
      latencyMs: latency,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    return { 
      healthy: false, 
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const probe = searchParams.get("probe") === "true";

  // Get all configured connections grouped by provider
  const allConnections = await db
    .select({
      provider: connections.provider,
      workspaceId: connections.workspaceId,
      hasApiKey: sql<boolean>`${connections.apiKeyEnc} IS NOT NULL`,
      status: connections.status,
      lastUsed: connections.lastUsedAt,
      error: connections.lastError,
    })
    .from(connections)
    .orderBy(connections.provider, connections.workspaceId);

  // Group by provider
  const byProvider = allConnections.reduce((acc, c) => {
    if (!acc[c.provider]) acc[c.provider] = [];
    acc[c.provider].push(c);
    return acc;
  }, {} as Record<string, typeof allConnections>);

  const providerStats = Object.entries(byProvider).map(([provider, conns]) => ({
    provider,
    totalConnections: conns.length,
    activeConnections: conns.filter((c) => c.status === "active").length,
    workspacesConnected: new Set(conns.map((c) => c.workspaceId)).size,
    hasConfiguredKeys: conns.some((c) => c.hasApiKey),
  }));

  // If probe requested, actually test each provider
  let healthChecks: Record<string, { healthy: boolean; latencyMs: number; error?: string }> = {};
  
  if (probe) {
    const results = await Promise.all(
      Object.keys(PROVIDER_HEALTH).map(async (p) => {
        const result = await checkProviderHealth(p as Provider);
        return [p, result] as const;
      })
    );
    healthChecks = Object.fromEntries(results);
  }

  return NextResponse.json({
    providers: providerStats,
    healthChecks: probe ? healthChecks : undefined,
    timestamp: new Date().toISOString(),
  });
}