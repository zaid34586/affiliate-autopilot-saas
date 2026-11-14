"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldOff,
  ThumbsDown,
  Zap,
} from "lucide-react";

type ApprovalMode = "off" | "manual" | "semi" | "auto";

interface CommentRow {
  id: string;
  platform: string;
  authorHandle: string;
  body: string;
  sentiment: string | null;
  suggestedReply: string | null;
  status: string;
  approvalMode: string;
  repliedAt: string | null;
  createdAt: string;
  postTitle: string | null;
}

const SENTIMENT_STYLE: Record<string, string> = {
  positive: "border-signal/40 bg-signal/10 text-signal",
  neutral: "border-ink-3 bg-ink text-bone-3",
  negative: "border-danger/40 bg-danger/10 text-danger",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Needs approval",
  approved: "Approved",
  replied: "Replied",
  dismissed: "Dismissed",
};

export function CommentsInbox() {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [mode, setMode] = useState<ApprovalMode>("semi");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // test-ingest form
  const [testHandle, setTestHandle] = useState("");
  const [testBody, setTestBody] = useState("");
  const [ingesting, setIngesting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        fetch("/api/dashboard/comments"),
        fetch("/api/dashboard/character/settings"),
      ]);
      if (cRes.ok) {
        const data = await cRes.json();
        setComments(data.comments ?? []);
      }
      if (sRes.ok) {
        const data = await sRes.json();
        setMode(data.settings?.comments ?? "semi");
      }
    } catch {
      setToast({ msg: "Failed to load comments", type: "error" });
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

  async function saveMode(next: ApprovalMode) {
    const prev = mode;
    setMode(next);
    try {
      const res = await fetch("/api/dashboard/character/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: next }),
      });
      if (!res.ok) throw new Error("save failed");
      setToast({ msg: `Comment replies: ${next}`, type: "success" });
    } catch {
      setMode(prev);
      setToast({ msg: "Failed to save setting", type: "error" });
    }
  }

  async function act(id: string, action: "reply" | "dismiss") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/dashboard/comments/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          action === "reply" && drafts[id]
            ? JSON.stringify({ reply: drafts[id] })
            : JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setToast({
        msg:
          action === "reply"
            ? "Reply marked as sent (sandbox delivery)"
            : "Comment dismissed",
        type: "success",
      });
      await load();
    } catch (e) {
      setToast({
        msg: e instanceof Error ? e.message : "Action failed",
        type: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function ingestTest() {
    if (!testHandle.trim() || !testBody.trim()) return;
    setIngesting(true);
    try {
      const res = await fetch("/api/dashboard/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "instagram",
          authorHandle: testHandle.trim(),
          body: testBody.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setToast({
        msg:
          data.status === "replied"
            ? "Auto-replied (sandbox delivery)"
            : data.status === "dismissed"
              ? "Stored without reply (settings off or blocked)"
              : "Comment queued for approval",
        type: "success",
      });
      setTestHandle("");
      setTestBody("");
      await load();
    } catch (e) {
      setToast({
        msg: e instanceof Error ? e.message : "Ingest failed",
        type: "error",
      });
    } finally {
      setIngesting(false);
    }
  }

  if (loading) {
    return (
      <div className="panel mt-6 flex items-center justify-between border-b border-ink-3 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <MessageCircle className="h-4 w-4 text-signal" />
          Audience comments
        </h2>
        <Loader2 className="h-4 w-4 text-bone-3 animate-spin" />
      </div>
    );
  }

  const pending = comments.filter((c) => c.status === "pending").length;

  return (
    <div className="panel mt-6">
      {/* header + approval level */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-3 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <MessageCircle className="h-4 w-4 text-signal" />
          Audience comments
          {pending > 0 && (
            <span className="label rounded-full bg-signal px-2 py-0.5 text-ink">
              {pending} to review
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <label className="label text-bone-3" htmlFor="comment-mode">
            Reply mode
          </label>
          <select
            id="comment-mode"
            className="field text-xs"
            value={mode}
            onChange={(e) => void saveMode(e.target.value as ApprovalMode)}
          >
            <option value="off">Off — never reply</option>
            <option value="manual">Manual — approve every reply</option>
            <option value="semi">Semi — pre-written, one click</option>
            <option value="auto">Auto — send safe replies itself</option>
          </select>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={() => void load()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* honest delivery note */}
      <p className="flex items-center gap-1.5 border-b border-ink-3 px-5 py-2 text-[11px] text-bone-3">
        <ShieldOff className="h-3 w-3 text-amber" />
        Replies are marked sent in sandbox mode until platform reply APIs are
        connected — never shown as live platform replies.
      </p>

      {/* list */}
      <div className="max-h-[420px] space-y-3 overflow-y-auto px-5 py-4">
        {comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-bone-3">
            No comments yet — they arrive from your published posts (or use the
            test box below).
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-ink-3 bg-ink p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-bone">
                  @{c.authorHandle}
                </span>
                <span className="label text-bone-3">{c.platform}</span>
                {c.sentiment && (
                  <span
                    className={`label rounded-full border px-2 py-0.5 ${SENTIMENT_STYLE[c.sentiment] ?? ""}`}
                  >
                    {c.sentiment}
                  </span>
                )}
                <span
                  className={`label ml-auto rounded-full border px-2 py-0.5 ${
                    c.status === "pending"
                      ? "border-amber/40 bg-amber/10 text-amber"
                      : c.status === "replied"
                        ? "border-signal/40 bg-signal/10 text-signal"
                        : "border-ink-3 text-bone-3"
                  }`}
                >
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>

              <p className="mt-2 text-sm text-bone-2">{c.body}</p>
              {c.postTitle && (
                <p className="label mt-1 text-bone-3">on: {c.postTitle}</p>
              )}

              {c.status === "pending" && c.suggestedReply && (
                <div className="mt-3">
                  <p className="label text-bone-3">Suggested reply (editable)</p>
                  <textarea
                    className="field mt-1.5 min-h-[64px] w-full text-sm"
                    value={drafts[c.id] ?? c.suggestedReply}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="btn-signal px-3 py-1.5 text-xs"
                      disabled={busyId === c.id}
                      onClick={() => void act(c.id, "reply")}
                    >
                      {busyId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Approve &amp; send
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1.5 text-xs"
                      disabled={busyId === c.id}
                      onClick={() => void act(c.id, "dismiss")}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {c.status === "replied" && (
                <p className="mt-2 text-xs text-bone-3">
                  Reply: {c.suggestedReply}
                  {c.repliedAt &&
                    ` · ${new Date(c.repliedAt).toLocaleString("en-US")}`}
                  <span className="label ml-2 rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 text-amber">
                    sandbox delivery
                  </span>
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* test ingest (honest label) */}
      <div className="border-t border-ink-3 px-5 py-4">
        <p className="label flex items-center gap-1.5 text-bone-3">
          <Zap className="h-3 w-3 text-signal-dim" />
          Test incoming comment (for your own testing — platform webhooks
          replace this once connected)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="field w-40 text-sm"
            placeholder="@handle"
            value={testHandle}
            onChange={(e) => setTestHandle(e.target.value)}
          />
          <input
            className="field min-w-[220px] flex-1 text-sm"
            placeholder="Comment text… (try: kitne ka hai? or love it!)"
            value={testBody}
            onChange={(e) => setTestBody(e.target.value)}
          />
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            disabled={ingesting || !testHandle.trim() || !testBody.trim()}
            onClick={() => void ingestTest()}
          >
            {ingesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Inject
          </button>
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
