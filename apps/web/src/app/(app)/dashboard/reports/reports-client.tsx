"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  FileText,
  Calendar,
  Clock,
  Download,
  RefreshCw,
  Zap,
  Brain,
  ChevronDown,
  ChevronUp,
  Send,
  Settings,
} from "lucide-react";

interface AIReport {
  id: string;
  reportType: "daily" | "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
  title: string;
  summary: string;
  insights: string;
  recommendations: string;
  metricsSnapshot: Record<string, unknown>;
  generatedBy: "llm" | "template";
  model?: string;
  status: "generating" | "generated" | "failed";
  error?: string;
  createdAt: string;
}

interface ReportSchedule {
  id: string;
  reportType: "daily" | "weekly" | "monthly";
  enabled: boolean;
  sendTime: string;
  timezone: string;
  recipients: string[];
  format: "html" | "pdf" | "markdown";
  includeAiInsights: boolean;
  lastGeneratedAt?: string;
  nextGenerationAt?: string;
}

const TYPE_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  daily: <Calendar className="h-4 w-4" />,
  weekly: <Calendar className="h-4 w-4" />,
  monthly: <Calendar className="h-4 w-4" />,
};

const STATUS_COLORS: Record<string, string> = {
  generated: "bg-green-500/10 text-green-500",
  generating: "bg-amber-500/10 text-amber-500",
  failed: "bg-red-500/10 text-red-500",
};

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function ReportCard({ report, onExpand }: { report: AIReport; onExpand: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="label rounded px-2 py-0.5 bg-signal/10 text-signal text-xs">
              {TYPE_ICONS[report.reportType]}
              {TYPE_LABELS[report.reportType]}
            </span>
            <span className={`label rounded px-2 py-0.5 ${STATUS_COLORS[report.status]}`}>
              {report.status}
            </span>
            <span className="text-xs text-bone-3">
              {formatDate(report.periodStart)} - {formatDate(report.periodEnd)}
            </span>
            {report.generatedBy === "llm" && report.model && (
              <span className="text-xs text-bone-3 bg-brain/10 text-purple-500 px-2 py-0.5 rounded">
                <Brain className="h-3 w-3 inline mr-1" /> {report.model}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-medium text-bone">{report.title}</h3>
          <p className="mt-1 text-sm text-bone-3 line-clamp-2">{report.summary}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn-ghost p-2"
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          <button className="btn-ghost p-2" title="Download">
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 pt-4 border-t border-ink-3">
          <div>
            <h4 className="font-medium text-bone-3 mb-2">Insights (Why)</h4>
            <div className="prose prose-sm text-bone-2 max-w-none">{report.insights}</div>
          </div>
          <div>
            <h4 className="font-medium text-bone-3 mb-2">Recommendations (What next)</h4>
            <div className="prose prose-sm text-bone-2 max-w-none">{report.recommendations}</div>
          </div>
          {report.metricsSnapshot && Object.keys(report.metricsSnapshot).length > 0 && (
            <div>
              <h4 className="font-medium text-bone-3 mb-2">Key Metrics</h4>
              <pre className="text-xs text-bone-3 bg-ink p-3 rounded overflow-auto max-h-40">
                {JSON.stringify(report.metricsSnapshot, null, 2)}
              </pre>
            </div>
          )}
          {report.error && (
            <div className="text-sm text-danger bg-danger/10 p-3 rounded">
              Error: {report.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScheduleCard({ schedule, onToggle, onGenerateNow }: { schedule: ReportSchedule; onToggle: (id: string, enabled: boolean) => void; onGenerateNow: (id: string) => void }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="label rounded px-2 py-0.5 bg-signal/10 text-signal text-xs">
            {TYPE_ICONS[schedule.reportType]}
            {TYPE_LABELS[schedule.reportType]}
          </span>
          <span className={`label rounded px-2 py-0.5 ${schedule.enabled ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
            {schedule.enabled ? "Active" : "Paused"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-bone-3">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {schedule.sendTime} {schedule.timezone}
          </span>
          {schedule.lastGeneratedAt && (
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              Last: {formatRelativeTime(schedule.lastGeneratedAt)}
            </span>
          )}
          {schedule.nextGenerationAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Next: {formatRelativeTime(schedule.nextGenerationAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onToggle(schedule.id, !schedule.enabled)}
            className={`btn-ghost p-2 ${schedule.enabled ? "" : "opacity-50"}`}
          >
            {schedule.enabled ? <Send className="h-4 w-4" /> : <Send className="h-4 w-4 opacity-50" />}
          </button>
          <button
            onClick={() => onGenerateNow(schedule.id)}
            className="btn-signal text-xs"
          >
            <Zap className="h-3.5 w-3.5 mr-1" />
            Generate Now
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReportsClient() {
  const [reports, setReports] = useState<AIReport[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [activeTab, setActiveTab] = useState<"reports" | "schedules">("reports");

  const load = useCallback(async () => {
    try {
      const [reportsRes, schedulesRes] = await Promise.all([
        fetch("/api/dashboard/reports"),
        fetch("/api/dashboard/reports/schedules"),
      ]);
      if (reportsRes.ok) {
        const data = await reportsRes.json();
        setReports(data.reports);
      }
      if (schedulesRes.ok) {
        const data = await schedulesRes.json();
        setSchedules(data.schedules);
      }
    } catch (e) {
      console.error(e);
      setToast({ msg: "Failed to load reports", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() { await load(); }
    void init();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const generateReport = async (type: "daily" | "weekly" | "monthly") => {
    setGenerating(type);
    try {
      const res = await fetch("/api/dashboard/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      const { report } = await res.json();
      setToast({ msg: `${type.charAt(0).toUpperCase() + type.slice(1)} report generated`, type: "success" });
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to generate", type: "error" });
    } finally {
      setGenerating(null);
    }
  };

  const generateScheduledReport = async (scheduleId: string) => {
    setGenerating(scheduleId);
    try {
      const res = await fetch(`/api/dashboard/reports/schedules/${scheduleId}/generate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to generate");
      setToast({ msg: "Scheduled report generated", type: "success" });
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to generate", type: "error" });
    } finally {
      setGenerating(null);
    }
  };

  const toggleSchedule = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/dashboard/reports/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to update", type: "error" });
    }
  };

  if (loading) {
    return (
      <div className="grid-dots flex items-center justify-center py-12">
        <Loader2 className="h-7 w-7 text-bone-3 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FileText className="h-6 w-6 text-signal" />
            AI Reports
          </h2>
          <p className="text-sm text-bone-3">Daily/Weekly/Monthly — What happened, Why, What next</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => generateReport("daily")} disabled={generating === "daily"} className="btn-signal text-xs">
            <Calendar className="h-3.5 w-3.5 mr-1" /> Daily
          </button>
          <button onClick={() => generateReport("weekly")} disabled={generating === "weekly"} className="btn-signal text-xs">
            <Calendar className="h-3.5 w-3.5 mr-1" /> Weekly
          </button>
          <button onClick={() => generateReport("monthly")} disabled={generating === "monthly"} className="btn-signal text-xs">
            <Calendar className="h-3.5 w-3.5 mr-1" /> Monthly
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ink rounded-lg p-1">
        <button
          onClick={() => setActiveTab("reports")}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "reports"
              ? "bg-signal text-signal-foreground"
              : "text-bone-3 hover:bg-ink/50"
          }`}
        >
          Generated Reports
        </button>
        <button
          onClick={() => setActiveTab("schedules")}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "schedules"
              ? "bg-signal text-signal-foreground"
              : "text-bone-3 hover:bg-ink/50"
          }`}
        >
          Schedules
        </button>
      </div>

      {activeTab === "reports" && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="panel p-12 text-center">
              <FileText className="h-12 w-12 text-bone-3 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-bone">No reports yet</h3>
              <p className="text-bone-3 mt-1">Generate your first AI report using the buttons above</p>
            </div>
          ) : (
            reports.map((report) => (
              <ReportCard key={report.id} report={report} onExpand={() => {}} />
            ))
          )}
        </div>
      )}

      {activeTab === "schedules" && (
        <div className="space-y-4">
          {schedules.length === 0 ? (
            <div className="panel p-12 text-center">
              <Calendar className="h-12 w-12 text-bone-3 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-bone">No schedules yet</h3>
              <p className="text-bone-3 mt-1">Create a schedule to auto-generate reports</p>
            </div>
          ) : (
            schedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                onToggle={toggleSchedule}
                onGenerateNow={generateScheduledReport}
              />
            ))
          )}
        </div>
      )}

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