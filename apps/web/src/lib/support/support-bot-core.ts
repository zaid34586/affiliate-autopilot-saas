/**
 * Phase 7 — AI Support Bot Core (pure logic).
 *
 * Given a user question + retrieved KB chunks, asks the LLM to answer.
 * Returns structured response with confidence + citations.
 */

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// ───────────────────────── TYPES ─────────────────────────

export interface SupportBotInput {
  question: string;
  kbContext: string;           // pre-fetched context block from Knowledge Base
  workspaceName?: string;
  userTier?: string;           // "free" | "starter" | "growth" | "scale"
}

export interface SupportBotResult {
  answer: string;
  citations: string[];         // document titles referenced
  confidence: number;          // 0-100 (bot's self-assessed confidence)
  shouldAutoReply: boolean;    // true when confidence >= AUTO_REPLY_THRESHOLD
  suggestedTags?: string[];    // optional: category tags for the ticket
}

const AUTO_REPLY_THRESHOLD = 75; // %

// ───────────────────────── PROMPT ─────────────────────────

const SYSTEM_PROMPT = `You are the Affiliate Autopilot Support Assistant.
Your job is to answer user questions using ONLY the provided knowledge base context.
If the context doesn't contain the answer, say so honestly — never invent facts.

Output format (strict JSON):
{
  "answer": "Your helpful answer in markdown. Include steps, links, and clarity.",
  "citations": ["Document Title 1", "Document Title 2"],
  "confidence": 85,
  "shouldAutoReply": true,
  "suggestedTags": ["billing", "integration"]
}

Rules:
- answer: practical, empathetic, concise. Use markdown (bullets, bold, code blocks).
- citations: ONLY titles from the provided context. Empty array if no KB used.
- confidence: 0-100. High (80+) when KB directly answers; Medium (50-79) when KB partially helps; Low (<50) when KB irrelevant.
- shouldAutoReply: true when confidence >= ${AUTO_REPLY_THRESHOLD}.
- suggestedTags: pick from ["technical", "billing", "feature_request", "bug_report", "general", "integrations", "onboarding", "pricing", "api", "dm_funnel", "video", "compliance"].
- If the question is clearly out of scope (not related to Affiliate Autopilot features), confidence = 0, shouldAutoReply = false.
`;

function buildPrompt(input: SupportBotInput): string {
  return `USER QUESTION:
${input.question}

${input.kbContext || "KNOWLEDGE BASE CONTEXT: (empty — no relevant documents found)"}

WORKSPACE: ${input.workspaceName || "unknown"}
USER TIER: ${input.userTier || "unknown"}

Respond with ONLY the JSON object. No extra commentary.`;
}

// ───────────────────────── MAIN ENTRY ─────────────────────────

const ResponseSchema = z.object({
  answer: z.string().min(10),
  citations: z.array(z.string()).default([]),
  confidence: z.number().int().min(0).max(100),
  shouldAutoReply: z.boolean(),
  suggestedTags: z.array(z.string()).default([]),
});

export async function runSupportBot(input: SupportBotInput): Promise<SupportBotResult> {
  const prompt = buildPrompt(input);

  try {
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      temperature: 0.2,
      maxOutputTokens: 1500,
    });

    const parsed = ResponseSchema.safeParse(JSON.parse(result.text));
    if (!parsed.success) {
      // Fallback: the model returned something unexpected
      return fallbackResponse(input);
    }

    const data = parsed.data;
    // Enforce threshold
    data.shouldAutoReply = data.confidence >= AUTO_REPLY_THRESHOLD;
    return data;
  } catch (error) {
    console.error("[SupportBot] LLM error:", error);
    return fallbackResponse(input);
  }
}

// ───────────────────────── FALLBACK ─────────────────────────

function fallbackResponse(input: SupportBotInput): SupportBotResult {
  const hasKb = !!input.kbContext?.trim();
  return {
    answer: hasKb
      ? "I found some relevant documentation but couldn't generate a confident answer. A human will review your question shortly."
      : "I don't have enough information to answer this yet. Our team will get back to you within 24 hours.",
    citations: [],
    confidence: hasKb ? 40 : 10,
    shouldAutoReply: false,
    suggestedTags: ["general"],
  };
}

// ───────────────────────── UTILITIES ─────────────────────────

/** Extract document titles from KB context block. */
export function extractCitationsFromContext(kbContext: string): string[] {
  const titles: string[] = [];
  const lines = kbContext.split("\n");
  for (const line of lines) {
    const m = line.match(/^\[([^\]]+)\]/);
    if (m) titles.push(m[1]);
  }
  return [...new Set(titles)];
}

/** Quick relevance check without LLM (for routing). */
export function isLikelySupportQuestion(text: string): boolean {
  const t = text.toLowerCase();
  const keywords = [
    "how to", "why", "error", "bug", "issue", "problem", "help",
    "billing", "invoice", "refund", "charge", "subscription", "cancel",
    "dm", "funnel", "automation", "instagram", "reel", "post",
    "video", "render", "voice", "clone", "character", "brand",
    "api", "webhook", "integration", "webhook", "connection",
    "pricing", "plan", "upgrade", "downgrade", "feature",
    "compliance", "ftc", "disclosure", "affiliate",
  ];
  return keywords.some((k) => t.includes(k));
}