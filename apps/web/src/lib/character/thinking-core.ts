/**
 * Phase 5 Module C — Character Thinking Engine (daily self-reflection),
 * pure core. No DB access — unit-testable.
 *
 * Every morning the character "thinks": it reviews real synced data
 * (yesterday's analytics, posting cadence, autopilot state, catalog),
 * writes a short journal entry, picks one decision for today, and a
 * confidence score. All numbers come from the caller's context — the
 * engine never invents data and never promises future earnings.
 *
 * Deterministic "rules-v1" — the LLM swap point: buildDailyThought
 * stays pure so a model can replace the body later.
 */

export interface ThinkingContext {
  characterName: string;
  niche: string | null;
  /** Yesterday (or the reflection day) real numbers. */
  yesterday: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  };
  /** Last 7 days, including yesterday. */
  last7: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    posts: number;
  };
  autopilotLevel: string;
  paused: boolean;
  topProduct: { title: string; aiScore: number | null } | null;
  /** Previous journal entry text (continuity), if any. */
  previousThought: string | null;
}

export interface DailyThought {
  /** The journal entry (1–3 honest sentences). */
  thoughtText: string;
  /** Why it thinks this — bullet points from real context. */
  reasoning: string[];
  /** One actionable decision for today. */
  decision: string;
  /** 0–100. How much the data supports the decision. */
  confidence: number;
  engine: "rules-v1";
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Build today's journal entry from real context.
 * Pure and deterministic: same context → same thought.
 */
export function buildDailyThought(ctx: ThinkingContext): DailyThought {
  const { yesterday, last7 } = ctx;
  const reasoning: string[] = [];

  const hasYesterday = yesterday.impressions > 0 || yesterday.clicks > 0 || yesterday.conversions > 0;
  const hasWeek = last7.impressions > 0 || last7.posts > 0;
  const ctrYesterday =
    yesterday.impressions > 0 ? (yesterday.clicks / yesterday.impressions) * 100 : 0;

  let thoughtText = "";
  let decision = "";
  let confidence = 50;

  // ── Branch 1: no data at all — honest low-confidence entry ──
  if (!hasWeek) {
    thoughtText = `Nothing to reflect on yet — no posts published and no synced analytics in the last 7 days. I'd rather write an honest empty entry than a confident story with no data behind it.`;
    decision = ctx.paused
      ? "Resume autopilot so the daily sequence can start producing data."
      : "Publish the first post today so tomorrow's reflection has something real to review.";
    confidence = 20;
    reasoning.push(
      "Last 7 days: 0 impressions, 0 posts — there is no evidence base for a stronger opinion.",
    );
    reasoning.push(
      ctx.paused
        ? "Autopilot is paused, which explains the silence — the queue isn't running."
        : `Autopilot is on "${ctx.autopilotLevel}" but nothing has been published yet — check connections and credits.`,
    );
    if (ctx.topProduct) {
      reasoning.push(
        `"${ctx.topProduct.title}" is ready in the catalog (score ${ctx.topProduct.aiScore ?? "n/a"}/100) — the missing piece is publishing, not research.`,
      );
    }
    return { thoughtText, reasoning, decision, confidence, engine: "rules-v1" };
  }

  // ── Branch 2: yesterday had activity — measure and steer ──
  if (hasYesterday) {
    thoughtText = `Yesterday: ${fmt(yesterday.impressions)} impressions, ${fmt(yesterday.clicks)} clicks (${ctrYesterday.toFixed(2)}% CTR), ${fmt(yesterday.conversions)} conversion(s)${yesterday.revenue > 0 ? ` and ${fmtMoney(yesterday.revenue)} recorded` : ""}. Across the week that's ${fmt(last7.posts)} post(s) — the cadence is holding, so today I'd keep the same format and let the optimizer do its work.`;
    confidence = Math.min(
      85,
      55 +
        (yesterday.impressions > 0 ? 10 : 0) +
        (yesterday.clicks > 0 ? 10 : 0) +
        (last7.posts >= 3 ? 10 : 0) +
        (yesterday.conversions > 0 ? 10 : 0),
    );

    if (ctrYesterday < 1 && yesterday.impressions >= 100) {
      decision = `CTR is ${ctrYesterday.toFixed(2)}% — test a stronger opening hook on today's first post.`;
      reasoning.push(
        `Yesterday's CTR of ${ctrYesterday.toFixed(2)}% is under 1% on ${fmt(yesterday.impressions)} impressions — the hook, not the product, is the likely bottleneck.`,
      );
    } else if (yesterday.conversions > 0) {
      decision = `A conversion came in yesterday — give ${ctx.topProduct?.title ?? "that product"} the most airtime in today's posts.`;
      reasoning.push(
        `${fmt(yesterday.conversions)} conversion(s) yesterday mean the click → sale path works; double down instead of diversifying today.`,
      );
    } else {
      decision = `Keep today's posts in the same format that produced ${fmt(yesterday.impressions)} impressions yesterday, and reply to every comment with the tracked link.`;
      reasoning.push(
        `No conversion yesterday, but ${fmt(yesterday.clicks)} clicks happened — top-of-funnel is working, so the ask (link in replies) is the move.`,
      );
    }

    reasoning.push(
      `All figures above are synced analytics (refresh every 4 hours) — measured, not forecast.`,
    );
  } else {
    // ── Branch 3: week has data but yesterday was silent ──
    thoughtText = `Yesterday was quiet — 0 impressions — but the week holds ${fmt(last7.impressions)} impressions from ${fmt(last7.posts)} post(s). A gap day happens; today I'd resume the normal cadence rather than overcorrect.`;
    decision = `Publish today to restore the cadence${ctx.topProduct ? ` — lead with "${ctx.topProduct.title}"` : ""}.`;
    confidence = 45;
    reasoning.push(
      `Yesterday: 0 impressions vs ${fmt(last7.impressions)} across 7 days — a skipped day, not a dead channel.`,
    );
    reasoning.push(
      ctx.paused
        ? "Autopilot is paused — cadence gaps will keep happening until it runs again."
        : `Autopilot level "${ctx.autopilotLevel}" normally keeps the queue moving; today's queue should refill it.`,
    );
  }

  // ── Shared context bullets ──
  reasoning.push(
    ctx.paused
      ? "Autopilot is paused — every decision below assumes you resume it."
      : `Autopilot level "${ctx.autopilotLevel}" — decisions respect your daily caps and quiet hours.`,
  );
  if (ctx.topProduct) {
    reasoning.push(
      `Catalog pick: "${ctx.topProduct.title}" (AI score ${ctx.topProduct.aiScore ?? "n/a"}/100) — highest-scoring active product.`,
    );
  }
  if (ctx.previousThought) {
    reasoning.push(
      "Continuity: this entry follows yesterday's thought — the journal is a running record, not isolated notes.",
    );
  }

  // Guardrail: confidence is always an integer in [0, 100].
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  return { thoughtText, reasoning, decision, confidence, engine: "rules-v1" };
}
