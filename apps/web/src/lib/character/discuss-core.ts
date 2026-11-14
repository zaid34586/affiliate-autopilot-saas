/**
 * Phase 5 Module C — Character Discussion Engine, pure core.
 * Intent classification + reply building. No DB access — unit-testable.
 * The DB orchestration lives in discuss.ts; an LLM can replace
 * buildDiscussReply's template body later without touching callers.
 */

export type DiscussIntent =
  | "what_to_post"
  | "performance"
  | "earnings"
  | "strategy"
  | "how_to"
  | "general";

export interface DiscussContext {
  characterName: string;
  niche: string | null;
  tone: string | null;
  autopilotLevel: string;
  paused: boolean;
  last7: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  };
  postsLast7: number;
  topProducts: Array<{
    title: string;
    aiScore: number | null;
    commissionValue: string | null;
    commissionType: string | null;
  }>;
  lastJournal: string | null;
}

export interface DiscussResult {
  intent: DiscussIntent;
  reply: string;
  reasoning: string[];
  suggestions: string[];
  engine: "rules-v1";
}

/** Classify what the user is asking about. Keyword-based, deterministic. */
export function classifyIntent(message: string): DiscussIntent {
  const m = message.toLowerCase();

  const has = (...words: string[]) => words.some((w) => m.includes(w));

  if (
    has(
      "what should i post",
      "next post",
      "content idea",
      "post kare",
      "kya post",
      "kal kya",
      "what to post",
      "idea for",
      "banaun kya",
      "video idea",
    )
  ) {
    return "what_to_post";
  }

  if (
    has(
      "earn",
      "revenue",
      "income",
      "paisa",
      "kamaya",
      "kitna kam",
      "sales",
      "conversion",
      "commission mila",
    )
  ) {
    return "earnings";
  }

  if (
    has(
      "performance",
      "analytics",
      "chala kaisa",
      "kaisa raha",
      "views",
      "engagement",
      "clicks",
      "ctr",
      "kaam nahi",
      "work nahi",
      "stats",
    )
  ) {
    return "performance";
  }

  if (
    has(
      "strategy",
      "grow",
      "growth",
      "plan banao",
      "boost",
      "improve",
      "better kaise",
      "scale",
      "badhaye",
    )
  ) {
    return "strategy";
  }

  if (
    has(
      "kaise",
      "how do",
      "how to",
      "how does",
      "kya karna",
      "setup",
      "connect",
      "autopilot",
      "level",
      "configure",
      "settings",
    )
  ) {
    return "how_to";
  }

  return "general";
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

function productLine(p: DiscussContext["topProducts"][number]): string {
  const commission =
    p.commissionValue != null
      ? `${p.commissionType === "flat" ? "$" : ""}${p.commissionValue}${p.commissionType === "percentage" ? "%" : ""} commission`
      : "commission n/a";
  const score = p.aiScore != null ? `score ${p.aiScore}/100` : "unscored";
  return `"${p.title}" (${score}, ${commission})`;
}

/**
 * Pure reply builder — takes context + message, returns the character's
 * answer with reasoning. All numbers come from the context (real DB data).
 */
export function buildDiscussReply(
  ctx: DiscussContext,
  message: string,
): DiscussResult {
  const intent = classifyIntent(message);
  const name = ctx.characterName;
  const { last7 } = ctx;
  const hasData =
    last7.impressions > 0 || last7.clicks > 0 || last7.conversions > 0;
  const top = ctx.topProducts[0];

  let reply = "";
  const reasoning: string[] = [];
  const suggestions: string[] = [];

  switch (intent) {
    case "what_to_post": {
      if (top) {
        reply = `Tomorrow I'd push ${productLine(top)}. Your last 7 days show ${fmt(last7.impressions)} impressions and ${fmt(last7.clicks)} clicks from ${ctx.postsLast7} post(s) — a product showcase reel on the top-scored product is the highest-odds move right now.`;
        reasoning.push(
          `Top product picked by AI score: ${top.aiScore ?? "n/a"}/100 — highest in your active catalog.`,
        );
        reasoning.push(
          `Your autopilot is ${ctx.paused ? "paused" : `on "${ctx.autopilotLevel}"`} — ${
            ctx.paused
              ? "resume it so the schedule actually runs."
              : "the daily sequence research → script → video → publish will pick it up."
          }`,
        );
        reasoning.push(
          `Last 7 days: ${fmt(last7.impressions)} impressions, ${fmt(last7.clicks)} clicks, ${fmt(last7.conversions)} conversions — data from your synced analytics, not a forecast.`,
        );
        suggestions.push(`Showcase reel: ${top.title}`);
        suggestions.push("Listicle: top 3 products by score");
        suggestions.push("Reply to recent comments with your link");
      } else {
        reply = `I don't have an active product to recommend yet — run product research first, then I'll rank ideas by score and pick tomorrow's post.`;
        reasoning.push(
          "No active products in the catalog, so no honest recommendation is possible.",
        );
        suggestions.push("Run product research");
        suggestions.push("Connect an affiliate network");
        suggestions.push("Check autopilot is enabled");
      }
      break;
    }

    case "performance": {
      if (hasData) {
        const ctr =
          last7.impressions > 0
            ? (last7.clicks / last7.impressions) * 100
            : 0;
        reply = `Last 7 days: ${fmt(last7.impressions)} impressions, ${fmt(last7.clicks)} clicks (${ctr.toFixed(2)}% CTR), ${fmt(last7.conversions)} conversions from ${ctx.postsLast7} post(s). That's your real synced data — analytics refresh every 4 hours.`;
        reasoning.push(
          `CTR is ${
            ctr < 1 ? "under 1% — hooks need work" : "healthy for short-form"
          } — computed from impressions vs clicks in analytics_daily.`,
        );
        reasoning.push(
          ctx.postsLast7 > 0
            ? `${ctx.postsLast7} posts published this week give the sample size.`
            : "No posts published this week — low data, so the numbers will look small.",
        );
        suggestions.push("Review top posts in Analytics");
        suggestions.push("Test a new hook on the best product");
        suggestions.push("Check per-platform breakdown");
      } else {
        reply = `No synced analytics yet — nothing has been published (or it's been under 4 hours since the last sync). I won't guess numbers; publish a post and the dashboard fills in.`;
        reasoning.push(
          "Analytics come from platform insight sync every 4 hours — zero data means zero posts, not a tracking failure.",
        );
        suggestions.push("Publish your first post");
        suggestions.push("Check connections are active");
        suggestions.push("Open /dashboard/analytics");
      }
      break;
    }

    case "earnings": {
      if (last7.conversions > 0 || last7.revenue > 0) {
        reply = `Recorded so far: ${fmt(last7.conversions)} conversions and ${fmtMoney(last7.revenue)} in the last 7 days, imported from your affiliate networks. I don't project future earnings — this is actual synced data only.`;
        reasoning.push(
          `Revenue comes from conversion imports in the analytics sync — ${fmt(last7.conversions)} sale(s) matched to your links.`,
        );
        reasoning.push(
          "No forecasting here: earnings claims would be a guess, and I don't make guesses about money.",
        );
        suggestions.push("See earnings by product");
        suggestions.push("Check conversion attribution");
        suggestions.push("Double down on the converting product");
      } else {
        reply = `No conversions recorded in the last 7 days — so no earnings to report yet. I won't invent a number. Clicks and impressions are the leading indicators to watch first.`;
        reasoning.push(
          `Actual data: ${fmt(last7.clicks)} clicks, ${fmt(last7.impressions)} impressions, 0 conversions.`,
        );
        reasoning.push(
          "Earnings show up only after a network reports a conversion — typically a few days after the click.",
        );
        suggestions.push("Increase link-bearing posts");
        suggestions.push("Check link health");
        suggestions.push("Watch CTR in Analytics");
      }
      break;
    }

    case "strategy": {
      const base = hasData
        ? `With ${fmt(last7.impressions)} impressions and ${fmt(last7.conversions)} conversions this week, `
        : `With little data so far, `;
      reply = `${base}the play is simple: keep publishing on your active platforms daily within your caps, lead with the top-scored product, and let the optimizer rotate out anything under 0.5% CTR. Consistency beats volume spikes.`;
      reasoning.push(
        ctx.paused
          ? "Autopilot is paused — strategy only works if the queue runs."
          : `Autopilot level "${ctx.autopilotLevel}" controls how much runs without your approval.`,
      );
      reasoning.push(
        top
          ? `Highest-scored product: ${productLine(top)} — give it the most airtime.`
          : "No scored products yet — research first, then strategize.",
      );
      reasoning.push(
        "Quiet hours and daily caps keep posting natural — I don't recommend bypassing them.",
      );
      suggestions.push("Set daily caps per platform");
      suggestions.push("Review quiet hours");
      suggestions.push("Check circuit breakers");
      break;
    }

    case "how_to": {
      reply = `Autopilot has four levels — Manual (you approve everything), Semi (I prepare, you approve posts), Full (I run the daily sequence within your caps), and Fire-and-forget (only circuit breakers stop me). Connect your affiliate + social accounts in Connections, pick a level in Autopilot, and the daily cron takes it from there.`;
      reasoning.push(
        `Your current level: "${ctx.autopilotLevel}"${ctx.paused ? " (currently paused)" : ""}.`,
      );
      reasoning.push(
        "Daily sequence: research → ai_scoring → script → video → publish → analytics → optimizer → report.",
      );
      reasoning.push(
        "Circuit breakers auto-pause on repeated API failures so a broken connection can't spam your accounts.",
      );
      suggestions.push("Open Autopilot config");
      suggestions.push("Connect accounts");
      suggestions.push("Read the job history");
      break;
    }

    case "general":
    default: {
      reply = `I'm ${name} — your content agent${ctx.niche ? ` in the ${ctx.niche} niche` : ""}. Ask me what to post tomorrow, how the numbers looked, what we earned, or how autopilot works. Every answer I give is backed by your actual data.`;
      reasoning.push(
        "Answered from character identity + your workspace context — no invented claims.",
      );
      reasoning.push(
        hasData
          ? `Context on hand: ${fmt(last7.impressions)} impressions, ${fmt(last7.conversions)} conversions (last 7 days).`
          : "No synced analytics yet — I'll say so instead of guessing.",
      );
      suggestions.push("Kal kya post karein?");
      suggestions.push("How did performance look?");
      suggestions.push("How does autopilot work?");
      break;
    }
  }

  return { intent, reply, reasoning, suggestions, engine: "rules-v1" };
}
