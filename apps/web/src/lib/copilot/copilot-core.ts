/**
 * Phase 6 Module C — AI Copilot Core (Pure Logic).
 * Intent classification + reply building + action planning.
 * No DB access — unit-testable. DB orchestration in copilot.ts.
 */

export type CopilotIntent =
  | "chat"
  | "create_post"
  | "schedule_post"
  | "create_campaign"
  | "run_research"
  | "analyze_performance"
  | "optimizer_action"
  | "character_config"
  | "autopilot_control"
  | "general";

export interface CopilotContext {
  characterName: string;
  characterId: string;
  niche: string | null;
  tone: string | null;
  autopilotLevel: string;
  autopilotPaused: boolean;
  last7: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  };
  postsLast7: number;
  topProducts: Array<{
    id: string;
    title: string;
    aiScore: number | null;
    commissionValue: string | null;
    commissionType: string | null;
  }>;
  lastJournal: string | null;
  recentPosts: Array<{
    id: string;
    platform: string;
    title: string;
    status: string;
    ctr: number | null;
  }>;
  pendingOptimizerDecisions: number;
  activeABTests: number;
}

export interface CopilotAction {
  type: "create_post" | "schedule_post" | "create_campaign" | "run_research" | "analyze_performance" | "optimizer_action" | "autopilot_control" | "character_config";
  payload: Record<string, unknown>;
  requiresConfirmation: boolean;
  status: "pending" | "executed" | "failed";
  result?: unknown;
}

export interface CopilotResult {
  intent: CopilotIntent;
  reply: string;
  reasoning: string[];
  suggestions: string[];
  actions: CopilotAction[];
  engine: "llm-v1";
  conversationId?: string;
}

export interface CopilotMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  at: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
}

// ============================================
// INTENT CLASSIFICATION (Enhanced with LLM fallback)
// ============================================

const INTENT_KEYWORDS: Record<CopilotIntent, string[]> = {
  create_post: [
    "create post", "new post", "make post", "post banao", "post karo",
    "schedule post", "publish post", "post karna", "content banao",
  ],
  schedule_post: [
    "schedule", "publish at", "post at", "time post", "when to post",
    "kal post", "schedule karo", "publish karo",
  ],
  create_campaign: [
    "campaign", "campaign banao", "plan campaign", "multi day", "week plan",
    "7 day plan", "monthly plan", "content plan", "campaign plan",
  ],
  run_research: [
    "research", "research karo", "find products", "find new products",
    "product research", "niche research", "trending products",
  ],
  analyze_performance: [
    "performance", "analytics", "stats", "numbers", "how did we do",
    "kaisa raha", "chala kaisa", "report", "metrics",
  ],
  optimizer_action: [
    "optimizer", "boost", "pause", "remix", "ab test", "a/b test",
    "decisions", "optimizer decisions", "winning", "losing",
  ],
  autopilot_control: [
    "autopilot", "pause autopilot", "resume autopilot", "autopilot level",
    "daily caps", "quiet hours", "circuit breaker", "auto pilot",
  ],
  character_config: [
    "character", "personality", "tone", "voice", "character name",
    "my character", "change character", "update character",
  ],
  chat: [
    "chat", "talk", "discuss", "ask", "question", "help", "kaise",
    "what", "why", "how", "kya", "kyun",
  ],
  general: [],
};

export function classifyCopilotIntent(message: string): CopilotIntent {
  const m = message.toLowerCase();
  const has = (...words: string[]) => words.some(w => m.includes(w));

  // Check specific action intents first (more specific)
  if (has(...INTENT_KEYWORDS.create_post)) return "create_post";
  if (has(...INTENT_KEYWORDS.schedule_post)) return "schedule_post";
  if (has(...INTENT_KEYWORDS.create_campaign)) return "create_campaign";
  if (has(...INTENT_KEYWORDS.run_research)) return "run_research";
  if (has(...INTENT_KEYWORDS.analyze_performance)) return "analyze_performance";
  if (has(...INTENT_KEYWORDS.optimizer_action)) return "optimizer_action";
  if (has(...INTENT_KEYWORDS.autopilot_control)) return "autopilot_control";
  if (has(...INTENT_KEYWORDS.character_config)) return "character_config";
  
  // Default to chat for conversational queries
  if (has(...INTENT_KEYWORDS.chat)) return "chat";
  
  return "general";
}

// ============================================
// ACTION PLANNING HELPERS
// ============================================

export function requiresConfirmation(actionType: string): boolean {
  const confirmingActions = [
    "create_post",
    "schedule_post", 
    "create_campaign",
    "optimizer_action",
    "autopilot_control",
  ];
  return confirmingActions.includes(actionType);
}

export function getActionDescription(action: { type: string; payload: Record<string, unknown> }): string {
  switch (action.type) {
    case "create_post":
      return `Create post for ${action.payload.productId} on ${action.payload.platform}`;
    case "schedule_post":
      return `Schedule post ${action.payload.postId} for ${action.payload.scheduledAt}`;
    case "create_campaign":
      return `Create ${action.payload.durationDays}-day campaign with ${action.payload.postsPerDay} posts/day`;
    case "run_research":
      return `Run product research for "${action.payload.query || action.payload.niche || 'general'}"`;
    case "analyze_performance":
      return `Analyze last ${action.payload.days || 7} days performance`;
    case "optimizer_action":
      return `Optimizer: ${action.payload.action}`;
    case "autopilot_control":
      return `Autopilot: ${action.payload.action}`;
    case "character_config":
      return `Character: ${action.payload.action}`;
    default:
      return action.type;
  }
}

// ============================================
// REASONING HELPERS
// ============================================

export function buildReasoning(
  intent: CopilotIntent,
  context: {
    hasData: boolean;
    autopilotPaused: boolean;
    autopilotLevel: string;
    topProduct?: { title: string; aiScore: number | null };
    postsLast7: number;
    last7: { impressions: number; clicks: number; conversions: number; revenue: number };
  }
): string[] {
  const reasoning: string[] = [];
  const fmt = (n: number) => n.toLocaleString();

  switch (intent) {
    case "create_post":
      if (context.topProduct) {
        reasoning.push(`Recommending top product: ${context.topProduct.title} (AI score: ${context.topProduct.aiScore ?? "n/a"}/100)`);
      }
      reasoning.push(`Autopilot is ${context.autopilotPaused ? "paused" : context.autopilotLevel} — ${context.autopilotPaused ? "resume to auto-publish" : "will pick up scheduled posts"}`);
      break;
    case "create_campaign":
      reasoning.push(`Campaign provides consistent daily content for ${context.postsLast7 > 0 ? "building on existing momentum" : "establishing new rhythm"}`);
      break;
    case "analyze_performance":
      if (context.last7.impressions > 0) {
        const ctr = (context.last7.clicks / context.last7.impressions * 100).toFixed(2);
        const ctrNum = parseFloat(ctr);
        reasoning.push(`CTR: ${ctr}% — ${ctrNum < 1 ? "needs hook improvement" : "healthy for short-form"}`);
      }
      break;
    case "optimizer_action":
      reasoning.push(`Optimizer found ${context.postsLast7} posts with data to analyze`);
      break;
    case "autopilot_control":
      reasoning.push(`Current level: ${context.autopilotLevel} ${context.autopilotPaused ? "(paused)" : ""}`);
      break;
  }
  return reasoning;
}

// ============================================
// SUGGESTION GENERATORS
// ============================================

export function generateSuggestions(intent: CopilotIntent, context: CopilotContext): string[] {
  const base = [
    "What should I post tomorrow?",
    "Run product research",
    "Analyze performance",
  ];

  switch (intent) {
    case "create_post":
      return [
        "Schedule it for tomorrow morning",
        "Create a campaign around this product",
        "Test a different hook",
      ];
    case "create_campaign":
      return [
        "Schedule the first post now",
        "Add more products to the campaign",
        "Adjust posting frequency",
      ];
    case "analyze_performance":
      return [
        "Show per-platform breakdown",
        "Check optimizer decisions",
        "Create campaign from top products",
      ];
    case "optimizer_action":
      return [
        "Execute all boost decisions",
        "Review paused posts",
        "Check A/B test results",
      ];
    case "autopilot_control":
      return [
        "Set daily caps per platform",
        "Review quiet hours",
        "Check circuit breakers",
      ];
    case "run_research":
      return [
        "Add found products to catalog",
        "Create campaign from new products",
        "Set up autopilot for new niche",
      ];
    default: {
      const hasData = context.last7.impressions > 0 || context.last7.clicks > 0 || context.last7.conversions > 0;
      return hasData 
        ? [...base, "Check optimizer decisions", "Review A/B tests"]
        : [...base, "Complete onboarding", "Connect accounts"];
}
  }
}

export function productLine(p: { title: string; aiScore: number | null; commissionValue: string | null; commissionType: string | null }): string {
  const commission = p.commissionValue != null
    ? `${p.commissionType === "flat" ? "$" : ""}${p.commissionValue}${p.commissionType === "percentage" ? "%" : ""} commission`
    : "commission n/a";
  const score = p.aiScore != null ? `score ${p.aiScore}/100` : "unscored";
  return `"${p.title}" (${score}, ${commission})`;
}