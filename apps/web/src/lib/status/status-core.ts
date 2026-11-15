/**
 * Phase 7 — Status Page Core (pure logic).
 *
 * Integration health: status derivation, uptime calc, incident lifecycle,
 * overall page status.
 */

// ───────────────────────── TYPES ─────────────────────────

export type IntegrationStatus = "operational" | "degraded" | "down" | "maintenance" | "unknown";
export type IncidentSeverity = "minor" | "major" | "critical";
export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

export interface IntegrationHealth {
  provider: string;
  displayName: string;
  category: string;
  status: IntegrationStatus;
  uptime30d: number;
  avgLatencyMs: number | null;
  lastCheckedAt: Date | null;
  lastIncidentAt: Date | null;
  incidentMessage: string | null;
  checks30d: number;
  ok30d: number;
}

export interface StatusIncident {
  id: string;
  provider: string;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: Date;
  resolvedAt: Date | null;
  updates: Array<{ at: string; status: string; message: string }>;
}

// ───────────────────────── HEALTH PROVIDERS ─────────────────────────

export interface ProviderDef {
  provider: string;
  displayName: string;
  category: "integration" | "ai" | "payment" | "platform";
  /** Relative URL or endpoint to probe (health check) */
  checkUrl?: string;
}

/** Providers monitored by the status page. */
export const STATUS_PROVIDERS: ProviderDef[] = [
  { provider: "instagram", displayName: "Instagram API", category: "integration", checkUrl: "https://graph.instagram.com/" },
  { provider: "tiktok", displayName: "TikTok API", category: "integration", checkUrl: "https://open.tiktokapis.com/" },
  { provider: "youtube", displayName: "YouTube API", category: "integration", checkUrl: "https://www.googleapis.com/youtube/v3/" },
  { provider: "veo", displayName: "Google Veo (Video)", category: "ai" },
  { provider: "openai", displayName: "OpenAI (GPT)", category: "ai", checkUrl: "https://api.openai.com/v1/models" },
  { provider: "gemini", displayName: "Google Gemini", category: "ai" },
  { provider: "stripe", displayName: "Stripe Payments", category: "payment", checkUrl: "https://api.stripe.com/v1/health" },
  { provider: "razorpay", displayName: "Razorpay Payments", category: "payment", checkUrl: "https://api.razorpay.com/v1/" },
];

// ───────────────────────── STATUS DERIVATION ─────────────────────────

/**
 * Derive integration status from recent check results.
 * - any failure in last 5 checks → degraded
 * - all failing → down
 * - uptime < 99% over window → degraded
 */
export function deriveStatus(recentOks: boolean[], uptime30d: number): IntegrationStatus {
  if (recentOks.length === 0) return "unknown";

  const failures = recentOks.filter((ok) => !ok).length;

  if (failures === recentOks.length) return "down";
  if (failures > 0 || uptime30d < 99) return "degraded";
  return "operational";
}

/** Uptime % from check counts (rounded to 2dp). */
export function computeUptime(okChecks: number, totalChecks: number): number {
  if (totalChecks <= 0) return 100;
  return Math.round((okChecks / totalChecks) * 10000) / 100;
}

/**
 * Rolling uptime: previous 30d uptime merged with a new check.
 * Keeps a weighted average using the check counters.
 */
export function rollingUptime(prevOk: number, prevTotal: number, newOk: boolean): { ok: number; total: number; uptime: number } {
  const ok = prevOk + (newOk ? 1 : 0);
  const total = prevTotal + 1;
  return { ok, total, uptime: computeUptime(ok, total) };
}

// ───────────────────────── OVERALL PAGE STATUS ─────────────────────────

export type OverallStatus = "operational" | "degraded" | "outage" | "maintenance";

/**
 * Overall status page banner:
 * - any down → outage
 * - any degraded → degraded
 * - all maintenance → maintenance
 * - else operational
 */
export function overallStatus(statuses: IntegrationStatus[]): OverallStatus {
  if (statuses.length === 0) return "operational";
  if (statuses.includes("down")) return "outage";
  if (statuses.includes("degraded")) return "degraded";
  if (statuses.every((s) => s === "maintenance")) return "maintenance";
  return "operational";
}

// ───────────────────────── INCIDENTS ─────────────────────────

export function isValidIncidentTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  const allowed: Record<IncidentStatus, IncidentStatus[]> = {
    investigating: ["identified", "monitoring", "resolved"],
    identified: ["monitoring", "resolved"],
    monitoring: ["investigating", "resolved"],
    resolved: ["investigating"], // reopen
  };
  return allowed[from].includes(to);
}

export function incidentDurationMs(incident: Pick<StatusIncident, "startedAt" | "resolvedAt">): number {
  const end = incident.resolvedAt ?? new Date();
  return Math.max(0, end.getTime() - incident.startedAt.getTime());
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** Severity rank for sorting (critical first). */
export function severityRank(s: IncidentSeverity): number {
  return s === "critical" ? 0 : s === "major" ? 1 : 2;
}

// ───────────────────────── LATENCY ─────────────────────────

/**
 * Classify latency: <300ms good, <1000ms fair, else slow.
 */
export function classifyLatency(ms: number | null): "good" | "fair" | "slow" | "unknown" {
  if (ms == null) return "unknown";
  if (ms < 300) return "good";
  if (ms < 1000) return "fair";
  return "slow";
}
