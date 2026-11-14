"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, Loader2, Send, Sparkles } from "lucide-react";

interface ChatMessage {
  role: "user" | "character";
  content: string;
  at: string;
}

interface DiscussResult {
  intent: string;
  reply: string;
  reasoning: string[];
  suggestions: string[];
  engine: string;
}

interface ChatItem {
  role: "user" | "character";
  content: string;
  at: string;
  reasoning?: string[];
  suggestions?: string[];
}

const WELCOME: ChatItem = {
  role: "character",
  content:
    "Ask me anything about your strategy — what to post tomorrow, how the numbers looked, or what we earned. Every answer is backed by your actual data.",
  at: new Date().toISOString(),
  reasoning: ["This is a rules-v1 engine: deterministic, data-backed answers. An LLM swap arrives when your API key is configured."],
  suggestions: ["Kal kya post karein?", "How did performance look?", "What did we earn?"],
};

export function CharacterChat() {
  const [items, setItems] = useState<ChatItem[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load persisted history once on mount.
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard/character/chat");
        if (!res.ok) return;
        const data = (await res.json()) as { chat?: ChatMessage[] };
        if (data.chat && data.chat.length > 0) {
          setItems([
            WELCOME,
            ...data.chat.map((m) => ({
              role: m.role,
              content: m.content,
              at: m.at,
            })),
          ]);
        }
      } catch {
        /* history is optional — keep welcome message */
      }
    }
    void load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, sending]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || sending) return;
      setError(null);
      setInput("");
      setSending(true);
      setItems((prev) => [
        ...prev,
        { role: "user", content: message, at: new Date().toISOString() },
      ]);

      try {
        const res = await fetch("/api/dashboard/character/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to get a reply");
        }
        const result = data.result as DiscussResult;
        setItems((prev) => [
          ...prev,
          {
            role: "character",
            content: result.reply,
            at: new Date().toISOString(),
            reasoning: result.reasoning,
            suggestions: result.suggestions,
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setSending(false);
      }
    },
    [sending],
  );

  return (
    <div className="panel flex h-[560px] flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between border-b border-ink-3 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Brain className="h-4 w-4 text-signal" />
          Discuss with your character
        </h2>
        <span className="label rounded-full border border-ink-3 px-2 py-0.5 text-bone-3">
          engine: rules-v1
        </span>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {items.map((item, i) => (
          <div
            key={`${item.at}-${i}`}
            className={item.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                item.role === "user"
                  ? "bg-signal text-ink"
                  : "border border-ink-3 bg-ink text-bone-2"
              }`}
            >
              <p>{item.content}</p>

              {item.role === "character" && item.reasoning && (
                <details className="mt-3 rounded-lg border border-ink-3 bg-ink-2 px-3 py-2">
                  <summary className="cursor-pointer select-none label text-bone-3">
                    Why this answer
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {item.reasoning.map((r, j) => (
                      <li key={j} className="flex gap-2 text-xs text-bone-3">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal-dim" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {item.role === "character" && item.suggestions && i === items.length - 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="rounded-full border border-signal/40 px-3 py-1 text-xs text-signal transition-colors hover:bg-signal/10"
                      onClick={() => void send(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-xl border border-ink-3 bg-ink px-4 py-3 text-sm text-bone-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </div>
          </div>
        )}

        {error && (
          <p className="text-center text-xs text-danger">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* input */}
      <form
        className="flex items-center gap-2 border-t border-ink-3 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          className="field flex-1"
          placeholder="Kal kya post karein? / How did we do this week?"
          value={input}
          maxLength={500}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="btn-signal px-4 py-2"
          disabled={sending || !input.trim()}
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>

      <p className="flex items-center gap-1.5 border-t border-ink-3 px-5 py-2 text-[11px] text-bone-3">
        <Sparkles className="h-3 w-3 text-signal-dim" />
        Answers use your real analytics and catalog — no projected numbers.
      </p>
    </div>
  );
}
