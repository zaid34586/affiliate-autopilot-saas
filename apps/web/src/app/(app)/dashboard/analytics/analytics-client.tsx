"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart2,
  DollarSign,
  Loader2,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

interface AnalyticsSummary {
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  ctr: number;
}

interface PlatformStat {
  platform: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
}

interface PostStat {
  postId: string;
  platform: string;
  title: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
}

interface DailyStat {
  day: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  byPlatform: PlatformStat[];
  byPost: PostStat[];
  daily: DailyStat[];
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Target className="h-4 w-4" />,
  youtube: <Users className="h-4 w-4" />,
  tiktok: <TrendingUp className="h-4 w-4" />,
  facebook: <Users className="h-4 w-4" />,
  x: <Target className="h-4 w-4" />,
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

export function AnalyticsClient() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/analytics?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAnalytics(data);
    } catch (e) {
      console.error(e);
      setToast({ msg: "Failed to load analytics", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    async function load() {
      await fetchAnalytics();
    }
    void load();
  }, [fetchAnalytics]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleGenerateReport() {
    setGeneratingReport(true);
    try {
      const res = await fetch("/api/dashboard/analytics?type=weekly", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate");
      const { report } = await res.json();
      setToast({ msg: `Weekly report generated: ${report.period.from} to ${report.period.to}`, type: "success" });
      console.log("Weekly Report:", report);
    } catch {
      setToast({ msg: "Failed to generate report", type: "error" });
    } finally {
      setGeneratingReport(false);
    }
  }

  if (loading) {
    return (
      <div className="grid-dots flex items-center justify-center py-12">
        <Loader2 className="h-7 w-7 text-bone-3 animate-spin" />
      </div>
    );
  }

  if (!analytics) return null;

  const { summary, byPlatform, byPost, daily } = analytics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <BarChart2 className="h-4 w-4 text-signal" />
          Analytics Dashboard
        </h2>
        <div className="flex items-center gap-2">
          <select
            className="field text-xs"
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={fetchAnalytics}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            className="btn-signal px-3 py-1.5 text-xs"
            onClick={handleGenerateReport}
            disabled={generatingReport}
          >
            {generatingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />}
            Weekly AI Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="panel p-4">
          <p className="label text-bone-3">Impressions</p>
          <p className="mt-1 text-2xl font-semibold text-bone">{formatNumber(summary.totalImpressions)}</p>
        </div>
        <div className="panel p-4">
          <p className="label text-bone-3">Clicks</p>
          <p className="mt-1 text-2xl font-semibold text-bone">{formatNumber(summary.totalClicks)}</p>
        </div>
        <div className="panel p-4">
          <p className="label text-bone-3">Conversions</p>
          <p className="mt-1 text-2xl font-semibold text-bone">{formatNumber(summary.totalConversions)}</p>
        </div>
        <div className="panel p-4">
          <p className="label text-bone-3">Revenue</p>
          <p className="mt-1 text-2xl font-semibold text-signal">{formatCurrency(summary.totalRevenue)}</p>
        </div>
        <div className="panel p-4">
          <p className="label text-bone-3">CTR</p>
          <p className="mt-1 text-2xl font-semibold text-bone">{formatPct(summary.ctr)}</p>
        </div>
      </div>

      {/* By Platform */}
      <div className="panel p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Target className="h-4 w-4 text-signal" />
          Performance by Platform
        </h3>
        {byPlatform.length === 0 ? (
          <p className="mt-4 text-center text-bone-3">No platform data yet</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-3">
                  <th className="p-3 text-left font-medium text-bone-3">Platform</th>
                  <th className="p-3 text-right font-medium text-bone-3">Impressions</th>
                  <th className="p-3 text-right font-medium text-bone-3">Clicks</th>
                  <th className="p-3 text-right font-medium text-bone-3">Conversions</th>
                  <th className="p-3 text-right font-medium text-bone-3">Revenue</th>
                  <th className="p-3 text-right font-medium text-bone-3">CTR</th>
                </tr>
              </thead>
              <tbody>
                {byPlatform.map((p) => (
                  <tr key={p.platform} className="border-b border-ink-3 hover:bg-ink/50">
                    <td className="p-3 flex items-center gap-2">
                      {PLATFORM_ICONS[p.platform] || <Target className="h-4 w-4" />}
                      <span className="font-medium capitalize">{p.platform}</span>
                    </td>
                    <td className="p-3 text-right">{formatNumber(p.impressions)}</td>
                    <td className="p-3 text-right">{formatNumber(p.clicks)}</td>
                    <td className="p-3 text-right">{formatNumber(p.conversions)}</td>
                    <td className="p-3 text-right text-signal">{formatCurrency(p.revenue)}</td>
                    <td className="p-3 text-right">{formatPct(p.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Posts */}
      <div className="panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <DollarSign className="h-4 w-4 text-signal" />
            Top Posts by Revenue
          </h3>
        </div>
        {byPost.length === 0 ? (
          <p className="mt-4 text-center text-bone-3">No post data yet</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-3">
                  <th className="p-3 text-left font-medium text-bone-3">Post</th>
                  <th className="p-3 text-right font-medium text-bone-3">Impressions</th>
                  <th className="p-3 text-right font-medium text-bone-3">Clicks</th>
                  <th className="p-3 text-right font-medium text-bone-3">Conversions</th>
                  <th className="p-3 text-right font-medium text-bone-3">Revenue</th>
                  <th className="p-3 text-right font-medium text-bone-3">CTR</th>
                </tr>
              </thead>
              <tbody>
                {byPost.slice(0, 10).map((p) => (
                  <tr key={p.postId} className="border-b border-ink-3 hover:bg-ink/50">
                    <td className="p-3 flex items-center gap-2 max-w-xs">
                      {PLATFORM_ICONS[p.platform] || <Target className="h-4 w-4" />}
                      <span className="font-medium truncate" title={p.title}>{p.title}</span>
                    </td>
                    <td className="p-3 text-right">{formatNumber(p.impressions)}</td>
                    <td className="p-3 text-right">{formatNumber(p.clicks)}</td>
                    <td className="p-3 text-right">{formatNumber(p.conversions)}</td>
                    <td className="p-3 text-right text-signal">{formatCurrency(p.revenue)}</td>
                    <td className="p-3 text-right">{formatPct(p.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daily Trend */}
      <div className="panel p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <TrendingUp className="h-4 w-4 text-signal" />
          Daily Trend (last {days} days)
        </h3>
        {daily.length === 0 ? (
          <p className="mt-4 text-center text-bone-3">No daily data yet</p>
        ) : (
          <div className="mt-4 h-64 relative">
            <div className="flex items-end justify-between h-full gap-1">
              {daily.map((d) => {
                const maxRevenue = Math.max(...daily.map((x) => x.revenue), 1);
                const heightPct = (d.revenue / maxRevenue) * 100;
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-signal/50 hover:bg-signal transition-colors rounded-t"
                      style={{ height: `${heightPct}%`, minHeight: "4px" }}
                      title={`${d.day}: ${formatCurrency(d.revenue)}`}
                    />
                    <span className="text-xs text-bone-3 mt-1">{d.day.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

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