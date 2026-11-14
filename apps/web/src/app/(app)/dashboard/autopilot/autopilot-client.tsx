"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";

type JobStatus = "running" | "success" | "failed";
type AutopilotLevel = "manual" | "semi" | "full" | "fire_and_forget";
type Tab = "config" | "jobs" | "circuit-breakers" | "notifications";

interface JobRow {
  id: string;
  jobType: string;
  status: JobStatus;
  startedAt: string;
  finishedAt: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  costUsd: string | null;
}

interface AutopilotConfig {
  level: AutopilotLevel;
  dailyPostLimits: Record<string, number>;
  activePlatforms: string[];
  quietHours: { from: string; to: string };
  paused: boolean;
  circuitBreakers: {
    maxErrorsPerHour: number;
    maxRetries: number;
    pauseOnRateLimit: boolean;
  };
}

interface CircuitBreakerState {
  platform: string;
  errorsLastHour: number;
  isOpen: boolean;
  lastError?: string;
  lastErrorAt?: string;
}

interface Notification {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

const LEVEL_LABELS: Record<AutopilotLevel, { label: string; desc: string; icon: React.ReactNode }> = {
  manual: { label: "Manual", desc: "You approve every action", icon: <ShieldCheck className="h-4 w-4" /> },
  semi: { label: "Semi-Auto", desc: "AI suggests, you approve", icon: <SlidersHorizontal className="h-4 w-4" /> },
  full: { label: "Full Auto", desc: "AI runs everything within limits", icon: <Play className="h-4 w-4" /> },
  fire_and_forget: { label: "Fire & Forget", desc: "Maximum autonomy (use with caution)", icon: <ShieldAlert className="h-4 w-4" /> },
};

const STATUS_LABELS: Record<JobStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  running: { label: "Running", cls: "border-signal/40 bg-signal/10 text-signal", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  success: { label: "Success", cls: "border-signal/40 bg-signal/10 text-signal", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  failed: { label: "Failed", cls: "border-danger/40 bg-danger/10 text-danger", icon: <AlertCircle className="h-3.5 w-3.5" /> },
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Shield className="h-4 w-4" />,
  youtube: <Play className="h-4 w-4" />,
  tiktok: <Shield className="h-4 w-4" />,
  facebook: <Shield className="h-4 w-4" />,
  x: <Shield className="h-4 w-4" />,
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDuration(started: string, finished: string | null): string {
  const start = new Date(started).getTime();
  const end = finished ? new Date(finished).getTime() : Date.now();
  const ms = end - start;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function toastMsg(msg: string, type: "success" | "error" = "success") {
  console.log(`${type}: ${msg}`);
}

// ──────────────────────────────────────────────
// ConfigTab Component
// ──────────────────────────────────────────────
function ConfigTab({ config, onConfigChange }: { config: AutopilotConfig; onConfigChange: (c: AutopilotConfig) => void }) {
  const { level, dailyPostLimits, activePlatforms, quietHours, paused, circuitBreakers } = config;

  const handleLevelChange = (newLevel: AutopilotLevel) => {
    onConfigChange({ ...config, level: newLevel });
  };

  const handlePauseToggle = () => {
    onConfigChange({ ...config, paused: !paused });
  };

  const handlePlatformToggle = (platform: string) => {
    const active = activePlatforms.includes(platform);
    onConfigChange({
      ...config,
      activePlatforms: active
        ? activePlatforms.filter((p) => p !== platform)
        : [...activePlatforms, platform],
    });
  };

  const handleDailyLimitChange = (platform: string, value: string) => {
    const num = Math.max(0, parseInt(value) || 0);
    onConfigChange({
      ...config,
      dailyPostLimits: { ...dailyPostLimits, [platform]: num },
    });
  };

  const handleQuietHoursChange = (field: "from" | "to", value: string) => {
    onConfigChange({ ...config, quietHours: { ...quietHours, [field]: value } });
  };

  const handleCircuitBreakerChange = (field: keyof typeof circuitBreakers, value: number | boolean) => {
    onConfigChange({
      ...config,
      circuitBreakers: { ...circuitBreakers, [field]: value },
    });
  };

  return (
    <div className="space-y-6">
      {/* Level Selector */}
      <div className="panel p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          {LEVEL_LABELS[level].icon} Autopilot Level
        </h3>
        <p className="mt-1 text-xs text-bone-3">{LEVEL_LABELS[level].desc}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(["manual", "semi", "full", "fire_and_forget"] as AutopilotLevel[]).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => handleLevelChange(lvl)}
              className={`relative rounded-lg border p-4 text-left transition-all ${
                level === lvl ? "border-signal bg-signal/10" : "border-ink-3 hover:border-bone-3"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {LEVEL_LABELS[lvl].icon}
                <span className="font-medium">{LEVEL_LABELS[lvl].label}</span>
              </div>
              <p className="text-xs text-bone-3">{LEVEL_LABELS[lvl].desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Pause/Resume */}
      <div className="panel p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              {paused ? <Pause className="h-4 w-4 text-amber" /> : <Play className="h-4 w-4 text-signal" />}
              {paused ? "Autopilot Paused" : "Autopilot Active"}
            </h3>
            <p className="mt-1 text-xs text-bone-3">
              {paused
                ? "No scheduled jobs will run. Manual triggers still work."
                : "Daily cycle runs at 04:00 UTC. Publish cron runs every 30 min."}
            </p>
          </div>
          <button type="button" className={`btn-ghost px-4 py-2 ${paused ? "text-signal" : "text-amber"}`} onClick={handlePauseToggle}>
            {paused ? (<> <Play className="h-4 w-4 mr-2" /> Resume </>) : (<> <Pause className="h-4 w-4 mr-2" /> Pause </>)}
          </button>
        </div>
      </div>

      {/* Daily Post Limits */}
      <div className="panel p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Shield className="h-4 w-4 text-signal" /> Daily Post Limits (per platform)
        </h3>
        <p className="mt-1 text-xs text-bone-3">Limits enforced by publish cron. 0 = disabled.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {["instagram", "youtube", "tiktok", "facebook", "x"].map((platform) => (
            <div key={platform} className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-full">
                {PLATFORM_ICONS[platform] || <Shield className="h-4 w-4" />}
                <label className="text-sm font-medium capitalize">{platform}</label>
              </div>
              <input
                type="number"
                min="0"
                max="50"
                className="field w-20 text-center"
                value={dailyPostLimits[platform] ?? 0}
                onChange={(e) => handleDailyLimitChange(platform, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Active Platforms */}
      <div className="panel p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Shield className="h-4 w-4 text-signal" /> Active Platforms
        </h3>
        <p className="mt-1 text-xs text-bone-3">Only active platforms will be used for publishing.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {["instagram", "youtube", "tiktok", "facebook", "x"].map((platform) => {
            const active = activePlatforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                onClick={() => handlePlatformToggle(platform)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  active ? "border-signal bg-signal/10 text-signal" : "border-ink-3 text-bone-3 hover:border-bone-3"
                }`}
              >
                {PLATFORM_ICONS[platform] || <Shield className="h-4 w-4" />}
                <span className="font-medium capitalize">{platform}</span>
                {active && <CheckCircle2 className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="panel p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Clock className="h-4 w-4 text-signal" /> Quiet Hours (UTC)
        </h3>
        <p className="mt-1 text-xs text-bone-3">No posts will be published during this window.</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-bone-3">From</label>
            <input type="time" className="field w-24" value={quietHours.from} onChange={(e) => handleQuietHoursChange("from", e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-bone-3">To</label>
            <input type="time" className="field w-24" value={quietHours.to} onChange={(e) => handleQuietHoursChange("to", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Circuit Breaker Config */}
      <div className="panel p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <ShieldAlert className="h-4 w-4 text-amber" /> Circuit Breaker Settings
        </h3>
        <p className="mt-1 text-xs text-bone-3">Auto-pause publishing when error rates spike.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label text-bone-3">Max Errors / Hour</label>
            <input type="number" min="1" max="100" className="field mt-1" value={circuitBreakers.maxErrorsPerHour} onChange={(e) => handleCircuitBreakerChange("maxErrorsPerHour", parseInt(e.target.value) || 10)} />
          </div>
          <div>
            <label className="label text-bone-3">Max Retries</label>
            <input type="number" min="1" max="10" className="field mt-1" value={circuitBreakers.maxRetries} onChange={(e) => handleCircuitBreakerChange("maxRetries", parseInt(e.target.value) || 3)} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded border-ink-4 text-signal" checked={circuitBreakers.pauseOnRateLimit} onChange={(e) => handleCircuitBreakerChange("pauseOnRateLimit", e.target.checked)} />
              <span className="text-sm text-bone-3">Pause on rate limit</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// JobsTab Component
// ──────────────────────────────────────────────
function JobsTab({ jobs, onRefresh }: { jobs: JobRow[]; onRefresh: () => void }) {
  const [filterStatus, setFilterStatus] = useState<JobStatus | "all">("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const jobTypes = ["research", "ai_scoring", "script", "video", "publish", "analytics", "optimizer", "report", "dm_triggers"];

  const filteredJobs = jobs.filter((j) => {
    if (filterStatus !== "all" && j.status !== filterStatus) return false;
    if (filterType !== "all" && j.jobType !== filterType) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Job history</h2>
        <div className="flex items-center gap-2">
          <select className="field text-xs" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as JobStatus | "all")}>
            <option value="all">All statuses</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <select className="field text-xs" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All types</option>
            {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="grid-dots flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-4 px-6 py-12 text-center">
          <Clock className="h-7 w-7 text-bone-3" />
          <p className="mt-3 text-sm font-medium text-bone-2">No jobs yet</p>
          <p className="mt-1 max-w-sm text-xs text-bone-3">The scheduler runs daily at 04:00 UTC. Jobs will appear here as they run.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-ink-3 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-3 bg-ink">
                <th className="p-3 text-left font-medium text-bone-3">Job</th>
                <th className="p-3 text-left font-medium text-bone-3">Status</th>
                <th className="p-3 text-left font-medium text-bone-3">Run ID</th>
                <th className="p-3 text-left font-medium text-bone-3">Duration</th>
                <th className="p-3 text-left font-medium text-bone-3">Started</th>
                <th className="p-3 text-left font-medium text-bone-3">Cost</th>
                <th className="p-3 text-right font-medium text-bone-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((j) => {
                const s = STATUS_LABELS[j.status];
                return (
                  <tr key={j.id} className="border-b border-ink-3 hover:bg-ink/50">
                    <td className="p-3 font-medium text-bone">{j.jobType}</td>
                    <td className="p-3">
                      <span className={`label rounded px-2 py-1 ${s.cls} flex items-center gap-1.5`}>
                        {s.icon} {s.label}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-bone-3">{j.input && typeof j.input.runId === "string" ? j.input.runId : "—"}</td>
                    <td className="p-3 text-bone-2">{formatDuration(j.startedAt, j.finishedAt)}</td>
                    <td className="p-3 text-bone-2">{timeAgo(j.startedAt)}</td>
                    <td className="p-3 font-mono text-bone-2">{j.costUsd ? `$${Number(j.costUsd).toFixed(4)}` : "—"}</td>
                    <td className="p-3 text-right">
                      <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setToast({ msg: `Error: ${j.error ?? "none"} | Output: ${JSON.stringify(j.output).slice(0, 100)}`, type: j.status === "failed" ? "error" : "success" })}>
                        {j.error ? <AlertCircle className="h-3.5 w-3.5 text-danger" /> : <X className="h-3.5 w-3.5" />} {j.error ? "View error" : "View output"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && <div className="fixed bottom-6 right-6 z-50 animate-slide-up"><div className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg ${toast.type === "success" ? "border border-signal/40 bg-signal/10 text-signal" : "border border-danger/40 bg-danger/10 text-danger"}`}>{toast.msg}</div></div>}
    </div>
  );
}

// ──────────────────────────────────────────────
// CircuitBreakersTab Component
// ──────────────────────────────────────────────
function CircuitBreakersTab({ circuitBreakers, config }: { circuitBreakers: CircuitBreakerState[]; config: AutopilotConfig | null }) {
  if (circuitBreakers.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight"><ShieldAlert className="h-4 w-4 text-amber" /> Circuit Breaker Status</h2>
        <p className="text-xs text-bone-3">Real-time error tracking per platform. Auto-pauses when threshold exceeded.</p>
        <div className="grid-dots flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-4 px-6 py-12 text-center">
          <ShieldCheck className="h-7 w-7 text-signal" />
          <p className="mt-3 text-sm font-medium text-bone-2">All circuits healthy</p>
          <p className="mt-1 max-w-sm text-xs text-bone-3">No platforms have exceeded error thresholds in the last hour.</p>
        </div>
        <div className="panel p-4">
          <button type="button" className="btn-ghost w-full px-4 py-2 text-amber" onClick={() => alert("Reset all not yet implemented")}><ShieldOff className="h-4 w-4 mr-2" /> Reset All Circuits</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight"><ShieldAlert className="h-4 w-4 text-amber" /> Circuit Breaker Status</h2>
      <p className="text-xs text-bone-3">Real-time error tracking per platform. Auto-pauses when threshold exceeded.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {circuitBreakers.map((cb) => (
          <div key={cb.platform} className={`panel p-4 ${cb.isOpen ? "border-danger/40 bg-danger/10" : "border-signal/40 bg-signal/10"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">{PLATFORM_ICONS[cb.platform] || <Shield className="h-5 w-5" />}<span className="font-medium capitalize">{cb.platform}</span></div>
              <span className={`label rounded px-2 py-1 ${cb.isOpen ? "bg-danger/20 text-danger" : "bg-signal/20 text-signal"}`}>{cb.isOpen ? "OPEN (paused)" : "CLOSED (healthy)"}</span>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-bone-3">
              <div className="flex justify-between"><span>Errors (last hour)</span><span className="font-mono">{cb.errorsLastHour} / {config?.circuitBreakers.maxErrorsPerHour ?? 10}</span></div>
              <div className="flex justify-between"><span>Progress</span><div className="w-32 h-1.5 bg-ink-4 rounded-full overflow-hidden"><div className={`h-full transition-all ${cb.isOpen ? "bg-danger" : "bg-signal"}`} style={{ width: `${Math.min(100, (cb.errorsLastHour / (config?.circuitBreakers.maxErrorsPerHour ?? 10)) * 100)}%` }} /></div></div>
              {cb.lastError && <div className="flex justify-between text-danger"><span>Last error</span><span className="font-mono truncate max-w-[120px]">{cb.lastError}</span></div>}
              {cb.lastErrorAt && <div className="flex justify-between"><span>At</span><span>{timeAgo(cb.lastErrorAt)}</span></div>}
            </div>
            {cb.isOpen && <button type="button" className="btn-ghost w-full mt-3 px-3 py-1.5 text-xs" onClick={() => alert("Manual reset not yet implemented")}><ShieldOff className="h-3.5 w-3.5 mr-1" /> Reset Circuit</button>}
          </div>
        ))}
      </div>
      <div className="panel p-4"><button type="button" className="btn-ghost w-full px-4 py-2 text-amber" onClick={() => alert("Reset all not yet implemented")}><ShieldOff className="h-4 w-4 mr-2" /> Reset All Circuits</button></div>
    </div>
  );
}

// ──────────────────────────────────────────────
// NotificationsTab Component
// ──────────────────────────────────────────────
function NotificationsTab({ notifications }: { notifications: Notification[] }) {
  if (notifications.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold tracking-tight">Notifications</h2><button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => alert("Mark all read not yet implemented")}>Mark all read</button></div>
        <div className="grid-dots flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-4 px-6 py-12 text-center"><Bell className="h-7 w-7 text-bone-3" /><p className="mt-3 text-sm font-medium text-bone-2">No notifications</p><p className="mt-1 max-w-sm text-xs text-bone-3">Job completions, errors, and alerts will appear here.</p></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h2 className="text-sm font-semibold tracking-tight">Notifications</h2><button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => alert("Mark all read not yet implemented")}>Mark all read</button></div>
      <div className="space-y-3">
        {notifications.map((n) => (
          <div key={n.id} className={`panel p-4 ${!n.read ? "border-signal/40 bg-signal/10" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${n.type === "error" ? "bg-danger/20 text-danger" : n.type === "warning" ? "bg-amber/20 text-amber" : n.type === "success" ? "bg-signal/20 text-signal" : "bg-ink/50 text-bone-3"}`}>{n.type === "error" && <AlertCircle className="h-4 w-4" />}{n.type === "warning" && <ShieldAlert className="h-4 w-4" />}{n.type === "success" && <CheckCircle2 className="h-4 w-4" />}{n.type === "info" && <Bell className="h-4 w-4" />}</span>
                <div><h4 className="font-medium text-bone">{n.title}</h4><p className="text-xs text-bone-3 mt-0.5">{n.message}</p><p className="text-xs text-bone-3 mt-1">{timeAgo(n.createdAt)}</p></div>
              </div>
              {!n.read && <button type="button" className="btn-ghost px-2 py-1 text-xs shrink-0" onClick={() => alert("Mark read not yet implemented")}>Mark read</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main AutopilotClient
// ──────────────────────────────────────────────
export function AutopilotClient() {
  const [activeTab, setActiveTab] = useState<Tab>("config");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [config, setConfig] = useState<AutopilotConfig | null>(null);
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerState[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const activeRef = useRef(false);

  const fetchAll = useCallback(async () => {
    try {
      const [jobsRes, configRes, cbRes, notifRes] = await Promise.all([
        fetch("/api/dashboard/autopilot/jobs"),
        fetch("/api/dashboard/autopilot"),
        fetch("/api/dashboard/autopilot/circuit-breakers"),
        fetch("/api/dashboard/autopilot/notifications"),
      ]);
      const [jobsData, configData, cbData, notifData] = await Promise.all([jobsRes.json(), configRes.json(), cbRes.json(), notifRes.json()]);
      setJobs(jobsData.jobs ?? []);
      setConfig(configData.config ?? null);
      setCircuitBreakers(cbData.breakers ?? []);
      setNotifications(notifData.notifications ?? []);
      activeRef.current = (jobsData.jobs ?? []).some((j: JobRow) => j.status === "running");
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const load = async () => { await fetchAll(); };
    void load();
    const id = setInterval(() => { if (activeRef.current) void fetchAll(); }, 3000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const handleConfigChange = useCallback(async (newConfig: AutopilotConfig) => {
    setConfig(newConfig);
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/autopilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newConfig) });
      if (!res.ok) throw new Error("Failed to save");
      toastMsg("Configuration saved", "success");
    } catch (e) { toastMsg((e as Error).message, "error"); } finally { setSaving(false); }
  }, []);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-ink rounded-lg p-1">
        {[
          { id: "config", label: "Configuration", icon: SlidersHorizontal },
          { id: "jobs", label: "Job History", icon: Clock },
          { id: "circuit-breakers", label: "Circuit Breakers", icon: Shield },
          { id: "notifications", label: "Notifications", icon: Bell },
        ].map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as Tab)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-signal text-ink" : "text-bone-3 hover:text-bone hover:bg-ink/50"}`}><tab.icon className="h-4 w-4" />{tab.label}</button>
        ))}
      </div>

      {activeTab === "config" && config && <ConfigTab config={config} onConfigChange={handleConfigChange} />}
      {activeTab === "jobs" && <JobsTab jobs={jobs} onRefresh={fetchAll} />}
      {activeTab === "circuit-breakers" && <CircuitBreakersTab circuitBreakers={circuitBreakers} config={config} />}
      {activeTab === "notifications" && <NotificationsTab notifications={notifications} />}

      {loading && <div className="grid-dots flex items-center justify-center py-12"><Loader2 className="h-7 w-7 text-bone-3 animate-spin" /></div>}
    </div>
  );
}