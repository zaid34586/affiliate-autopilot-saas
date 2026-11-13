"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

type JobStatus = "running" | "success" | "failed";

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

const STATUS_LABELS: Record<JobStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  running: {
    label: "Running",
    cls: "border-signal/40 bg-signal/10 text-signal",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  success: {
    label: "Success",
    cls: "border-signal/40 bg-signal/10 text-signal",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  failed: {
    label: "Failed",
    cls: "border-danger/40 bg-danger/10 text-danger",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
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

export function AutopilotClient() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<JobStatus | "all">("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const activeRef = useRef(false);

  const jobTypes = [
    "research",
    "script",
    "video",
    "publish",
    "analytics",
    "optimizer",
    "report",
    "dm_triggers",
  ];

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/autopilot/jobs");
      if (!res.ok) return;
      const data = await res.json();
      const list: JobRow[] = data.jobs ?? [];
      setJobs(list);
      activeRef.current = list.some((j) => j.status === "running");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchJobs();
    };
    void load();
    const id = setInterval(() => {
      if (activeRef.current) void fetchJobs();
    }, 3000);
    return () => clearInterval(id);
  }, [fetchJobs]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const filteredJobs = jobs.filter((j) => {
    if (filterStatus !== "all" && j.status !== filterStatus) return false;
    if (filterType !== "all" && j.jobType !== filterType) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Job history</h2>
        <div className="flex items-center gap-2">
          <select
            className="field text-xs"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as JobStatus | "all")}
          >
            <option value="all">All statuses</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <select
            className="field text-xs"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All types</option>
            {jobTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={fetchJobs}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid-dots flex items-center justify-center py-12">
          <Loader2 className="h-7 w-7 text-bone-3 animate-spin" />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="grid-dots flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-4 px-6 py-12 text-center">
          <Clock className="h-7 w-7 text-bone-3" />
          <p className="mt-3 text-sm font-medium text-bone-2">No jobs yet</p>
          <p className="mt-1 max-w-sm text-xs text-bone-3">
            The scheduler runs daily at 04:00 UTC. Jobs will appear here as they run.
          </p>
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
                    <td className="p-3 font-mono text-xs text-bone-3">
                      {j.input && typeof j.input.runId === "string" ? j.input.runId : "—"}
                    </td>
                    <td className="p-3 text-bone-2">{formatDuration(j.startedAt, j.finishedAt)}</td>
                    <td className="p-3 text-bone-2">{timeAgo(j.startedAt)}</td>
                    <td className="p-3 font-mono text-bone-2">
                      {j.costUsd ? `$${Number(j.costUsd).toFixed(4)}` : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        className="btn-ghost px-2.5 py-1 text-xs"
                        onClick={() => {
                          setToast({
                            msg: `Error: ${j.error ?? "none"} | Output: ${JSON.stringify(j.output).slice(0, 100)}`,
                            type: j.status === "failed" ? "error" : "success",
                          });
                        }}
                      >
                        {j.error ? <AlertCircle className="h-3.5 w-3.5 text-danger" /> : <X className="h-3.5 w-3.5" />}
                        {j.error ? "View error" : "View output"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast */}
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