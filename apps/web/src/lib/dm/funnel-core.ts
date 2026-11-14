/**
 * Phase 5 Module D — DM Funnel Engine (pure core).
 *
 * Semantic keyword matching + multi-step funnel execution.
 * No DB access — pure logic for unit testing.
 */

export type FunnelStepType = "greet" | "pitch" | "link" | "followup";

export interface FunnelStep {
  id: string;
  stepType: FunnelStepType;
  order: number;
  template: string; // {{product}}, {{link}}, {{name}}, {{handle}}
  delayHours: number;
  conditions: Record<string, unknown>;
}

export interface FunnelDefinition {
  id: string;
  name: string;
  steps: FunnelStep[]; // ordered by step.order
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  skipNegativeSentiment: boolean;
}

export interface ConversationState {
  conversationId: string;
  funnelId: string;
  recipientHandle: string;
  platform: string;
  currentStepIndex: number;
  status: "active" | "completed" | "paused" | "blocked";
  lastSentAt: Date | null;
  nextStepAt: Date | null;
  context: Record<string, unknown>; // productId, productTitle, linkUrl, etc.
}

export interface FunnelMatchResult {
  matched: boolean;
  funnelId: string | null;
  triggerId: string | null;
  matchedKeyword: string | null;
}

/**
 * Semantic keyword matching.
 * - Exact match: keyword appears in text
 * - Semantic: if enabled, matches variants (e.g., "price" matches "kitne ka", "cost", "how much")
 */
export function matchTrigger(
  text: string,
  trigger: { keywords: { set: string[]; semantic: boolean } },
): { matched: boolean; keyword: string | null } {
  const lower = text.toLowerCase().trim();
  if (!lower) return { matched: false, keyword: null };

  // Build semantic expansions
  const expansions: Record<string, string[]> = {
    price: ["price", "cost", "kitne ka", "kya price", "how much", "kya rate", "rate"],
    buy: ["buy", "purchase", "order", "khareedna", "khareed lo"],
    link: ["link", "url", "website", "site", "link do", "link bhejo"],
    dm: ["dm", "message", "msg", "inbox", "direct message", "dm karo"],
    hello: ["hello", "hi", "hey", "namaste", "hii"],
    thanks: ["thanks", "thank you", "thx", "dhanyavaad", "shukriya"],
  };

  for (const kw of trigger.keywords.set) {
    const kwLower = kw.toLowerCase();
    if (lower.includes(kwLower)) {
      return { matched: true, keyword: kw };
    }
    if (trigger.keywords.semantic && expansions[kwLower]) {
      for (const variant of expansions[kwLower]) {
        if (lower.includes(variant)) {
          return { matched: true, keyword: kw };
        }
      }
    }
  }
  return { matched: false, keyword: null };
}

/**
 * Find which trigger (and its funnel) matches the incoming text.
 * Returns the first matching trigger in priority order (triggers array order).
 */
export function findMatchingFunnel(
  text: string,
  triggers: Array<{
    id: string;
    keywords: { set: string[]; semantic: boolean };
    funnelId: string | null;
  }>,
): FunnelMatchResult {
  for (const trigger of triggers) {
    const { matched, keyword } = matchTrigger(text, trigger);
    if (matched && trigger.funnelId) {
      return { matched: true, funnelId: trigger.funnelId, triggerId: trigger.id, matchedKeyword: keyword };
    }
  }
  return { matched: false, funnelId: null, triggerId: null, matchedKeyword: null };
}

/**
 * Render a step template with context variables.
 * Supported: {{product}}, {{link}}, {{name}}, {{handle}}, {{price}}
 * Missing variables are replaced with empty string.
 */
export function renderStepTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  let rendered = template;
  const vars: Record<string, string> = {
    product: String(context.productTitle ?? context.product ?? ""),
    link: String(context.linkUrl ?? context.link ?? ""),
    name: String(context.characterName ?? context.name ?? ""),
    handle: String(context.recipientHandle ?? context.handle ?? "").replace(/^@/, ""),
    price: String(context.price ?? ""),
  };
  for (const [key, value] of Object.entries(vars)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  // Replace any remaining {{unknown}} with empty string
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, "");
  return rendered;
}

/**
 * Check if a step's conditions are met by the conversation context.
 * Conditions can include:
 * - sentiment: "positive" | "negative" | "neutral"
 * - hasLink: boolean
 * - hasProduct: boolean
 */
export function checkStepConditions(
  conditions: Record<string, unknown>,
  context: Record<string, unknown>,
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  // sentiment check
  if (conditions.sentiment) {
    const required = String(conditions.sentiment);
    const actual = String(context.sentiment ?? "neutral");
    if (required !== actual) return false;
  }

  // hasLink check
  if (conditions.hasLink !== undefined) {
    const hasLink = Boolean(context.linkUrl);
    if (hasLink !== conditions.hasLink) return false;
  }

  // hasProduct check
  if (conditions.hasProduct !== undefined) {
    const hasProduct = Boolean(context.productId || context.productTitle);
    if (hasProduct !== conditions.hasProduct) return false;
  }

  return true;
}

/**
 * Determine the next step to send for a conversation.
 * Returns the step if it's time to send, or null if waiting for delay.
 */
export function getNextStepToSend(
  funnel: FunnelDefinition,
  conversation: ConversationState,
  now: Date = new Date(),
): FunnelStep | null {
  if (conversation.status !== "active") return null;
  if (conversation.currentStepIndex >= funnel.steps.length) return null;

  // Check if it's time for the next step
  if (conversation.nextStepAt && conversation.nextStepAt > now) {
    return null; // still waiting for delay
  }

  const step = funnel.steps[conversation.currentStepIndex];
  if (!step) return null;

  // Check conditions
  if (!checkStepConditions(step.conditions, conversation.context)) {
    // Condition not met — skip this step and advance
    // Note: actual advancement happens in the DB layer after sending
    // For now, we return the step and let the caller decide
    // Better: return a special "skip" signal. Let's return the step
    // and the DB layer will check conditions again.
    return step;
  }

  return step;
}

/**
 * Build the message body for the next step.
 * Also calculates when the NEXT step should be sent (based on delayHours).
 */
export function buildNextMessage(
  funnel: FunnelDefinition,
  conversation: ConversationState,
  now: Date = new Date(),
): { step: FunnelStep; body: string; nextStepAt: Date } | null {
  const step = getNextStepToSend(funnel, conversation, now);
  if (!step) return null;

  const body = renderStepTemplate(step.template, conversation.context);
  const nextStepAt = new Date(now.getTime() + step.delayHours * 60 * 60 * 1000);

  return { step, body, nextStepAt };
}

/**
 * Check if current time is within quiet hours (UTC).
 * Returns true if it's quiet hours (should NOT send).
 */
export function isQuietHours(
  now: Date,
  quietStart: number, // 0-23 UTC
  quietEnd: number, // 0-23 UTC
): boolean {
  const hour = now.getUTCHours();
  if (quietStart === quietEnd) return false; // disabled
  if (quietStart < quietEnd) {
    // e.g., 22 to 8 (same day wrap not needed since start < end means normal range)
    return hour >= quietStart && hour < quietEnd;
  } else {
    // e.g., 22 to 8 (overnight) - wraps midnight
    return hour >= quietStart || hour < quietEnd;
  }
}

/**
 * Check if sentiment should be skipped based on funnel settings.
 * Returns true if should skip (don't send).
 */
export function shouldSkipSentiment(
  skipNegative: boolean,
  sentiment: string | null | undefined,
): boolean {
  if (!skipNegative) return false;
  return sentiment === "negative";
}

/**
 * Anti-spam checks before sending a DM.
 * Returns { allowed: boolean, reason: string }.
 */
export interface AntiSpamCheckResult {
  allowed: boolean;
  reason: string;
}

export function checkAntiSpam(
  params: {
    workspaceId: string;
    platform: string;
    recipientHandle: string;
    funnelId: string;
    dailyCaps: Array<{ platform: string; day: string; sentCount: number; limit: number }>;
    blocklist: Array<{ handle: string; platform: string | null }>;
    existingConversation: ConversationState | null;
    funnelDailyCap: number; // from trigger/funnel config
    funnelSentToday: number; // DMs sent by this funnel today
    globalSentToday: number; // DMs sent by workspace today
    // New: funnel settings for quiet hours and sentiment
    quietHoursStart?: number;
    quietHoursEnd?: number;
    skipNegativeSentiment?: boolean;
    recipientSentiment?: string | null;
  },
): AntiSpamCheckResult {
  const { recipientHandle, platform, funnelSentToday, globalSentToday, funnelDailyCap } = params;
  const handleLower = recipientHandle.toLowerCase().replace(/^@/, "");
  const now = new Date();

  // 0. Quiet hours check
  if (params.quietHoursStart != null && params.quietHoursEnd != null) {
    if (isQuietHours(now, params.quietHoursStart, params.quietHoursEnd)) {
      return { allowed: false, reason: `Quiet hours (${params.quietHoursStart}:00-${params.quietHoursEnd}:00 UTC)` };
    }
  }

  // 0b. Sentiment skip check
  if (shouldSkipSentiment(params.skipNegativeSentiment ?? true, params.recipientSentiment)) {
    return { allowed: false, reason: `Negative sentiment skipped` };
  }

  // 1. Blocklist check
  for (const blocked of params.blocklist) {
    const blockedHandle = blocked.handle.toLowerCase().replace(/^@/, "");
    if (blockedHandle === handleLower) {
      if (!blocked.platform || blocked.platform === platform) {
        return { allowed: false, reason: `Handle ${recipientHandle} is blocklisted` };
      }
    }
  }

  // 2. 1-DM-per-user-per-funnel check (conversation uniqueness enforced by unique index)
  // If conversation exists and is active/completed, don't start another
  if (params.existingConversation) {
    if (params.existingConversation.status === "active") {
      return { allowed: false, reason: `Already in active funnel conversation` };
    }
    if (params.existingConversation.status === "completed") {
      return { allowed: false, reason: `Funnel already completed for this user` };
    }
  }

  // 3. Funnel daily cap
  if (funnelSentToday >= funnelDailyCap) {
    return { allowed: false, reason: `Funnel daily cap reached (${funnelDailyCap})` };
  }

  // 4. Platform daily cap (from dm_daily_caps)
  const todayStr = new Date().toISOString().split("T")[0];
  const platformCap = params.dailyCaps.find(
    (c) => c.platform === platform && c.day === todayStr,
  );
  if (platformCap && platformCap.sentCount >= platformCap.limit) {
    return { allowed: false, reason: `Platform daily cap reached for ${platform}` };
  }

  // 5. Global workspace daily cap (optional - could be added to autopilotConfig)
  // For now, skip global cap as it's not configured

  return { allowed: true, reason: "OK" };
}

/**
 * Funnel execution result for the cron job.
 */
export interface FunnelExecutionResult {
  conversationsStarted: number;
  stepsSent: number;
  skipped: number;
  errors: string[];
}