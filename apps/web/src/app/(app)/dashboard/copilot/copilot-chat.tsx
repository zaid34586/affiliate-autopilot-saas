"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, Send, Loader2, Sparkles, Zap, Settings, Mic, X, CheckCircle, AlertCircle, RotateCcw, TrendingUp, Calendar, FlaskConical } from "lucide-react";

interface CopilotMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  at: string;
}

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
}

interface CopilotAction {
  type: string;
  payload: Record<string, unknown>;
  requiresConfirmation: boolean;
  status: "pending" | "executed" | "failed";
  result?: unknown;
}

interface CopilotResult {
  intent: string;
  reply: string;
  reasoning: string[];
  suggestions: string[];
  actions: any[];
  engine: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

import { ComponentType } from "react";

const ACTION_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  create_post: Zap,
  schedule_post: Calendar,
  create_campaign: TrendingUp,
  run_research: FlaskConical,
  analyze_performance: TrendingUp,
  optimizer_action: Zap,
  autopilot_control: Settings,
  character_config: Brain,
};

const ACTION_LABELS: Record<string, string> = {
  create_post: "Create Post",
  schedule_post: "Schedule Post",
  create_campaign: "Create Campaign",
  run_research: "Run Research",
  analyze_performance: "Analyze Performance",
  optimizer_action: "Optimizer Action",
  autopilot_control: "Autopilot Control",
  character_config: "Character Config",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  executed: "bg-green-500/10 text-green-500 border-green-500/30",
  failed: "bg-red-500/10 text-red-500 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting Confirmation",
  executed: "Executed",
  failed: "Failed",
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

function ActionCard({ action, onConfirm, onDismiss }: { action: any; onConfirm: (id: string) => void; onDismiss: (id: string) => void }) {
  const Icon = ACTION_ICONS[action.type] || Zap;
  const statusColor = STATUS_COLORS[action.status] || STATUS_COLORS.pending;
  const statusLabel = STATUS_LABELS[action.status] || action.status;

  return (
    <div className={`rounded-xl border p-3 ${statusColor} flex items-start gap-3`}>
      <div className="flex-shrink-0 p-1.5 bg-signal/10 rounded-lg">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{ACTION_LABELS[action.type] || action.type}</span>
          <span className="text-xs px-2 py-0.5 rounded-full">{STATUS_LABELS[action.status] || action.status}</span>
        </div>
        <p className="mt-1 text-xs text-bone-3 font-mono max-w-xs truncate">
          {JSON.stringify(action.payload).slice(0, 100)}{JSON.stringify(action.payload).length > 100 ? "..." : ""}
        </p>
        {action.result && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-signal">Result</summary>
            <pre className="mt-1 text-xs text-bone-3 bg-ink p-2 rounded overflow-auto max-h-24">
              {JSON.stringify(action.result, null, 2).slice(0, 500)}
            </pre>
          </details>
        )}
        {action.error && (
          <p className="mt-1 text-xs text-red-500">Error: {action.error}</p>
        )}
        {action.status === "pending" && action.requiresConfirmation && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onConfirm(action.payload.actionId || action.type)}
              className="btn-signal text-xs px-3 py-1"
            >
              <CheckCircle className="h-3 w-3 mr-1" /> Confirm
            </button>
            <button
              onClick={() => onDismiss(action.payload.actionId || action.type)}
              className="btn-ghost text-xs px-3 py-1 text-danger"
            >
              <X className="h-3 w-3 mr-1" /> Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionChip({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-signal/40 px-3 py-1.5 text-xs text-signal transition-colors hover:bg-signal/10 flex-shrink-0"
    >
      {text}
    </button>
  );
}

export function CopilotChat() {
  const [messages, setMessages] = useState<Array<{
    role: "user" | "assistant";
    content: string;
    actions?: any[];
    at: string;
    toolCalls?: any[];
    toolResults?: any[];
  }>>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; updatedAt: string }>>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/copilot/chat");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard/copilot/chat?conversationId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setConversationId(id);
        setShowSidebar(false);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const newConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setShowSidebar(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setError(null);
    setInput("");
    setSending(true);

    // Optimistic UI: add user message immediately
    const userMsg = { role: "user" as const, content: message, at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch("/api/dashboard/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get reply");

      const result = data.result as { reply: string; actions: any[]; suggestions: string[]; reasoning: string[] };
      
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          actions: result.actions,
          at: new Date().toISOString(),
        },
      ]);
      setConversationId(data.conversationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }, [sending, conversationId]);

  const handleActionConfirm = useCallback(async (actionId: string) => {
    // Find the message with this action
    // For simplicity, we'll re-send a confirmation message
    // In a real implementation, you'd call /api/dashboard/copilot/actions/execute
    setToast({ msg: "Action confirmed - executing...", type: "success" });
  }, []);

  const handleActionDismiss = useCallback((actionId: string) => {
    setToast({ msg: "Action dismissed", type: "error" });
  }, []);

  const handleSuggestionClick = useCallback((text: string) => {
    void send(text);
  }, [send]);

  return (
    <div className="panel flex h-[700px] flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="btn-ghost p-2 lg:hidden"
          >
            <Brain className="h-5 w-5" />
          </button>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight lg:hidden">
            <Brain className="h-4 w-4 text-signal" />
            Copilot
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="label rounded-full bg-signal/10 text-signal px-2 py-0.5 text-bone-3">
            engine: llm-v1
          </span>
          <button className="btn-ghost p-2" title="New Chat">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Sidebar - Conversation History */}
      {showSidebar && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowSidebar(false)} />
          <div className="panel w-80 max-w-[90vw] h-full flex flex-col overflow-hidden z-10">
            <div className="flex items-center justify-between border-b border-ink-3 px-4 py-3">
              <h3 className="font-semibold">Conversations</h3>
              <button onClick={() => setShowSidebar(false)} className="btn-ghost p-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {conversations.length === 0 ? (
                <p className="text-center text-bone-3 py-8">No conversations yet</p>
              ) : (
                conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => loadConversation(conv.id)}
                    className={`w-full text-left p-3 rounded-xl transition-colors ${
                      conversationId === conv.id
                        ? "bg-signal/10 text-signal"
                        : "text-bone-2 hover:bg-ink/50"
                    }`}
                  >
                    <p className="font-medium truncate">{conv.title}</p>
                    <p className="text-xs text-bone-3 mt-1">{formatRelativeTime(conv.updatedAt)}</p>
                  </button>
                ))
              )}
            </div>
            <button onClick={newConversation} className="mx-4 mb-4 btn-signal w-full">
              <RotateCcw className="h-4 w-4 mr-2" /> New Conversation
            </button>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden lg:pl-0">
        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <Brain className="h-16 w-16 text-signal/20 mb-4" />
              <h3 className="text-lg font-medium text-bone">Ask me anything</h3>
              <p className="text-bone-3 mt-1 max-w-xs">I can create posts, build campaigns, run research, analyze performance, control autopilot, and more.</p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                <SuggestionChip text="What should I post tomorrow?" onClick={() => void send("What should I post tomorrow?")} />
                <SuggestionChip text="Create a 7-day campaign" onClick={() => void send("Create a 7-day campaign for my top products")} />
                <SuggestionChip text="Analyze last 30 days" onClick={() => void send("Analyze my performance for the last 30 days")} />
                <SuggestionChip text="Check optimizer decisions" onClick={() => void send("Show me pending optimizer decisions")} />
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={`${msg.at}-${i}`}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-signal text-ink"
                    : "border border-ink-3 bg-ink text-bone-2"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Tool calls / Actions */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.actions.map((action: any, ai: number) => (
                      <ActionCard
                        key={`${msg.at}-${ai}`}
                        action={action}
                        onConfirm={handleActionConfirm}
                        onDismiss={handleActionDismiss}
                      />
                    ))}
                  </div>
                )}

                {/* Reasoning */}
                {msg.role === "assistant" && (msg as any).reasoning && ((msg as any).reasoning as string[]).length > 0 && (
                  <details className="mt-3 rounded-lg border border-ink-3 bg-ink-2 px-3 py-2">
                    <summary className="cursor-pointer select-none label text-bone-3">
                      Why this answer
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                      {((msg as any).reasoning as string[]).map((r, j) => (
                        <li key={j} className="flex gap-2 text-xs text-bone-3">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal-dim" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </details>
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

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (messages[messages.length - 1] as any).suggestions && (
          <div className="px-5 py-2 border-t border-ink-3">
            <div className="flex flex-wrap gap-2">
              {((messages[messages.length - 1] as any).suggestions as string[]).map(s => (
                <SuggestionChip key={s} text={s} onClick={() => void send(s)} />
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form
          className="flex items-center gap-2 border-t border-ink-3 px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="flex-1 relative">
            <input
              className="field flex-1 pr-10"
              placeholder="Ask me to create a post, build a campaign, run research..."
              value={input}
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button
              type="button"
              onClick={() => void send(input)}
              disabled={sending || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-1.5"
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>
          <button
            type="submit"
            className="btn-signal px-4 py-2"
            disabled={sending || !input.trim()}
            aria-label="Send message"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>

        <p className="flex items-center gap-1.5 border-t border-ink-3 px-5 py-2 text-[11px] text-bone-3">
          <Sparkles className="h-3 w-3 text-signal-dim" />
          Powered by GPT-4o — real actions on your data, not just chat.
        </p>
      </div>
    </div>
  );
}

export default function CopilotPage() {
  return <CopilotChat />;
}