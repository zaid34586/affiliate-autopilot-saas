/**
 * Phase 5 Module C — DM suggested replies in character voice (pure core).
 * Generates an outgoing DM body for a triggered conversation. No DB access.
 *
 * Guardrails (never violated):
 * - No price quotes (prices change — point to the product page instead).
 * - No earnings, income, or "guaranteed results" claims.
 * - No invented links — only a real tracked link URL is ever included.
 * - Negative/abusive triggers get a polite decline, never a pitch.
 * - 500-char cap, no ALL-CAPS shouting echoed back.
 */

export type DmIntent = "buy_intent" | "question" | "thanks" | "negative" | "general";

export interface DmSuggestionInput {
  triggerKeyword: string | null;
  currentBody: string;
  recipientHandle: string;
  characterName: string;
  niche: string | null;
  productTitle: string | null;
  /** Real tracked link (https://go.affiliateautopilot.app/<code>) or null. */
  linkUrl: string | null;
}

export interface DmSuggestionResult {
  intent: DmIntent;
  reply: string;
  /** Human-readable decision/guardrail notes. */
  reasons: string[];
  engine: "rules-v1";
}

const NEGATIVE_WORDS = [
  "scam", "fake", "worst", "hate", "trash", "garbage", "useless",
  "refund", "fraud", "liar", "stop", "unsubscribe", "not interested",
  "bakwas", "ghatiya", "bewakoof", "scam hai",
];

const ABUSIVE_WORDS = [
  "idiot", "moron", "fuck", "shit", "bitch", "asshole",
  "chutiya", "randi", "gandu", "bakchod",
];

const BUY_WORDS = [
  "price", "cost", "buy", "purchase", "order", "link", "discount",
  "coupon", "sale", "kitne ka", "kahan se", "how much", "where to",
];

const QUESTION_WORDS = ["how", "kaise", "kya", "what", "when", "why", "which", "doubt", "question"];

const THANKS_WORDS = ["thanks", "thank you", "dhanyavaad", "shukriya", "grateful", "appreciate"];

function hasAny(lower: string, words: string[]): boolean {
  return words.some((w) => lower.includes(w));
}

function classifyFromText(lower: string): DmIntent {
  if (hasAny(lower, ABUSIVE_WORDS) || hasAny(lower, NEGATIVE_WORDS)) return "negative";
  if (hasAny(lower, BUY_WORDS)) return "buy_intent";
  if (hasAny(lower, QUESTION_WORDS)) return "question";
  if (hasAny(lower, THANKS_WORDS)) return "thanks";
  return "general";
}

/**
 * Classify the trigger + draft body. Deterministic keyword match.
 * The trigger keyword is the reason this DM exists, so it decides when
 * present; the draft body is only the fallback (the template itself
 * contains words like "link"/"thanks" that would skew the result).
 */
export function classifyDmIntent(input: DmSuggestionInput): DmIntent {
  const trigger = (input.triggerKeyword ?? "").trim().toLowerCase();
  if (trigger) return classifyFromText(trigger);
  return classifyFromText(input.currentBody.toLowerCase());
}

/** ALL-CAPS shouting check (ignore short/normal words). */
function isShouting(body: string): boolean {
  const letters = body.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 12) return false;
  const upper = letters.replace(/[^A-Z]/g, "");
  return upper.length / letters.length > 0.7;
}

const MAX_LEN = 500;

/**
 * Build a guardrailed DM suggestion in the character's voice.
 * linkUrl is only ever echoed if the caller passed a real tracked link.
 */
export function buildDmSuggestion(input: DmSuggestionInput): DmSuggestionResult {
  const intent = classifyDmIntent(input);
  const handle = input.recipientHandle.replace(/^@/, "");
  const name = input.characterName;
  const product = input.productTitle;
  const reasons: string[] = [];
  const hasLink = Boolean(input.linkUrl);

  // Guardrail 1: shouting in the incoming draft → never echo caps.
  if (isShouting(input.currentBody)) {
    reasons.push("Incoming text was all-caps — reply kept calm, no caps echoed.");
  }

  let reply = "";

  switch (intent) {
    case "negative": {
      if (hasAny(`${input.triggerKeyword ?? ""} ${input.currentBody}`.toLowerCase(), ABUSIVE_WORDS)) {
        reply = `Noted, ${handle} — I'll leave it there. If you ever want a straight answer about anything I've posted, you know where to find me.`;
        reasons.push("Abusive trigger: brief polite close, no pitch, no link.");
      } else {
        reply = `Fair enough, ${handle} — no pressure at all. If your mind changes, the details are always in my posts. Thanks for telling me straight.`;
        reasons.push("Negative trigger: polite decline, no pitch, no link.");
      }
      break;
    }

    case "buy_intent": {
      const linkLine = hasLink
        ? `Here's the tracked link with the current details: ${input.linkUrl}`
        : `I don't have a tracked link ready for this one yet — the up-to-date details live on the product page in my posts.`;
      reply = `Hey ${handle} — ${name} here${product ? ` 👋 You asked about ${product}` : " 👋"}. Pricing changes often, so I don't quote numbers in DMs — that's how stale prices get people burned. ${linkLine}`;
      reasons.push(
        hasLink
          ? "Buy intent: included your real tracked link — no price quoted (prices change)."
          : "Buy intent: no tracked link on this DM, so none was invented — pointed to the product page instead.",
      );
      break;
    }

    case "question": {
      const linkLine = hasLink
        ? ` For the full details, this is the link I'd start with: ${input.linkUrl}`
        : "";
      reply = `Good question, ${handle} — ${name} here${input.niche ? `, your daily ${input.niche} guide` : ""}. Short version: check the breakdown I posted${product ? ` on ${product}` : ""} — it covers the how and the why.${linkLine}`;
      reasons.push(
        hasLink
          ? "Question: answered briefly + included your real tracked link."
          : "Question: answered briefly — no tracked link on this DM, so none was invented.",
      );
      break;
    }

    case "thanks": {
      reply = `Appreciate you saying that, ${handle} — glad it landed 🙌 I keep sharing${input.niche ? ` ${input.niche}` : " this"} stuff daily, so stick around.`;
      reasons.push("Thanks: warm in-character acknowledgement, no pitch needed.");
      break;
    }

    case "general":
    default: {
      const linkLine = hasLink ? ` If you want the thing everyone's asking about: ${input.linkUrl}` : "";
      reply = `Hey ${handle} — ${name} here${input.niche ? ` from the ${input.niche} corner` : ""}. Ask me anything about what I've been posting${product ? ` (especially ${product})` : ""}, and I'll point you in the right direction.${linkLine}`;
      reasons.push(
        hasLink
          ? "General opener: introduced the character + included your real tracked link."
          : "General opener: introduced the character — no tracked link on this DM, so none was invented.",
      );
      break;
    }
  }

  // Guardrail 2: hard length cap.
  if (reply.length > MAX_LEN) {
    reply = reply.slice(0, MAX_LEN - 3) + "...";
    reasons.push(`Reply truncated to ${MAX_LEN} characters.`);
  }

  // Guardrail 3: never echo a dollar price back (even if the draft had one).
  if (/\$\d/.test(reply)) {
    reply = reply.replace(/\$\d[\d,.]*/g, "the current price").trim();
    reasons.push("Removed a dollar figure — prices are never quoted in replies.");
  }

  return { intent, reply, reasons, engine: "rules-v1" };
}
