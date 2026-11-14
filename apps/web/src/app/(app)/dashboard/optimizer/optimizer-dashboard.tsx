"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp, Pause, Zap, FlaskConical, Play, Settings, X, Loader2, RotateCw, X as XIcon } from "lucide-react";

interface OptimizerConfig {
  enabled: boolean;
  mode: "conservative" | "balanced" | "aggressive";
  minCtrThreshold: number;
  minConversionRate: number;
  boostThreshold: number;
  pauseThreshold: number;
  lookbackDays: number;
  minPostsForDecision: number;
}

interface Decision {
  id: string;
  decisionType: "boost" | "pause" | "remix" | "ab_test";
  targetId: string;
  targetType: string;
  reason: string;
  confidence: number;
  metadata: Record<string, unknown>;
  executed: boolean;
  executedAt: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
}

interface DashboardData {
  config: OptimizerConfig;
  recentDecisions: Decision[];
  pendingDecisions: Decision[];
  stats: { totalPosts: number; boosted: number; paused: number; remixed: number; abTests: number };
}

const TYPE_CONFIG = {
  boost: { label: "Boost", color: "bg-green-500", icon: TrendingUp },
  pause: { label: "Pause", color: "bg-red-500", icon: Pause },
  remix: { label: "Remix", color: "bg-purple-500", icon: RotateCw },
  ab_test: { label: "A/B Test", color: "bg-amber-500", icon: FlaskConical },
};

const MODE_LABELS = {
  conservative: "Conservative (safe, fewer changes)",
  balanced: "Balanced (moderate)",
  aggressive: "Aggressive (auto-execute high confidence)",
};

function confidenceColor(c: number): string {
  if (c >= 80) return "bg-green-500";
  if (c >= 60) return "bg-amber-500";
  if (c >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function DecisionCard({
  decision,
  onExecute,
  executing,
}: {
  decision: Decision;
  onExecute: (id: string) => void;
  executing: string | null;
}) {
  const typeCfg = TYPE_CONFIG[decision.decisionType];
  const Icon = typeCfg.icon;

  return (
    <div className="rounded-xl border border-ink-3 bg-ink p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${typeCfg.color}/10`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`label rounded px-2 py-0.5 ${typeCfg.color}/20 text-xs`}>
                {typeCfg.label}
              </span>
              <span className={`label rounded-full ${confidenceColor(decision.confidence)}/20 px-2 py-0.5 text-xs`}>
                {decision.confidence}%
              </span>
              <span className="text-xs text-bone-3">{decision.targetType}: {decision.targetId.slice(0, 8)}</span>
              <span className={`label rounded px-2 py-0.5 ${decision.executed ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"}`}>
                {decision.executed ? "Executed" : "Pending"}
              </span>
            </div>
            <p className="mt-1 text-sm text-bone-2">{decision.reason}</p>
            {decision.executed && decision.result && Object.keys(decision.result).length > 0 && (
              <p className="mt-1 text-xs text-bone-3 font-mono">Result: {JSON.stringify(decision.result)}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-bone-3">{"\u23F0 " + formatRelativeTime(decision.createdAt)}</span>
          {!decision.executed && decision.decisionType !== "ab_test" && (
            <button
              onClick={() => onExecute(decision.id)}
              disabled={executing === decision.id}
              className="btn-signal text-xs"
            >
              Execute
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfigModal({
  isOpen,
  onClose,
  config,
  onSave,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  config: OptimizerConfig | null;
  onSave: (cfg: OptimizerConfig) => void;
  saving: boolean;
}) {
  if (!isOpen || !config) return null;

  const MODE_LABELS_LOCAL: Record<string, string> = {
    conservative: "Conservative — safe, fewer changes, manual approval",
    balanced: "Balanced — moderate, some auto-execution",
    aggressive: "Aggressive — auto-execute high confidence",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="panel w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-ink-3">
          <h2 className="text-lg font-semibold">Optimizer Configuration</h2>
          <button onClick={onClose} className="btn-ghost">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="label text-bone-3">Enabled</label>
            <label className="flex items-center gap-2 mt-1.5">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => onSave({ ...config, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-ink-4 text-signal focus:ring-signal"
              />
              <span className="text-sm text-bone-2">Enable auto-optimizer</span>
            </label>
          </div>
          <div>
            <label className="label text-bone-3">Mode</label>
            <select
              value={config.mode}
              onChange={(e) => onSave({ ...config, mode: e.target.value as "conservative" | "balanced" | "aggressive" })}
              className="field mt-1.5"
            >
              <option value="conservative">Conservative — safe, fewer changes, manual approval</option>
              <option value="balanced">Balanced — moderate, some auto-execution</option>
              <option value="aggressive">Aggressive — auto-execute high confidence</option>
            </select>
            <p className="mt-1 text-xs text-bone-3">{MODE_LABELS_LOCAL[config.mode]}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label text-bone-3">Min CTR Threshold</label>
              <input
                type="number"
                step="0.001"
                min="0"
                max="0.1"
                value={config.minCtrThreshold}
                onChange={(e) => onSave({ ...config, minCtrThreshold: parseFloat(e.target.value) })}
                className="field mt-1.5"
              />
            </div>
            <div>
              <label className="label text-bone-3">Min Conversion Rate</label>
              <input
                type="number"
                step="0.001"
                min="0"
                max="0.1"
                value={config.minConversionRate}
                onChange={(e) => onSave({ ...config, minConversionRate: parseFloat(e.target.value) })}
                className="field mt-1.5"
              />
            </div>
            <div>
              <label className="label text-bone-3">Boost Threshold</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={config.boostThreshold}
                onChange={(e) => onSave({ ...config, boostThreshold: parseFloat(e.target.value) })}
                className="field mt-1.5"
              />
            </div>
            <div>
              <label className="label text-bone-3">Pause Threshold</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={config.pauseThreshold}
                onChange={(e) => onSave({ ...config, pauseThreshold: parseFloat(e.target.value) })}
                className="field mt-1.5"
              />
            </div>
            <div>
              <label className="label text-bone-3">Lookback Days</label>
              <input
                type="number"
                min="1"
                max="30"
                value={config.lookbackDays}
                onChange={(e) => onSave({ ...config, lookbackDays: parseInt(e.target.value) })}
                className="field mt-1.5"
              />
            </div>
            <div>
              <label className="label text-bone-3">Min Posts for Decision</label>
              <input
                type="number"
                min="1"
                max="50"
                value={config.minPostsForDecision}
                onChange={(e) => onSave({ ...config, minPostsForDecision: parseInt(e.target.value) })}
                className="field mt-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-ink-3">
            <button onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button onClick={() => onSave(config)} disabled={saving} className="btn-signal">
              <span className="flex items-center gap-1">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgColor}`}>
          <span className="text-xl">{icon}</span>
        </div>
        <div>
          <p className="text-2xl font-semibold text-bone">{value}</p>
          <p className="text-xs text-bone-3">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function OptimizerDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [formConfig, setFormConfig] = useState<OptimizerConfig | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/optimizer");
      if (res.ok) {
        const data = await res.json();
        setDashboard(data.dashboard);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      await load();
    }
    void init();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const saveConfig = async () => {
    if (!formConfig) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/optimizer/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formConfig),
      });
      if (!res.ok) throw new Error("Failed to save");
      setToast({ msg: "Config saved", type: "success" });
      setShowConfig(false);
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to save", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const executeDecision = async (id: string) => {
    setExecuting(id);
    try {
      const res = await fetch(`/api/dashboard/optimizer/decisions/${id}/execute`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to execute");
      setToast({ msg: "Decision executed", type: "success" });
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Execution failed", type: "error" });
    } finally {
      setExecuting(null);
    }
  };

  const openConfig = () => {
    if (dashboard) {
      setFormConfig({ ...dashboard.config });
      setShowConfig(true);
    }
  };

  if (loading) {
    return (
      <div className="panel flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 text-signal animate-spin" />
      </div>
    );
  }

  if (!dashboard) return null;

  const { config, recentDecisions, pendingDecisions, stats } = dashboard;
  const decisionCards = recentDecisions.map((d) => (
    <DecisionCard
      key={d.id}
      decision={d}
      onExecute={executeDecision}
      executing={executing}
    />
  ));

  const MODE_LABELS_LOCAL: Record<string, string> = {
    conservative: "Conservative — safe, fewer changes, manual approval",
    balanced: "Balanced — moderate, some auto-execution",
    aggressive: "Aggressive — auto-execute high confidence",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Zap className="h-6 w-6 text-signal" />
            Auto-Optimizer
          </h1>
          <p className="text-sm text-bone-3">24/7 post analysis \u2192 auto boost/pause/remix/A/B test</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openConfig} className="btn-signal flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Config
          </button>
          <button onClick={() => void load()} className="btn-ghost">
            <Loader2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon="📈" label="Boosted" value={stats.boosted} color="text-green-500" bgColor="bg-green-500/10" />
        <StatCard icon="⏸️" label="Paused" value={stats.paused} color="text-red-500" bgColor="bg-red-500/10" />
        <StatCard icon="🔄" label="Remixed" value={stats.remixed} color="text-purple-500" bgColor="bg-purple-500/10" />
        <StatCard icon="🧪" label="A/B Tests" value={stats.abTests} color="text-amber-500" bgColor="bg-amber-500/10" />
        <StatCard icon="⚡" label="Total Posts" value={stats.totalPosts} color="text-signal" bgColor="bg-signal/10" />
      </div>

      {/* Config Modal */}
      <ConfigModal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        config={config}
        onSave={setFormConfig}
        saving={saving}
      />

      {/* Pending Decisions */}
      {pendingDecisions.length > 0 && (
        <div className="panel mt-6">
          <div className="flex items-center justify-between border-b border-ink-3 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="text-amber">⚠️</span>
              Pending Decisions ({pendingDecisions.length})
            </h2>
          </div>
          <div className="space-y-3 px-5 py-4">
            {pendingDecisions.map((d) => (
              <DecisionCard
                key={d.id}
                decision={d}
                onExecute={executeDecision}
                executing={executing}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Decisions */}
      <div className="panel mt-6">
        <div className="flex items-center justify-between border-b border-ink-3 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Zap className="h-4 w-4 text-signal" />
            Recent Decisions
          </h2>
        </div>
        <div className="max-h-[400px] space-y-3 overflow-y-auto px-5 py-4">
          {recentDecisions.length === 0 ? (
            <p className="py-8 text-center text-sm text-bone-3">No decisions yet — run the optimizer or wait for the cron</p>
          ) : (
            <div>{decisionCards}</div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg ${
              toast.type === "success"
                ? "border border-signal/40 bg-signal/10 text-signal"
                : "border border-danger/40 bg-danger/10 text-danger"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

