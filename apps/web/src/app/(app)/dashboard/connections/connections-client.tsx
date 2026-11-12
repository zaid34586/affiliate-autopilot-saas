"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Link2, MessageSquare, Cpu, ExternalLink, Lock, AlertCircle, CheckCircle2, RefreshCw, Trash2, Settings, Camera, Tv } from "lucide-react";

type Provider = "instagram" | "youtube" | "tiktok" | "facebook" | "x" | "amazon" | "clickbank" | "digistore" | "gemini" | "elevenlabs";

interface Connection {
  id: string;
  provider: Provider;
  accountName: string;
  accountAvatar?: string;
  status: "active" | "expired" | "revoked";
  scopes?: string[];
  tokenExpiresAt?: string;
  createdAt: string;
}

interface ConnectionStatus {
  provider: Provider;
  connected: boolean;
  account_name?: string;
  status?: "active" | "expired" | "revoked";
  expires_at?: string;
  scopes?: string[];
  health?: "healthy" | "warning" | "error";
}

const PROVIDER_CONFIG: Record<Provider, { label: string; icon: React.ComponentType<{ className?: string }>; category: "social" | "affiliate" | "ai"; color: string; oauth: boolean }> = {
  instagram: { label: "Instagram", icon: Camera, category: "social", color: "bg-gradient-to-br from-purple-500 to-pink-500", oauth: true },
  youtube: { label: "YouTube", icon: Tv, category: "social", color: "bg-red-500", oauth: true },
  tiktok: { label: "TikTok", icon: MessageSquare, category: "social", color: "bg-gray-900", oauth: true },
  facebook: { label: "Facebook", icon: Globe, category: "social", color: "bg-blue-600", oauth: true },
  x: { label: "X (Twitter)", icon: Globe, category: "social", color: "bg-gray-900", oauth: true },
  amazon: { label: "Amazon Associates", icon: Link2, category: "affiliate", color: "bg-orange-500", oauth: true },
  clickbank: { label: "ClickBank", icon: Link2, category: "affiliate", color: "bg-blue-700", oauth: true },
  digistore: { label: "Digistore24", icon: Link2, category: "affiliate", color: "bg-green-600", oauth: true },
  gemini: { label: "Gemini (BYOK)", icon: Cpu, category: "ai", color: "bg-indigo-500", oauth: false },
  elevenlabs: { label: "ElevenLabs (BYOK)", icon: MessageSquare, category: "ai", color: "bg-violet-500", oauth: false },
};

const CATEGORY_ORDER = ["social", "affiliate", "ai"] as const;
const CATEGORY_LABELS: Record<string, string> = { social: "Social platforms", affiliate: "Affiliate networks", ai: "AI & video" };

export function ConnectionsClient() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [statuses, setStatuses] = useState<Record<Provider, ConnectionStatus>>({} as Record<Provider, ConnectionStatus>);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<Provider | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  async function fetchConnections() {
    try {
      const res = await fetch("/api/dashboard/connections");
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
        setStatuses(data.statuses || {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function connect(provider: Provider) {
    setConnecting(provider);
    try {
      if (["gemini", "elevenlabs"].includes(provider)) {
        // BYOK - redirect to settings
        router.push("/dashboard/settings?tab=ai");
        return;
      }
      const res = await fetch("/api/auth/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.url) {
        router.push(data.url);
      } else {
        throw new Error(data.error || "Failed to initiate OAuth");
      }
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to initiate OAuth", type: "error" });
    } finally {
      setConnecting(null);
    }
  }

  async function disconnect(connectionId: string) {
    if (!confirm("Disconnect this account? Tokens will be permanently deleted.")) return;
    setDisconnecting(connectionId);
    try {
      const res = await fetch(`/api/dashboard/connections/${connectionId}`, { method: "DELETE" });
      if (res.ok) {
        setToast({ msg: "Disconnected successfully", type: "success" });
        fetchConnections();
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to disconnect", type: "error" });
    } finally {
      setDisconnecting(null);
    }
  }

  async function refreshToken(connectionId: string) {
    try {
      const res = await fetch(`/api/dashboard/connections/${connectionId}/refresh`, { method: "POST" });
      if (res.ok) {
        setToast({ msg: "Token refreshed", type: "success" });
        fetchConnections();
      } else {
        throw new Error("Failed to refresh token");
      }
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to refresh token", type: "error" });
    }
  }

  function getHealth(status?: ConnectionStatus): "healthy" | "warning" | "error" {
    if (!status) return "error";
    if (status.status === "revoked") return "error";
    if (status.status === "expired") return "warning";
    if (status.health) return status.health;
    return "healthy";
  }

  function getHealthIcon(health: "healthy" | "warning" | "error") {
    switch (health) {
      case "healthy": return <CheckCircle2 className="h-4 w-4 text-signal" />;
      case "warning": return <AlertCircle className="h-4 w-4 text-amber" />;
      case "error": return <AlertCircle className="h-4 w-4 text-danger" />;
    }
  }

  if (loading) {
    return (
      <div className="grid-dots flex items-center justify-center py-16">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 text-signal animate-spin" />
          <span className="label text-bone-3">Loading connections…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Token vault header */}
      <div className="rounded-2xl border border-signal/40 bg-signal/5 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-signal/10">
              <Lock className="h-6 w-6 text-signal" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Token vault</h2>
              <p className="text-sm text-bone-2">All tokens AES-256 encrypted, server-only, auto-refreshed.</p>
            </div>
          </div>
          <a href="/security" className="btn-ghost text-sm">
            <Settings className="h-4 w-4 mr-2" /> Security details
          </a>
        </div>
      </div>

      {/* Provider grid */}
      {CATEGORY_ORDER.map((cat) => {
        const providers = Object.entries(PROVIDER_CONFIG)
          .filter(([, v]) => v.category === cat)
          .map(([k]) => k as Provider);

        return (
          <section key={cat} className="space-y-4">
            <p className="label text-signal">{CATEGORY_LABELS[cat]}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((provider) => {
                const cfg = PROVIDER_CONFIG[provider];
                const conn = connections.find((c) => c.provider === provider);
                const status = statuses[provider];
                const health = getHealth(status);
                const isConnected = !!conn && conn.status !== "revoked";

                return (
                  <div
                    key={provider}
                    className={`panel relative overflow-hidden ${isConnected ? "border-signal/40 bg-signal/5" : "border-ink-3 bg-ink-2"}`}
                  >
                    {/* connection status indicator */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${health === "healthy" ? "bg-signal" : health === "warning" ? "bg-amber" : "bg-danger"}`} />
                    </div>

                    <div className="flex items-start gap-4 p-5">
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cfg.color}`}>
                        <cfg.icon className="h-6 w-6 text-white" />
                      </span>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{cfg.label}</h3>
                        {isConnected ? (
                          <>
                            <p className="mt-1.5 text-sm text-bone-3">
                              {status?.account_name || conn?.accountName || "Connected"}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-bone-3">
                              <span className="flex items-center gap-1">
                                {getHealthIcon(health)}
                                {health === "healthy" && "Healthy"}
                                {health === "warning" && "Token expiring"}
                                {health === "error" && "Disconnected"}
                              </span>
                              {status?.expires_at && (
                                <span className="text-bone-4">
                                  Expires{" "}
                                  {new Date(status.expires_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <p className="mt-1.5 text-sm text-bone-3">Not connected</p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-ink-3 p-4 pt-0">
                      {isConnected ? (
                        <div className="flex flex-wrap gap-2">
                          {status?.expires_at && (
                            <button
                              onClick={() => refreshToken(conn!.id)}
                              disabled={disconnecting === conn!.id}
                              className="btn-ghost text-xs flex-1 min-w-[120px]"
                            >
                              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                              Refresh
                            </button>
                          )}
                          <button
                            onClick={() => disconnect(conn!.id)}
                            disabled={disconnecting === conn!.id}
                            className="btn-ghost text-xs text-danger hover:bg-danger/10 flex-1 min-w-[120px]"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => connect(provider)}
                          disabled={connecting === provider}
                          className="btn-signal w-full"
                        >
                          {connecting === provider ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Connecting…
                            </>
                          ) : (
                            <>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Connect {cfg.label}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Empty state for no connections */}
      {connections.length === 0 && (
        <div className="grid-dots rounded-xl border border-dashed border-ink-4 px-6 py-16 text-center">
          <span className="label rounded border border-ink-4 bg-ink-2 px-2 py-1 text-amber">
            No connections yet
          </span>
          <p className="mt-5 text-lg font-medium text-bone-2">
            Connect your first account to start
          </p>
          <p className="mt-1.5 max-w-md mx-auto text-sm text-bone-3">
            Social accounts for publishing + DM, affiliate networks for products
            + commissions, AI keys for BYOK discounts.
          </p>
        </div>
      )}

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