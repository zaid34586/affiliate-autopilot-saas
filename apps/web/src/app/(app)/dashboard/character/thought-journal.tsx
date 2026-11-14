"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Loader2, RefreshCw, Sparkles } from "lucide-react";

interface JournalEntry {
  id: string;
  date: string;
  thoughtText: string;
  decision: string | null;
  confidence: number | null;
  reasoning: string[];
  createdAt: string;
}

function confidenceColor(c: number | null): string {
  if (c == null) return "border-ink-3 text-bone-3";
  if (c >= 70) return "border-signal/40 bg-signal/10 text-signal";
  if (c >= 40) return "border-amber/40 bg-amber/10 text-amber";
  return "border-danger/40 bg-danger/10 text-danger";
}

export function ThoughtJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reflecting, setReflecting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/character/journal");
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      /* journal is optional — keep what we have */
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

  async function reflectNow() {
    setReflecting(true);
    try {
      const res = await fetch("/api/dashboard/character/journal", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reflect");
      setToast({
        msg: data.entry?.created
          ? "Today's thought written"
          : "Today's thought refreshed",
        type: "success",
      });
      await load();
    } catch (e) {
      setToast({
        msg: e instanceof Error ? e.message : "Reflection failed",
        type: "error",
      });
    } finally {
      setReflecting(false);
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const hasToday = entries.some((e) => e.date === today);

  return (
    <div className="panel mt-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-3 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Brain className="h-4 w-4 text-signal" />
          Thought journal
          <span className="label rounded-full border border-ink-3 px-2 py-0.5 text-bone-3">
            engine: rules-v1
          </span>
        </h2>
        <button
          type="button"
          className="btn-signal flex items-center gap-2 px-3 py-1.5 text-xs"
          disabled={reflecting}
          onClick={() => void reflectNow()}
        >
          {reflecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {hasToday ? "Refresh today's thought" : "Write today's thought"}
        </button>
      </div>

      {/* honest note */}
      <p className="flex items-center gap-1.5 border-b border-ink-3 px-5 py-2 text-[11px] text-bone-3">
        <RefreshCw className="h-3 w-3 text-signal-dim" />
        Daily cron writes this at 05:00 UTC — every figure comes from your
        synced analytics, never a forecast.
      </p>

      {/* entries */}
      <div className="max-h-[420px] space-y-3 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 text-bone-3 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-bone-2">No thoughts yet.</p>
            <p className="mt-1 text-xs text-bone-3">
              Hit &ldquo;Write today&rsquo;s thought&rdquo; — or wait for the
              daily cron — and the character reflects on your real numbers.
            </p>
          </div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="rounded-xl border border-ink-3 bg-ink p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-bone">{e.date}</span>
                {e.confidence != null && (
                  <span
                    className={`label rounded-full border px-2 py-0.5 ${confidenceColor(e.confidence)}`}
                  >
                    confidence {e.confidence}/100
                  </span>
                )}
                {e.date === today && (
                  <span className="label rounded-full border border-signal/40 bg-signal/10 px-2 py-0.5 text-signal">
                    today
                  </span>
                )}
                <button
                  type="button"
                  className="label ml-auto rounded-full border border-ink-3 px-2 py-0.5 text-bone-3 transition-colors hover:border-ink-4"
                  onClick={() =>
                    setExpanded((prev) => (prev === e.id ? null : e.id))
                  }
                >
                  {expanded === e.id ? "hide why" : "why this thought"}
                </button>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-bone-2">
                {e.thoughtText}
              </p>

              {e.decision && (
                <p className="mt-2 rounded-lg border border-signal/30 bg-signal/5 px-3 py-2 text-xs text-signal">
                  <span className="label mr-1.5 text-bone-3">decision →</span>
                  {e.decision}
                </p>
              )}

              {expanded === e.id && e.reasoning.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-ink-3 pt-3">
                  {e.reasoning.map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs text-bone-3">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal-dim" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
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
