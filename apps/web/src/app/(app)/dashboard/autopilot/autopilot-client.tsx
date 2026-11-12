"use client";

import { useState } from "react";
import { Moon, AlertTriangle, CheckCircle2, Zap, Timer, BarChart2, Save, Loader2 } from "lucide-react";

type AutopilotLevel = "manual" | "semi" | "full" | "fire_and_forget";

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

const LEVELS: { value: AutopilotLevel; label: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string; features: string[] }[] = [
  {
    value: "manual",
    label: "Manual",
    description: "You approve every post and DM. Full control, zero surprises.",
    icon: CheckCircle2,
    color: "bg-blue-500",
    features: ["Draft preview for every post", "Approve/reject each DM", "No auto-publishing", "Best for learning"],
  },
  {
    value: "semi",
    label: "Semi",
    description: "AI drafts, you approve. Balanced control with time savings.",
    icon: Timer,
    color: "bg-amber-500",
    features: ["AI generates drafts", "One-click approve", "Auto-publish after approval", "DMs need approval", "Recommended for new users"],
  },
  {
    value: "full",
    label: "Full",
    description: "Auto-publish and auto-DM within limits. You set boundaries.",
    icon: Zap,
    color: "bg-green-500",
    features: ["Auto-publish scheduled posts", "Auto-DM on comment triggers", "Daily caps & quiet hours enforced", "Circuit breakers active", "Weekly review recommended"],
  },
  {
    value: "fire_and_forget",
    label: "Fire-and-forget",
    description: "Maximum automation. Set it and forget it (with safety rails).",
    icon: BarChart2,
    color: "bg-purple-500",
    features: ["Everything in Full mode", "Higher daily caps", "Priority render queue", "Auto-optimize hooks", "Only for experienced users"],
  },
];

const PLATFORMS = [
  { key: "instagram", label: "Instagram", icon: "📷" },
  { key: "youtube", label: "YouTube Shorts", icon: "▶️" },
  { key: "tiktok", label: "TikTok", icon: "🎵" },
  { key: "facebook", label: "Facebook", icon: "👥" },
  { key: "x", label: "X (Twitter)", icon: "𝕏" },
];

const DEFAULT_LIMITS: Record<AutopilotLevel, Record<string, number>> = {
  manual: { instagram: 0, youtube: 0, tiktok: 0, facebook: 0, x: 0 },
  semi: { instagram: 3, youtube: 2, tiktok: 3, facebook: 2, x: 5 },
  full: { instagram: 6, youtube: 4, tiktok: 6, facebook: 4, x: 10 },
  fire_and_forget: { instagram: 12, youtube: 8, tiktok: 12, facebook: 8, x: 20 },
};

export function AutopilotClient() {
  const [config, setConfig] = useState<AutopilotConfig>({
    level: "semi",
    dailyPostLimits: DEFAULT_LIMITS.semi,
    activePlatforms: ["instagram", "youtube"],
    quietHours: { from: "22:00", to: "08:00" },
    paused: false,
    circuitBreakers: {
      maxErrorsPerHour: 10,
      maxRetries: 3,
      pauseOnRateLimit: true,
    },
  });
  const [loading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  async function saveConfig() {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setToast({ msg: "Autopilot settings saved", type: "success" });
      } else {
        throw new Error("Failed to save");
      }
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to save", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  function handleLevelChange(level: AutopilotLevel) {
    setConfig((prev) => ({
      ...prev,
      level,
      dailyPostLimits: DEFAULT_LIMITS[level],
    }));
  }

  function handlePlatformToggle(platform: string) {
    setConfig((prev) => ({
      ...prev,
      activePlatforms: prev.activePlatforms.includes(platform)
        ? prev.activePlatforms.filter((p) => p !== platform)
        : [...prev.activePlatforms, platform],
    }));
  }

  function handleLimitChange(platform: string, value: number) {
    setConfig((prev) => ({
      ...prev,
      dailyPostLimits: { ...prev.dailyPostLimits, [platform]: Math.max(0, value) },
    }));
  }

  if (loading) {
    return (
      <div className="grid-dots flex items-center justify-center py-16">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 text-signal animate-spin" />
          <span className="label text-bone-3">Loading autopilot config…</span>
        </div>
      </div>
    );
  }

  const currentLevel = LEVELS.find((l) => l.value === config.level)!;

  return (
    <div className="space-y-8">
      {/* Current level badge */}
      <div className="rounded-2xl border border-signal/40 bg-signal/5 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${currentLevel.color}`}>
              <currentLevel.icon className="h-6 w-6 text-white" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Current mode: {currentLevel.label}</h2>
              <p className="text-sm text-bone-2">{currentLevel.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                onClick={() => handleLevelChange(l.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  config.level === l.value
                    ? `${l.color} text-white`
                    : "border border-ink-4 bg-ink-2 text-bone-2 hover:border-signal hover:text-signal"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {currentLevel.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-bone-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-signal" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Quiet hours */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-2">
              <Moon className="h-5 w-5 text-amber" />
            </span>
            <div>
              <h3 className="font-semibold tracking-tight">Quiet hours</h3>
              <p className="text-sm text-bone-3">No posts or DMs sent during this window</p>
            </div>
          </div>
        </div>
        <div className="panel p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <label className="label text-bone-3">From</label>
              <input
                type="time"
                value={config.quietHours.from}
                onChange={(e) => setConfig((prev) => ({ ...prev, quietHours: { ...prev.quietHours, from: e.target.value } }))}
                className="field w-28"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="label text-bone-3">To</label>
              <input
                type="time"
                value={config.quietHours.to}
                onChange={(e) => setConfig((prev) => ({ ...prev, quietHours: { ...prev.quietHours, to: e.target.value } }))}
                className="field w-28"
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="label text-bone-3">Timezone: Asia/Kolkata</span>
            </div>
          </div>
        </div>
      </section>

      {/* Daily caps per platform */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-2">
              <BarChart2 className="h-5 w-5 text-signal" />
            </span>
            <div>
              <h3 className="font-semibold tracking-tight">Daily post caps</h3>
              <p className="text-sm text-bone-3">Max posts per platform per day (auto-adjusted by level)</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORMS.map((p) => {
            const isActive = config.activePlatforms.includes(p.key);
            const limit = config.dailyPostLimits[p.key] || 0;
            return (
              <div
                key={p.key}
                className={`panel p-4 ${isActive ? "border-signal/40 bg-signal/5" : "border-ink-3 bg-ink-2"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.icon}</span>
                    <div>
                      <h4 className="font-medium">{p.label}</h4>
                      <p className="text-xs text-bone-3">{isActive ? "Active" : "Inactive"}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePlatformToggle(p.key)}
                    className={`rounded-lg px-2 py-1 text-xs ${isActive ? "bg-signal text-ink" : "bg-ink text-bone-2"}`}
                  >
                    {isActive ? "Disable" : "Enable"}
                  </button>
                </div>
                {isActive && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="label text-bone-3 flex-1">Daily limit</label>
                    <input
                      type="number"
                      min="0"
                      max={config.level === "fire_and_forget" ? 50 : 20}
                      value={limit}
                      onChange={(e) => handleLimitChange(p.key, parseInt(e.target.value) || 0)}
                      className="field w-20 text-center"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Circuit breakers */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-2">
              <AlertTriangle className="h-5 w-5 text-danger" />
            </span>
            <div>
              <h3 className="font-semibold tracking-tight">Circuit breakers</h3>
              <p className="text-sm text-bone-3">Safety rails that pause autopilot when things go wrong</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="panel p-5">
            <label className="label text-bone-3">Max errors/hour</label>
            <input
              type="number"
              min="1"
              max="50"
              value={config.circuitBreakers.maxErrorsPerHour}
              onChange={(e) => setConfig((prev) => ({ ...prev, circuitBreakers: { ...prev.circuitBreakers, maxErrorsPerHour: parseInt(e.target.value) || 1 } }))}
              className="field mt-2"
            />
            <p className="mt-1 text-xs text-bone-3">Pause if API errors exceed this per hour</p>
          </div>
          <div className="panel p-5">
            <label className="label text-bone-3">Max retries</label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.circuitBreakers.maxRetries}
              onChange={(e) => setConfig((prev) => ({ ...prev, circuitBreakers: { ...prev.circuitBreakers, maxRetries: parseInt(e.target.value) || 1 } }))}
              className="field mt-2"
            />
            <p className="mt-1 text-xs text-bone-3">Retry failed jobs this many times</p>
          </div>
          <div className="panel p-5 flex items-center gap-3">
            <input
              type="checkbox"
              id="pauseOnRateLimit"
              checked={config.circuitBreakers.pauseOnRateLimit}
              onChange={(e) => setConfig((prev) => ({ ...prev, circuitBreakers: { ...prev.circuitBreakers, pauseOnRateLimit: e.target.checked } }))}
              className="h-4 w-4 rounded border-ink-4 text-signal focus:ring-signal"
            />
            <label htmlFor="pauseOnRateLimit" className="text-sm text-bone-2">
              Pause on rate limit (auto-resume after cooldown)
            </label>
          </div>
        </div>
      </section>

      {/* Pause toggle */}
      <section className="space-y-4">
        <div className="panel p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold tracking-tight">Pause autopilot</h3>
            <p className="text-sm text-bone-3">Temporarily stop all automated jobs (manual posts still work)</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.paused}
              onChange={(e) => setConfig((prev) => ({ ...prev, paused: e.target.checked }))}
              className="sr-only peer"
            />
            <div className={`w-11 h-6 rounded-full transition-colors ${config.paused ? "bg-signal" : "bg-ink-3"}`}>
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${config.paused ? "translate-x-5" : ""}`} />
            </div>
          </label>
        </div>
      </section>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="btn-signal flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save settings
            </>
          )}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg ${
              toast.type === "success" ? "border border-signal/40 bg-signal/10 text-signal" : "border border-danger/40 bg-danger/10 text-danger"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}