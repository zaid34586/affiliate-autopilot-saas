"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2, TrendingUp, TrendingDown, Target, ExternalLink, Filter, RefreshCw } from "lucide-react";

interface AttributionData {
  period: { days: number; since: string };
  summary: { dms: number; sent: number; clicks: number; conversions: number; ctr: number; cvr: number };
  triggers: Array<{ triggerId: string; keywords: { set: string[] }; dmsStarted: number; dmsSent: number; dmsApproved: number; dmsQueued: number }>;
  keywords: Array<{ keyword: string; count: number; sent: number; clicks: number; conversions: number }>;
  platforms: Array<{ platform: string; total: number; sent: number; clicked: number; converted: number }>;
  topConvertingKeywords: Array<{ keyword: string; count: number; sent: number; clicks: number; conversions: number }>;
}

const COLORS = ["#00D4AA", "#8B5CF6", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", "#14B8A6", "#F97316"];

export function DmAttribution() {
  const [data, setData] = useState<AttributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/dm-attribution?days=${days}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json);
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to load attribution", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [days]);

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
        <p className="text-bone-2">No attribution data available</p>
        <p className="text-xs text-bone-3 mt-1">Run some DM funnels to see the funnel analytics</p>
      </div>
    );
  }

  const { summary, keywords, platforms, topConvertingKeywords } = data;

  const funnelStages = [
    { stage: "DMs Started", value: summary.dms, color: "#3B82F6" },
    { stage: "Sent", value: summary.sent, color: "#00D4AA" },
    { stage: "Clicked", value: summary.clicks, color: "#F59E0B" },
    { stage: "Conversions", value: summary.conversions, color: "#8B5CF6" },
  ];

  return (
    <div className="panel mt-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-3 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Target className="h-4 w-4 text-signal" />
            DM Attribution Funnel
          </h2>
          <p className="text-xs text-bone-3 mt-0.5">Triggers → DMs → Clicks → Sales (last {days} days)</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="field text-xs w-32"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <button onClick={load} className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 px-5 py-4">
        <div className="panel p-4">
          <p className="label text-bone-3">DMs Started</p>
          <p className="text-2xl font-semibold text-bone">{summary.dms.toLocaleString()}</p>
        </div>
        <div className="panel p-4">
          <p className="label text-bone-3">Sent</p>
          <p className="text-2xl font-semibold text-signal">{summary.sent.toLocaleString()}</p>
        </div>
        <div className="panel p-4">
          <p className="label text-bone-3">Clicked</p>
          <p className="text-2xl font-semibold text-amber">{summary.clicks.toLocaleString()}</p>
        </div>
        <div className="panel p-4">
          <p className="label text-bone-3">Conversions</p>
          <p className="text-2xl font-semibold text-purple">{summary.conversions.toLocaleString()}</p>
        </div>
        <div className="panel p-4">
          <p className="label text-bone-3">CTR (sent→click)</p>
          <p className="text-2xl font-semibold text-bone">{summary.ctr}%</p>
        </div>
        <div className="panel p-4">
          <p className="label text-bone-3">CVR (click→sale)</p>
          <p className="text-2xl font-semibold text-bone">{summary.cvr}%</p>
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className="border-t border-ink-3 px-5 py-4">
        <h3 className="text-sm font-medium text-bone-2 mb-3">Funnel Stages</h3>
        <div className="flex items-center justify-between gap-2">
          {funnelStages.map((s, i) => (
            <div key={s.stage} className="flex flex-col items-center flex-1">
              <div className="relative w-full max-w-xs">
                <div
                  className="h-24 rounded-t-lg bg-ink-2 flex items-end justify-center"
                  style={{ background: `linear-gradient(to top, ${s.color} ${(s.value / (funnelStages[0].value || 1)) * 100}%, #1a1a2e 0%)` }}
                >
                  <span className="text-xs font-bold text-ink mb-1">{s.value.toLocaleString()}</span>
                </div>
              </div>
              <p className="text-xs text-bone-3 text-center mt-2">{s.stage}</p>
              {i < funnelStages.length - 1 && (
                <ExternalLink className="text-bone-4 mx-1 rotate-90" size={16} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="border-t border-ink-3 px-5 py-4">
        <h3 className="text-sm font-medium text-bone-2 mb-3">By Platform</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-bone-3 border-b border-ink-3">
                <th className="pb-2 font-medium">Platform</th>
                <th className="pb-2 font-medium text-right">Total</th>
                <th className="pb-2 font-medium text-right">Sent</th>
                <th className="pb-2 font-medium text-right">Clicked</th>
                <th className="pb-2 font-medium text-right">Converted</th>
                <th className="pb-2 font-medium text-right">CVR</th>
              </tr>
            </thead>
            <tbody>
              {data.platforms.map((p) => (
                <tr key={p.platform} className="border-b border-ink-3/50">
                  <td className="py-2 font-medium capitalize">{p.platform}</td>
                  <td className="py-2 text-right text-bone-2">{p.total.toLocaleString()}</td>
                  <td className="py-2 text-right text-signal">{p.sent.toLocaleString()}</td>
                  <td className="py-2 text-right text-amber">{p.clicked.toLocaleString()}</td>
                  <td className="py-2 text-right text-purple">{p.converted.toLocaleString()}</td>
                  <td className="py-2 text-right text-bone-2">
                    {p.clicked > 0 ? ((p.converted / p.clicked) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Keywords */}
      <div className="border-t border-ink-3 px-5 py-4">
        <h3 className="text-sm font-medium text-bone-2 mb-3">Top Keywords (by DM volume)</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {keywords.slice(0, 15).map((k, i) => (
            <div key={k.keyword} className="flex items-center gap-3 p-2 rounded-lg bg-ink-2">
              <span className="label text-bone-3 w-8 text-center">{i + 1}</span>
              <span className="font-mono text-sm text-bone flex-1 truncate">{k.keyword}</span>
              <span className="text-xs text-bone-3 w-16 text-right">{k.count.toLocaleString()}</span>
              <span className="text-xs text-signal w-16 text-right">{k.sent.toLocaleString()}</span>
              <span className="text-xs text-amber w-16 text-right">{k.clicks.toLocaleString()}</span>
              <span className="text-xs text-purple w-16 text-right">{k.conversions.toLocaleString()}</span>
              <span className="text-xs text-bone-3 w-16 text-right">
                {k.sent > 0 ? ((k.clicks / k.sent) * 100).toFixed(1) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Converting Keywords */}
      {topConvertingKeywords.length > 0 && (
        <div className="border-t border-ink-3 px-5 py-4">
          <h3 className="text-sm font-medium text-bone-2 mb-3">Top Converting Keywords</h3>
          <div className="space-y-2">
            {topConvertingKeywords.map((k, i) => (
              <div key={k.keyword} className="flex items-center gap-3 p-2 rounded-lg bg-ink-2 border border-signal/20">
                <span className="label bg-signal/20 text-signal w-8 text-center rounded">{i + 1}</span>
                <span className="font-mono text-sm text-bone flex-1 truncate">{k.keyword}</span>
                <span className="text-xs text-purple font-medium">{k.conversions} sales</span>
                <span className="text-xs text-bone-3">from {k.clicks} clicks</span>
                <span className="text-xs text-signal">({((k.conversions / k.clicks) * 100).toFixed(1)}% CVR)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart: Keyword Volume */}
      <div className="border-t border-ink-3 px-5 py-4">
        <h3 className="text-sm font-medium text-bone-2 mb-3">Keyword Volume (Top 10)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={keywords.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
              <XAxis dataKey="keyword" tick={{ fill: "#6b7280", fontSize: 10 }} angle={-45} textAnchor="end" dy={10} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#0f0f1a", border: "1px solid #1a1a2e", borderRadius: 8 }}
                labelStyle={{ color: "#e5e7eb" }}
              />
              <Bar dataKey="count" fill="#00D4AA" radius={[4, 4, 0, 0]} name="DMs" />
              <Bar dataKey="sent" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Sent" />
              <Bar dataKey="clicks" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Clicks" />
              <Bar dataKey="conversions" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Conversions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart: Platform Distribution */}
      <div className="border-t border-ink-3 px-5 py-4">
        <h3 className="text-sm font-medium text-bone-2 mb-3">Platform Distribution (Sent)</h3>
        <div className="h-64 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.platforms}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="sent"
                nameKey="platform"
                label={({ payload }) => `${payload.platform}: ${payload.value} (${((payload.percent ?? 0) * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {data.platforms.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
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