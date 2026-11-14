"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  Music,
  Hash,
  Play,
  Check,
  X,
  Zap,
  Eye,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

interface RemixSuggestion {
  id: string;
  viralPostId: string | null;
  trendingHashtagId: string | null;
  trendingAudioId: string | null;
  productId: string | null;
  suggestedFormat: "remix" | "reaction" | "tutorial" | "showcase";
  hookIdea: string;
  scriptOutline: string | null;
  confidence: number;
  status: "pending" | "approved" | "rejected" | "created";
  createdAt: string;
  viralPost?: {
    platform: string;
    authorHandle: string;
    views: number;
    hashtags: string[];
    caption: string | null;
  };
  product?: {
    title: string;
  };
}

interface TrendData {
  suggestions: RemixSuggestion[];
  all: RemixSuggestion[];
}

const FORMAT_COLORS: Record<string, string> = {
  remix: "bg-purple-500/10 text-purple-500",
  reaction: "bg-blue-500/10 text-blue-500",
  tutorial: "bg-green-500/10 text-green-500",
  showcase: "bg-amber-500/10 text-amber-500",
};

const FORMAT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  remix: Zap,
  reaction: Eye,
  tutorial: Play,
  showcase: TrendingUp,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Pending", color: "bg-amber-500", icon: AlertTriangle },
  approved: { label: "Approved", color: "bg-green-500", icon: Check },
  rejected: { label: "Rejected", color: "bg-danger", icon: X },
  created: { label: "Video Created", color: "bg-signal", icon: Check },
};

function formatRelativeTime(dateStr: string) {
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

function confidenceColor(c: number) {
  if (c >= 80) return "bg-green-500";
  if (c >= 60) return "bg-amber-500";
  if (c >= 40) return "bg-orange-500";
  return "bg-danger";
}

export function TrendMiner() {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/trend-miner");
      if (res.ok) {
        const json = await res.json();
        setData(json);
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

  async function runAnalysis() {
    setRunning(true);
    try {
      const res = await fetch("/api/dashboard/trend-miner", { method: "POST" });
      if (!res.ok) throw new Error("Failed to run analysis");
      setToast({ msg: "Trend analysis complete", type: "success" });
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Analysis failed", type: "error" });
    } finally {
      setRunning(false);
    }
  }

  async function act(id: string, action: "approve" | "reject" | "create") {
    try {
      const res = await fetch(`/api/dashboard/trend-miner/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Action failed");
      setToast({ msg: `Suggestion ${action}d`, type: "success" });
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Action failed", type: "error" });
    }
  }

  if (loading) {
    return (
      <div className="panel flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 text-signal animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel text-center py-8">
        <p className="text-bone-2">No trend data yet</p>
        <p className="text-xs text-bone-3 mt-1">Run trend analysis to discover viral opportunities</p>
      </div>
    );
  }

  const { suggestions, all } = data;
  const pending = suggestions.filter((s) => s.status === "pending");
  const approved = all.filter((s) => s.status === "approved");
  const created = all.filter((s) => s.status === "created");

  return (
    <div className="panel mt-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-3 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <TrendingUp className="h-4 w-4 text-signal" />
            Trend Miner
          </h2>
          <p className="text-xs text-bone-3 mt-0.5">Viral trends → remix suggestions → your content</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAnalysis}
            disabled={running}
            className="btn-signal flex items-center gap-2 px-3 py-1.5 text-xs"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {running ? "Analyzing..." : "Run Trend Analysis"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 px-5 py-4 border-b border-ink-3">
        <div className="panel p-4">
          <p className="label text-bone-3">Pending Review</p>
          <p className="text-2xl font-semibold text-amber">{pending.length}</p>
        </div>
        <div className="panel p-4">
          <p className="label text-bone-3">Approved</p>
          <p className="text-2xl font-semibold text-green-500">{approved.length}</p>
        </div>
        <div className="panel p-4">
          <p className="label text-bone-3">Videos Created</p>
          <p className="text-2xl font-semibold text-signal">{created.length}</p>
        </div>
        <div className="panel p-4">
          <p className="label text-bone-3">Total Suggestions</p>
          <p className="text-2xl font-semibold text-bone">{all.length}</p>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="max-h-[500px] space-y-3 overflow-y-auto px-5 py-4">
        {pending.length === 0 && all.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-bone-2">No suggestions yet</p>
            <p className="mt-1 text-xs text-bone-3">Hit "Run Trend Analysis" to discover viral remix opportunities</p>
            <button onClick={runAnalysis} disabled={running} className="btn-signal mt-4">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run Analysis"}
            </button>
          </div>
        ) : (
          all.map((s) => {
            const Icon = FORMAT_ICONS[s.suggestedFormat] || Zap;
            const statusCfg = STATUS_CONFIG[s.status];
            const StatusIcon = statusCfg.icon;
            const formatColor = FORMAT_COLORS[s.suggestedFormat];

            return (
              <div key={s.id} className="rounded-xl border border-ink-3 bg-ink p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${formatColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`label rounded px-2 py-0.5 ${formatColor}`}>
                          {s.suggestedFormat}
                        </span>
                        <span className={`label rounded px-2 py-0.5 ${statusCfg.color} text-white flex items-center gap-1`}>
                          <StatusIcon className="h-2.5 w-2.5" />
                          {statusCfg.label}
                        </span>
                        <span className="text-xs text-bone-3">Confidence: {s.confidence}%</span>
                      </div>
                      <p className="mt-1 font-medium text-bone truncate">{s.hookIdea}</p>
                      <p className="mt-1 text-sm text-bone-2 line-clamp-2">{s.scriptOutline}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-bone-3">
                        {s.viralPost && (
                          <>
                            <span className="flex items-center gap-1">
                              <ExternalLink className="h-2.5 w-2.5" />
                              @{s.viralPost.authorHandle} · {s.viralPost.views.toLocaleString()} views
                            </span>
                            <span className="flex items-center gap-1">
                              <Hash className="h-2.5 w-2.5" />
                              {s.viralPost.hashtags.slice(0, 3).join(", ")}
                            </span>
                          </>
                        )}
                        {s.product && <span className="text-signal">Product: {s.product.title}</span>}
                        <span>{formatRelativeTime(s.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {s.status === "pending" && (
                      <>
                        <button
                          onClick={() => void act(s.id, "approve")}
                          className="btn-signal text-xs flex items-center gap-1"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => void act(s.id, "reject")}
                          className="btn-ghost text-xs text-danger flex items-center gap-1"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </>
                    )}
                    {s.status === "approved" && (
                      <button
                        onClick={() => void act(s.id, "create")}
                        className="btn-signal text-xs flex items-center gap-1"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Create Video
                      </button>
                    )}
                    {s.status === "created" && (
                      <span className="label rounded border border-signal/40 bg-signal/10 px-2 py-0.5 text-signal">
                        Video enqueued
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
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