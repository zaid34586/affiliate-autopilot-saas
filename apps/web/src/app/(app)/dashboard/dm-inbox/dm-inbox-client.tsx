"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import {
  MessageSquare,
  Send,
  X,
  Check,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter,
  Loader2,
  MoreVertical,
  Shield,
  Trash2,
  Edit,
  Eye,
  ArrowRight,
  Bell,
  User,
  Globe,
  Camera,
  Tv,
  Save,
  Plus,
  Sparkles,
  } from "lucide-react";

type DMStatus = "queued" | "sent" | "failed" | "blocked" | "draft" | "approved";
type ApprovalMode = "manual" | "semi" | "auto";

interface DMMessage {
  id: string;
  platform: "instagram" | "youtube" | "tiktok" | "facebook" | "x";
  platformUserId: string;
  recipientHandle: string;
  recipientName?: string;
  recipientAvatar?: string;
  triggerKeyword: string;
  postId?: string;
  productId?: string;
  body: string;
  uniqueLinkCode?: string;
  status: DMStatus;
  approvalMode: ApprovalMode;
  sentAt?: string;
  createdAt: string;
  error?: string;
  clickAt?: string;
  conversionId?: string;
}

interface DMTrigger {
  id: string;
  postId?: string;
  keywords: { set: string[]; semantic: boolean };
  replyTemplate: string;
  mode: "manual" | "semi" | "auto";
  cooldownHours: number;
  dailyCap: number;
  enabled: boolean;
  createdAt: string;
}

interface DMSentiment {
  score: number;
  label: "positive" | "neutral" | "negative";
}

const PLATFORM_ICONS = {
  instagram: Camera,
  youtube: Tv,
  tiktok: MessageSquare,
  facebook: Globe,
  x: Globe,
};

const STATUS_CONFIG: Record<DMStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  queued: { label: "Queued", color: "bg-amber-500", icon: Clock },
  sent: { label: "Sent", color: "bg-signal", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-danger", icon: AlertCircle },
  blocked: { label: "Blocked", color: "bg-gray-500", icon: Shield },
  draft: { label: "Draft", color: "bg-blue-500", icon: Edit },
  approved: { label: "Approved", color: "bg-green-500", icon: CheckCircle2 },
};

const MODE_LABELS: Record<ApprovalMode, string> = {
  manual: "Manual (approve each)",
  semi: "Semi (draft preview)",
  auto: "Auto (with limits)",
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

export function DmInboxClient() {
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [triggers, setTriggers] = useState<DMTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<DMStatus | "all">("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<DMTrigger | null>(null);
  const [suggesting, setSuggesting] = useState<string | null>(null);

  async function fetchData() {
    try {
      const [msgRes, trigRes] = await Promise.all([
        fetch("/api/dashboard/dm-inbox"),
        fetch("/api/dashboard/dm-triggers"),
      ]);
      if (msgRes.ok) setMessages(await msgRes.json());
      if (trigRes.ok) setTriggers(await trigRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        await fetchData();
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const interval = setInterval(() => {
      if (mounted) fetchData();
    }, 30000);
    return () => { mounted = false; };
  }, []);

  const filteredMessages = messages.filter((m) => {
    if (filterStatus !== "all" && m.status !== filterStatus) return false;
    if (filterPlatform !== "all" && m.platform !== filterPlatform) return false;
    if (searchQuery && !m.recipientHandle.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !m.body.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !m.triggerKeyword.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  async function sendDM(id: string) {
    setSending(id);
    try {
      const res = await fetch(`/api/dashboard/dm-inbox/${id}/send`, { method: "POST" });
      if (res.ok) {
        setToast({ msg: "DM sent", type: "success" });
        fetchData();
      } else throw new Error("Failed to send");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to send", type: "error" });
    } finally {
      setSending(null);
    }
  }

  async function approveDM(id: string) {
    setApproving(id);
    try {
      const res = await fetch(`/api/dashboard/dm-inbox/${id}/approve`, { method: "POST" });
      if (res.ok) {
        setToast({ msg: "DM approved & sent", type: "success" });
        fetchData();
      } else throw new Error("Failed to approve");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to approve", type: "error" });
    } finally {
      setApproving(null);
    }
  }

  async function rejectDM(id: string) {
    try {
      const res = await fetch(`/api/dashboard/dm-inbox/${id}/reject`, { method: "POST" });
      if (res.ok) {
        setToast({ msg: "DM rejected", type: "success" });
        fetchData();
      } else throw new Error("Failed to reject");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to reject", type: "error" });
    }
  }

  async function editDM(id: string) {
    const msg = messages.find((m) => m.id === id);
    if (msg) {
      setEditingId(id);
      setEditBody(msg.body);
    }
  }

  async function suggestDM(msg: DMMessage) {
    setSuggesting(msg.id);
    try {
      const res = await fetch(`/api/dashboard/dm-inbox/${msg.id}/suggest`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate suggestion");
      // Fill the existing edit box — user reviews before saving (no silent mutation).
      setEditingId(msg.id);
      setEditBody(data.reply);
      setToast({
        msg: `Suggestion ready (${data.intent}, engine ${data.engine}) — review, then Save`,
        type: "success",
      });
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to suggest", type: "error" });
    } finally {
      setSuggesting(null);
    }
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      const res = await fetch(`/api/dashboard/dm-inbox/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody }),
      });
      if (res.ok) {
        setToast({ msg: "DM updated", type: "success" });
        setEditingId(null);
        setEditBody("");
        fetchData();
      } else throw new Error("Failed to update");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to update", type: "error" });
    }
  }

  async function saveTrigger() {
    if (!editingTrigger) return;
    const method = editingTrigger.id ? "PATCH" : "POST";
    const url = editingTrigger.id ? `/api/dashboard/dm-triggers/${editingTrigger.id}` : "/api/dashboard/dm-triggers";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTrigger),
      });
      if (res.ok) {
        setToast({ msg: editingTrigger.id ? "Trigger updated" : "Trigger created", type: "success" });
        setShowTriggerModal(false);
        setEditingTrigger(null);
        fetchData();
      } else throw new Error("Failed to save");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to save", type: "error" });
    }
  }

  function openTriggerModal(trigger?: DMTrigger) {
    setEditingTrigger(trigger || {
      id: "",
      keywords: { set: ["link", "price", "buy", "dm", "how much"], semantic: true },
      replyTemplate: "Thanks for your interest! Here's the link: {{link}}",
      mode: "semi",
      cooldownHours: 24,
      dailyCap: 50,
      enabled: true,
      createdAt: "",
    });
    setShowTriggerModal(true);
  }

  async function toggleTrigger(id: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/dashboard/dm-triggers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) fetchData();
      else throw new Error("Failed to toggle");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to toggle", type: "error" });
    }
  }

  async function deleteTrigger(id: string) {
    if (!confirm("Delete this trigger?")) return;
    try {
      const res = await fetch(`/api/dashboard/dm-triggers/${id}`, { method: "DELETE" });
      if (res.ok) {
        setToast({ msg: "Trigger deleted", type: "success" });
        fetchData();
      } else throw new Error("Failed to delete");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to delete", type: "error" });
    }
  }

  function analyzeSentiment(text: string) {
    const positive = ["thanks", "thank you", "great", "love", "awesome", "amazing", "perfect", "yes", "interested", "want", "need"];
    const negative = ["no", "not interested", "spam", "scam", "fake", "hate", "worst", "bad", "unsubscribe", "stop"];
    const lower = text.toLowerCase();
    let score = 0;
    positive.forEach((w) => { if (lower.includes(w)) score += 1; });
    negative.forEach((w) => { if (lower.includes(w)) score -= 1; });
    if (score > 0) return { score, label: "positive" as const };
    if (score < 0) return { score, label: "negative" as const };
    return { score, label: "neutral" as const };
  }

  const sentimentColors: Record<string, string> = { positive: "text-signal", negative: "text-danger", neutral: "text-bone-3" };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">DM Inbox</h1>
          <p className="text-sm text-bone-3">Comment → DM automation — unified inbox for all platforms</p>
        </div>
        <div className="grid-dots flex items-center justify-center py-16">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 text-signal animate-spin" />
            <span className="label text-bone-3">Loading DM inbox…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">DM Inbox</h1>
          <p className="text-sm text-bone-3">Comment → DM automation — unified inbox for all platforms</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openTriggerModal()} className="btn-signal flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            New trigger
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(["queued", "sent", "failed", "blocked", "draft"] as DMStatus[]).map((status) => {
          const count = messages.filter((m) => m.status === status).length;
          const cfg = STATUS_CONFIG[status];
          return (
            <div key={status} className="panel p-4">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${cfg.color}/10`} style={{ color: cfg.color.replace("bg-", "") }}>
                  <cfg.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-2xl font-semibold text-bone">{count}</p>
                  <p className="text-xs text-bone-3">{cfg.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="panel p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Filter className="h-4 w-4 text-bone-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search handle, keyword, message..."
              className="field flex-1"
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as DMStatus)} className="field w-36">
            <option value="all">All statuses</option>
            <option value="queued">Queued</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="blocked">Blocked</option>
          </select>
          <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} className="field w-36">
            <option value="all">All platforms</option>
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
            <option value="x">X</option>
          </select>
        </div>
      </div>

      {/* DM List */}
      <div className="space-y-3">
        {filteredMessages.length === 0 ? (
          <div className="grid-dots rounded-xl border border-dashed border-ink-4 px-6 py-16 text-center">
            <span className="label rounded border border-ink-4 bg-ink-2 px-2 py-1 text-amber">
              No DMs found
            </span>
            <p className="mt-5 text-lg font-medium text-bone-2">
              {messages.length === 0 ? "No DMs yet — triggers will create them when comments match" : "Try adjusting filters"}
            </p>
          </div>
        ) : (
          <Fragment>
            {filteredMessages.map((msg) => {
              const cfg = STATUS_CONFIG[msg.status];
              const sentiment = analyzeSentiment(msg.body);
              const PlatformIcon = PLATFORM_ICONS[msg.platform];

              return (
                <div key={msg.id} className="panel p-4 hover:border-ink-4 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cfg.color}/10`}>
                        <PlatformIcon className="h-5 w-5" style={{ color: cfg.color.replace("bg-", "") }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${cfg.color} text-white`}>
                            <cfg.icon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                          <span className="text-xs text-bone-3">{msg.platform}</span>
                          <span className="text-xs text-bone-3">{MODE_LABELS[msg.approvalMode]}</span>
                        </div>
                        <p className="mt-1 font-medium truncate text-bone">@{msg.recipientHandle}</p>
                        <p className="mt-1 text-sm text-bone-2 line-clamp-2">{msg.body}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-bone-3">
                          <span>Trigger: &ldquo;{msg.triggerKeyword}&rdquo;</span>
                          <span className={sentimentColors[sentiment.label]}>Sentiment: {sentiment.label}</span>
                          <span>{formatRelativeTime(msg.createdAt)}</span>
                          {msg.uniqueLinkCode && <span className="font-mono text-signal">{msg.uniqueLinkCode}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {["draft", "queued", "approved"].includes(msg.status) && (
                        <button
                          onClick={() => suggestDM(msg)}
                          disabled={suggesting === msg.id}
                          className="btn-ghost text-xs flex items-center gap-1"
                          title="Suggest a reply in your character's voice (rules-v1)"
                        >
                          {suggesting === msg.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          AI suggest
                        </button>
                      )}
                      {msg.status === "draft" && (
                        <>
                          <button onClick={() => editDM(msg.id)} className="btn-ghost text-xs" title="Edit">
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => approveDM(msg.id)} disabled={approving === msg.id} className="btn-signal text-xs flex items-center gap-1">
                            {approving === msg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            Approve
                          </button>
                          <button onClick={() => rejectDM(msg.id)} className="btn-ghost text-xs text-danger" title="Reject">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {msg.status === "approved" && (
                        <button onClick={() => sendDM(msg.id)} disabled={sending === msg.id} className="btn-signal text-xs flex items-center gap-1">
                          {sending === msg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Send now
                        </button>
                      )}
                      {msg.status === "queued" && (
                        <span className="label rounded border border-amber/40 bg-amber/10 px-1.5 py-0.5 text-amber">Pending approval</span>
                      )}
                      {msg.status === "sent" && msg.clickAt && (
                        <span className="label rounded border border-signal/40 bg-signal/10 px-1.5 py-0.5 text-signal">Clicked</span>
                      )}
                      {msg.status === "blocked" && (
                        <span className="label rounded border border-gray/40 bg-gray/10 px-1.5 py-0.5 text-gray">Blocked</span>
                      )}
                      <button className="btn-ghost text-xs p-1.5" title="View details">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Edit mode */}
                  {editingId === msg.id && (
                    <div className="mt-3 flex gap-2">
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="field flex-1 min-h-[80px] font-mono text-sm"
                        placeholder="Edit DM body..."
                      />
                      <button onClick={saveEdit} className="btn-signal">
                        <Check className="h-4 w-4 mr-1.5" />
                        Save
                      </button>
                      <button onClick={() => { setEditingId(null); setEditBody(""); }} className="btn-ghost">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </Fragment>
        )}
      </div>

      {/* Triggers Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight">DM Triggers</h2>
          <button onClick={() => openTriggerModal()} className="btn-signal text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New trigger
          </button>
        </div>

        {triggers.length === 0 ? (
          <div className="grid-dots rounded-xl border border-dashed border-ink-4 px-6 py-12 text-center">
            <span className="label rounded border border-ink-4 bg-ink-2 px-2 py-1 text-amber">No triggers configured</span>
            <p className="mt-3 text-bone-2">Create a trigger to auto-send DMs when comments match keywords</p>
          </div>
        ) : (
          <div className="space-y-3">
            {triggers.map((t) => (
              <div key={t.id} className="panel p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.enabled ? "bg-signal/10" : "bg-ink-2"}`}>
                    <MessageSquare className={`h-5 w-5 ${t.enabled ? "text-signal" : "text-bone-3"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium truncate">{t.postId ? `Post: ${t.postId.slice(0, 8)}` : "Global trigger"}</h3>
                      <span className={`label rounded px-2 py-0.5 ${t.enabled ? "border-signal/40 bg-signal/10 text-signal" : "border-ink-4 bg-ink text-bone-3"}`}>
                        {t.enabled ? "Active" : "Inactive"}
                      </span>
                      <span className="text-xs text-bone-3">Mode: {t.mode}</span>
                      <span className="text-xs text-bone-3">Cooldown: {t.cooldownHours}h</span>
                      <span className="text-xs text-bone-3">Daily cap: {t.dailyCap}</span>
                    </div>
                    <p className="mt-1 text-sm text-bone-3 truncate">Keywords: {t.keywords.set.join(", ")} {t.keywords.semantic ? " + semantic" : ""}</p>
                    <p className="mt-1 text-xs text-bone-4 font-mono">Template: {t.replyTemplate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={t.enabled}
                      onChange={(e) => toggleTrigger(t.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors ${t.enabled ? "bg-signal" : "bg-ink-3"}`}>
                      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${t.enabled ? "translate-x-5" : ""}`} />
                    </div>
                  </label>
                  <button onClick={() => openTriggerModal(t)} className="btn-ghost text-xs">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteTrigger(t.id)} className="btn-ghost text-xs text-danger">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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

      {/* Trigger Modal */}
      {showTriggerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-ink-3">
              <h2 className="text-lg font-semibold">{editingTrigger?.id ? "Edit trigger" : "New trigger"}</h2>
              <button onClick={() => { setShowTriggerModal(false); setEditingTrigger(null); }} className="btn-ghost">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label text-bone-3">Post ID (optional)</label>
                <input
                  type="text"
                  value={editingTrigger?.postId || ""}
                  onChange={(e) => setEditingTrigger((prev) => prev ? { ...prev, postId: e.target.value } : null)}
                  placeholder="Leave empty for global trigger"
                  className="field mt-1.5"
                />
              </div>

              <div>
                <label className="label text-bone-3">Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={editingTrigger?.keywords.set.join(", ") || ""}
                  onChange={(e) => setEditingTrigger((prev) => prev ? { ...prev, keywords: { ...prev.keywords, set: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } } : null)}
                  placeholder="link, price, buy, dm, how much"
                  className="field mt-1.5"
                />
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={editingTrigger?.keywords.semantic || false}
                    onChange={(e) => setEditingTrigger((prev) => prev ? { ...prev, keywords: { ...prev.keywords, semantic: e.target.checked } } : null)}
                    className="h-4 w-4 rounded border-ink-4 text-signal focus:ring-signal"
                  />
                  <span className="text-sm text-bone-2">Enable semantic matching (understands &ldquo;how much?&rdquo; = price)</span>
                </label>
              </div>

              <div>
                <label className="label text-bone-3">Reply template</label>
                <textarea
                  value={editingTrigger?.replyTemplate || ""}
                  onChange={(e) => setEditingTrigger((prev) => prev ? { ...prev, replyTemplate: e.target.value } : null)}
                  placeholder="Thanks for your interest! Here's the link: {{link}}"
                  className="field mt-1.5 min-h-[80px]"
                />
                <p className="mt-1 text-xs text-bone-3">Use \u007B\u007Blink\u007D\u007D for the unique tracked link, \u007B\u007Bproduct\u007D\u007D for product name, \u007B\u007Bprice\u007D\u007D for price.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label text-bone-3">Approval mode</label>
                  <select
                    value={editingTrigger?.mode || "semi"}
                    onChange={(e) => setEditingTrigger((prev) => prev ? { ...prev, mode: e.target.value as "manual" | "semi" | "auto" } : null)}
                    className="field mt-1.5"
                  >
                    <option value="manual">Manual (approve each)</option>
                    <option value="semi">Semi (draft preview)</option>
                    <option value="auto">Auto (with limits)</option>
                  </select>
                </div>
                <div>
                  <label className="label text-bone-3">Cooldown (hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={editingTrigger?.cooldownHours || 24}
                    onChange={(e) => setEditingTrigger((prev) => prev ? { ...prev, cooldownHours: parseInt(e.target.value) || 24 } : null)}
                    className="field mt-1.5"
                  />
                </div>
                <div>
                  <label className="label text-bone-3">Daily cap</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={editingTrigger?.dailyCap || 50}
                    onChange={(e) => setEditingTrigger((prev) => prev ? { ...prev, dailyCap: parseInt(e.target.value) || 50 } : null)}
                    className="field mt-1.5"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingTrigger?.enabled ?? true}
                  onChange={(e) => setEditingTrigger((prev) => prev ? { ...prev, enabled: e.target.checked } : null)}
                  className="h-4 w-4 rounded border-ink-4 text-signal focus:ring-signal"
                />
                <span className="text-sm text-bone-2">Enabled</span>
              </label>

              <div className="flex justify-end gap-2 pt-4 border-t border-ink-3">
                <button onClick={() => { setShowTriggerModal(false); setEditingTrigger(null); }} className="btn-ghost">
                  Cancel
                </button>
                <button onClick={saveTrigger} className="btn-signal flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {editingTrigger?.id ? "Save changes" : "Create trigger"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}