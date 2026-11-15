/**
 * Phase 7 — Status Page DB Orchestration.
 *
 * Integration health checks (with probe), status derivation,
 * incident lifecycle, public status page payload.
 */

import { db } from "@/lib/db";
import { integrationHealth, statusChecks, statusIncidents } from "@aa/db";
import { eq, and, desc, asc, sql, gte, inArray, count } from "drizzle-orm";
import {
  STATUS_PROVIDERS,
  deriveStatus,
  computeUptime,
  rollingUptime,
  overallStatus,
  isValidIncidentTransition,
  IntegrationStatus,
  OverallStatus,
  ProviderDef,
} from "./status-core";

// ───────────────────────── HEALTH CHECKS ─────────────────────────

export interface ProbeResult {
  provider: string;
  ok: boolean;
  latencyMs: number;
  statusCode: number | null;
  message: string;
}

/**
 * Probe a single provider endpoint (HEAD/GET with short timeout).
 * Providers without checkUrl are treated as unknown → ok (no external probe).
 */
export async function probeProvider(def: ProviderDef, timeoutMs = 5000): Promise<ProbeResult> {
  if (!def.checkUrl) {
    return { provider: def.provider, ok: true, latencyMs: 0, statusCode: null, message: "no probe endpoint" };
  }

  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(def.checkUrl, { method: "HEAD", signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    const latencyMs = Date.now() - started;
    const ok = res.status < 500; // 4xx = endpoint alive but maybe auth-required; 5xx = down
    return {
      provider: def.provider,
      ok,
      latencyMs,
      statusCode: res.status,
      message: ok ? `HTTP ${res.status}` : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      provider: def.provider,
      ok: false,
      latencyMs: Date.now() - started,
      statusCode: null,
      message: err instanceof Error ? err.message.slice(0, 200) : "probe failed",
    };
  }
}

/** Run all provider probes + persist check results + update health rows. */
export async function runHealthChecks(): Promise<ProbeResult[]> {
  const results = await Promise.all(STATUS_PROVIDERS.map((p) => probeProvider(p)));
  const now = new Date();

  for (const r of results) {
    // Record check
    await db.insert(statusChecks).values({
      provider: r.provider,
      ok: r.ok,
      latencyMs: r.latencyMs,
      statusCode: r.statusCode,
      message: r.message,
      checkedAt: now,
    });

    // Recent checks (last 10) for status derivation
    const recent = await db
      .select({ ok: statusChecks.ok })
      .from(statusChecks)
      .where(eq(statusChecks.provider, r.provider))
      .orderBy(desc(statusChecks.checkedAt))
      .limit(10);
    const recentOks = recent.map((c) => c.ok);

    // Rolling uptime counters
    const [prev] = await db
      .select({ ok: integrationHealth.ok30d, total: integrationHealth.checks30d })
      .from(integrationHealth)
      .where(eq(integrationHealth.provider, r.provider))
      .limit(1);

    const roll = rollingUptime(prev?.ok || 0, prev?.total || 0, r.ok);
    const status = deriveStatus(recentOks, roll.uptime);

    // Avg latency: rolling average of last 20 checks
    const recentChecks = await db
      .select({ latencyMs: statusChecks.latencyMs })
      .from(statusChecks)
      .where(eq(statusChecks.provider, r.provider))
      .orderBy(desc(statusChecks.checkedAt))
      .limit(20);
    const latValues = recentChecks.map((c) => c.latencyMs).filter((v): v is number => v != null);
    const avgLatency = latValues.length
      ? Math.round(latValues.reduce((a, b) => a + b, 0) / latValues.length)
      : 0;

    await db
      .insert(integrationHealth)
      .values({
        provider: r.provider,
        displayName: STATUS_PROVIDERS.find((p) => p.provider === r.provider)?.displayName || r.provider,
        category: STATUS_PROVIDERS.find((p) => p.provider === r.provider)?.category || "integration",
        status,
        uptime30d: String(roll.uptime),
        avgLatencyMs: avgLatency,
        lastCheckedAt: now,
        checks30d: roll.total,
        ok30d: roll.ok,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [integrationHealth.provider],
        set: {
          status,
          uptime30d: String(roll.uptime),
          avgLatencyMs: avgLatency,
          lastCheckedAt: now,
          checks30d: roll.total,
          ok30d: roll.ok,
          updatedAt: now,
        },
      });

    // Auto-incident: if provider just went down, open incident (or auto-resolve)
    await syncIncidentForProvider(r.provider, status, r.message);
  }

  return results;
}

/** Auto open/close incidents based on status transitions. */
async function syncIncidentForProvider(provider: string, status: IntegrationStatus, message: string) {
  const openIncident = await db
    .select()
    .from(statusIncidents)
    .where(and(eq(statusIncidents.provider, provider), sql`${statusIncidents.resolvedAt} IS NULL`))
    .orderBy(desc(statusIncidents.startedAt))
    .limit(1);

  if ((status === "down" || status === "degraded") && openIncident.length === 0) {
    // Open new incident
    await db.insert(statusIncidents).values({
      provider,
      title: `${provider} ${status === "down" ? "outage" : "degradation"}`,
      description: message,
      severity: status === "down" ? "major" : "minor",
      status: "investigating",
      updates: [{ at: new Date().toISOString(), status: "investigating", message }],
    });

    await db
      .update(integrationHealth)
      .set({ lastIncidentAt: new Date(), incidentMessage: message, updatedAt: new Date() })
      .where(eq(integrationHealth.provider, provider));
  } else if (status === "operational" && openIncident.length > 0) {
    // Resolve open incident
    const inc = openIncident[0];
    const updates = Array.isArray(inc.updates) ? inc.updates : [];
    updates.push({ at: new Date().toISOString(), status: "resolved", message: "Automatically resolved: checks passing" });

    await db
      .update(statusIncidents)
      .set({ status: "resolved", resolvedAt: new Date(), updates, updatedAt: new Date() })
      .where(eq(statusIncidents.id, inc.id));

    await db
      .update(integrationHealth)
      .set({ incidentMessage: null, updatedAt: new Date() })
      .where(eq(integrationHealth.provider, provider));
  }
}

// ───────────────────────── STATUS PAGE PAYLOAD ─────────────────────────

export async function getStatusPage() {
  const health = await db.select().from(integrationHealth).orderBy(asc(integrationHealth.displayName));

  const openIncidents = await db
    .select()
    .from(statusIncidents)
    .where(sql`${statusIncidents.resolvedAt} IS NULL`)
    .orderBy(desc(statusIncidents.startedAt))
    .limit(20);

  const recentIncidents = await db
    .select()
    .from(statusIncidents)
    .orderBy(desc(statusIncidents.startedAt))
    .limit(10);

  const statuses = health.map((h) => h.status as IntegrationStatus);
  const overall: OverallStatus = overallStatus(statuses);

  return {
    overall,
    integrations: health.map((h) => ({
      provider: h.provider,
      displayName: h.displayName,
      category: h.category,
      status: h.status,
      uptime30d: Number(h.uptime30d),
      avgLatencyMs: h.avgLatencyMs,
      lastCheckedAt: h.lastCheckedAt,
      incidentMessage: h.incidentMessage,
    })),
    openIncidents,
    recentIncidents,
  };
}

// ───────────────────────── INCIDENTS ─────────────────────────

export async function createIncident(input: {
  provider: string;
  title: string;
  description?: string;
  severity?: "minor" | "major" | "critical";
}) {
  const [inc] = await db
    .insert(statusIncidents)
    .values({
      provider: input.provider,
      title: input.title,
      description: input.description,
      severity: input.severity || "minor",
      status: "investigating",
      updates: [{ at: new Date().toISOString(), status: "investigating", message: input.description || "Incident opened" }],
    })
    .returning();

  return inc;
}

export async function updateIncident(
  id: string,
  input: { status?: string; message?: string },
) {
  const [existing] = await db.select().from(statusIncidents).where(eq(statusIncidents.id, id)).limit(1);
  if (!existing) return null;

  const updates = Array.isArray(existing.updates) ? [...existing.updates] : [];
  const newStatus = (input.status as any) || existing.status;

  if (input.status && input.status !== existing.status) {
    if (!isValidIncidentTransition(existing.status as any, input.status as any)) {
      throw new Error(`Invalid transition: ${existing.status} → ${input.status}`);
    }
  }

  if (input.message || input.status) {
    updates.push({
      at: new Date().toISOString(),
      status: newStatus,
      message: input.message || `Status changed to ${newStatus}`,
    });
  }

  const [updated] = await db
    .update(statusIncidents)
    .set({
      status: newStatus,
      resolvedAt: newStatus === "resolved" ? new Date() : null,
      updates,
      updatedAt: new Date(),
    })
    .where(eq(statusIncidents.id, id))
    .returning();

  return updated;
}

export async function listIncidents(options: { open?: boolean; limit?: number } = {}) {
  const { open, limit = 20 } = options;
  const conditions = open ? [sql`${statusIncidents.resolvedAt} IS NULL`] : [];
  return db
    .select()
    .from(statusIncidents)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(statusIncidents.startedAt))
    .limit(limit);
}
