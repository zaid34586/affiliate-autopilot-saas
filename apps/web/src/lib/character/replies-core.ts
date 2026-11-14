/**
 * Phase 5 Module C — Audience comment replies in character voice.
 * Pure core: sentiment classify + guardrailed reply building. No DB.
 *
 * Guardrails (never violated):
 * - No earnings, income, or "guaranteed results" claims.
 * - No price quotes (prices change — point to the post/bio link instead).
 * - Negative/abusive comments get a polite decline, never a pitch.
 * - Replies capped at 300 chars, no ALL-CAPS shouting.
 */

export type Sentiment = "positive" | "neutral" | "negative";
export type CommentApprovalMode = "manual" | "semi" | "auto";

export interface CommentReplyInput {
  body: string;
  authorHandle: string;
  characterName: string;
  niche: string | null;
}

export interface CommentReplyResult {
  sentiment: Sentiment;
  /** Empty when blocked by guardrails. */
  reply: string;
  /** Would mode=auto send this without approval? */
  autoSend: boolean;
  /** Guardrails blocked an auto-reply entirely. */
  blocked: boolean;
  /** Human-readable guardrail/decision notes. */
  reasons: string[];
}

const NEGATIVE_WORDS = [
  "scam",
  "fake",
  "worst",
  "hate",
  "trash",
  "garbage",
  "useless",
  "refund",
  "fraud",
  "liar",
  "scam hai",
  "bakwas",
  "ghatiya",
  "bewakoof",
  "fraud hai",
  "kamina",
  "stupid",
  "terrible",
  "awful",
];

const ABUSIVE_WORDS = [
  "idiot",
  "moron",
  "f***",
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "chutiya",
  "bakchod",
  "randi",
  "abusing",
  "gandu",
];

const POSITIVE_WORDS = [
  "love",
  "great",
  "awesome",
  "amazing",
  "nice",
  "good",
  "helpful",
  "thanks",
  "thank you",
  "fire",
  "goat",
  "best",
  "badhiya",
  "bahut accha",
  "dhanyavaad",
  "shukriya",
  "perfect",
  "excellent",
];

const BUY_INTENT_WORDS = [
  "price",
  "cost",
  "buy",
  "purchase",
  "order",
  "link",
  "kitne ka",
  "kahan se",
  "where to",
  "discount",
  "coupon",
  "sale",
];

function hasAny(lower: string, words: string[]): boolean {
  return words.some((w) => lower.includes(w));
}

/** Classify comment sentiment from keywords. Deterministic. */
export function classifySentiment(body: string): Sentiment {
  const lower = body.toLowerCase();
  if (hasAny(lower, NEGATIVE_WORDS) || hasAny(lower, ABUSIVE_WORDS)) {
    return "negative";
  }
  if (hasAny(lower, POSITIVE_WORDS)) return "positive";
  return "neutral";
}

function isAbusive(lower: string): boolean {
  return hasAny(lower, ABUSIVE_WORDS);
}

function isBuyIntent(lower: string): boolean {
  return hasAny(lower, BUY_INTENT_WORDS);
}

/** ALL-CAPS shouting check (ignore short/normal words). */
function isShouting(body: string): boolean {
  const letters = body.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 12) return false;
  const upper = letters.replace(/[^A-Z]/g, "");
  return upper.length / letters.length > 0.7;
}

/**
 * Build a guardrailed reply in the character's voice.
 * mode controls whether an auto-send is permitted for this comment.
 */
export function buildCommentReply(
  input: CommentReplyInput,
  mode: CommentApprovalMode,
): CommentReplyResult {
  const lower = input.body.toLowerCase();
  const sentiment = classifySentiment(input.body);
  const reasons: string[] = [];

  // Guardrail 1: abusive → block entirely, no auto reply.
  if (isAbusive(lower)) {
    return {
      sentiment: "negative",
      reply: "",
      autoSend: false,
      blocked: true,
      reasons: [
        "Blocked: abusive content — no reply is generated. Dismiss or handle manually.",
      ],
    };
  }

  // Guardrail 2: shouting → tone it down, still reply but never echo caps.
  if (isShouting(input.body)) {
    reasons.push("Comment was all-caps — reply kept calm, no caps echoed.");
  }

  let reply = "";

  if (sentiment === "negative") {
    reply = `Sorry that didn't land well for you — I don't argue in comments. Send me the details in a DM and I'll look into it properly.`;
    reasons.push("Negative sentiment: polite decline, no pitch, no link.");
  } else if (sentiment === "positive") {
    reply = `Thanks ${input.authorHandle} — glad it helped! If you want the one I mentioned, it's linked in the post.`;
    reasons.push("Positive sentiment: gratitude + soft pointer to the post link.");
  } else if (isBuyIntent(lower)) {
    reply = `Good question — current pricing and availability change often, so I don't quote numbers here. The up-to-date details are linked in the post/bio.`;
    reasons.push(
      "Buy intent: pointed to the post link instead of quoting a price (prices change).",
    );
  } else {
    reply = `Appreciate you weighing in, ${input.authorHandle}${
      input.niche ? ` — this is what I share about ${input.niche} daily` : ""
    }. Thanks for the comment!`;
    reasons.push("Neutral comment: friendly in-character acknowledgement.");
  }

  // Guardrail 3: hard length cap.
  if (reply.length > 300) {
    reply = reply.slice(0, 297) + "...";
    reasons.push("Reply truncated to 300 characters.");
  }

  // Approval decision: auto only when mode=auto, safe sentiment, not blocked.
  const autoSend =
    mode === "auto" && sentiment !== "negative" && reply.length > 0;
  if (mode === "auto" && !autoSend) {
    reasons.push("Mode is auto but sentiment is negative — held for review.");
  } else if (mode !== "auto") {
    reasons.push(`Approval mode "${mode}" — requires your approval to send.`);
  }

  return { sentiment, reply, autoSend, blocked: false, reasons };
}
