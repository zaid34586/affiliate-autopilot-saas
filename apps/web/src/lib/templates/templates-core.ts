/**
 * Phase 7 — Templates Library Core (pure logic).
 *
 * Niche/format taxonomy, {{variable}} extraction + filling,
 * validation, search/scoring, and the builtin template seed.
 */

// ───────────────────────── TAXONOMY ─────────────────────────

export const TEMPLATE_NICHES = [
  "fitness",
  "beauty",
  "tech",
  "finance",
  "home",
  "food",
  "fashion",
  "travel",
  "saas",
  "generic",
] as const;

export type TemplateNiche = (typeof TEMPLATE_NICHES)[number];

export const TEMPLATE_FORMATS = [
  "reel_script",
  "hook",
  "caption",
  "dm_sequence",
  "carousel",
  "email",
] as const;

export type TemplateFormat = (typeof TEMPLATE_FORMATS)[number];

export function isTemplateNiche(v: unknown): v is TemplateNiche {
  return typeof v === "string" && (TEMPLATE_NICHES as readonly string[]).includes(v);
}

export function isTemplateFormat(v: unknown): v is TemplateFormat {
  return typeof v === "string" && (TEMPLATE_FORMATS as readonly string[]).includes(v);
}

// ───────────────────────── TYPES ─────────────────────────

export interface TemplateRecord {
  id: string;
  key: string;
  workspaceId: string | null;
  niche: string;
  format: string;
  title: string;
  description: string;
  body: string;
  variables: string[];
  tags: string[];
  builtin: boolean;
  usageCount: number;
}

export interface TemplateInput {
  niche: string;
  format: string;
  title: string;
  description: string;
  body: string;
  tags?: string[];
}

// ───────────────────────── VARIABLES ─────────────────────────

/** Extract unique {{variable}} names from a template body, in order. */
export function extractVariables(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

export interface FillResult {
  text: string;
  /** Variables present in the template but not supplied */
  missing: string[];
  /** Supplied keys not present in the template (ignored) */
  unused: string[];
}

/**
 * Fill {{variables}} in a body. Missing variables are left as-is
 * and reported — never silently dropped.
 */
export function fillTemplate(body: string, vars: Record<string, string>): FillResult {
  const declared = extractVariables(body);
  const missing = declared.filter((d) => !(d in vars) || vars[d] === "");
  const used = new Set<string>();

  const text = body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, name: string) => {
    if (name in vars && vars[name] !== "") {
      used.add(name);
      return vars[name];
    }
    return whole; // leave placeholder visible
  });

  return {
    text,
    missing,
    unused: Object.keys(vars).filter((k) => !declared.includes(k)),
  };
}

// ───────────────────────── VALIDATION ─────────────────────────

export function validateTemplate(input: Partial<TemplateInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.title || input.title.trim().length < 4 || input.title.length > 120) {
    errors.push("Title must be 4–120 chars");
  }
  if (!input.description || input.description.trim().length < 10 || input.description.length > 300) {
    errors.push("Description must be 10–300 chars");
  }
  if (!input.body || input.body.trim().length < 20) {
    errors.push("Body must be ≥ 20 chars");
  }
  if (input.body && input.body.length > 10000) {
    errors.push("Body must be ≤ 10000 chars");
  }
  if (!isTemplateNiche(input.niche)) {
    errors.push(`Invalid niche (one of: ${TEMPLATE_NICHES.join(", ")})`);
  }
  if (!isTemplateFormat(input.format)) {
    errors.push(`Invalid format (one of: ${TEMPLATE_FORMATS.join(", ")})`);
  }
  if (input.body) {
    // Malformed variable: {{ has closing but invalid name, or unclosed {{
    const opens = (input.body.match(/\{\{/g) || []).length;
    const closes = (input.body.match(/\}\}/g) || []).length;
    if (opens !== closes) errors.push("Unbalanced {{ }} in body");
  }

  return { valid: errors.length === 0, errors };
}

// ───────────────────────── SEARCH / FILTER ─────────────────────────

export interface TemplateFilters {
  niche?: string;
  format?: string;
  q?: string;
  /** include builtin templates (default true) */
  builtin?: boolean;
  /** workspace id — its custom templates are always included */
  workspaceId?: string;
}

/** Score a template against a search query (higher = better). */
export function scoreTemplate(t: TemplateRecord, q: string): number {
  const query = q.toLowerCase().trim();
  if (!query) return 0;

  const title = t.title.toLowerCase();
  const desc = t.description.toLowerCase();
  const tags = t.tags.join(" ").toLowerCase();
  const body = t.body.toLowerCase();

  let score = 0;
  if (title === query) score += 100;
  if (title.includes(query)) score += 50;
  if (tags.includes(query)) score += 30;
  if (desc.includes(query)) score += 20;
  if (body.includes(query)) score += 10;

  // word-boundary partial matches in title
  for (const word of query.split(/\s+/)) {
    if (word.length >= 3 && title.includes(word)) score += 8;
  }

  return score;
}

/** Apply filters + search, sorted by relevance (then usage, then title). */
export function filterTemplates(templates: TemplateRecord[], filters: TemplateFilters): TemplateRecord[] {
  const { niche, format, q, builtin = true, workspaceId } = filters;

  let out = templates.filter((t) => {
    // scope: builtin always visible; custom only from own workspace
    const visible = t.builtin ? builtin : t.workspaceId === workspaceId;
    if (!visible) return false;
    if (niche && t.niche !== niche) return false;
    if (format && t.format !== format) return false;
    return true;
  });

  if (q && q.trim()) {
    out = out
      .map((t) => ({ t, s: scoreTemplate(t, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || b.t.usageCount - a.t.usageCount)
      .map((x) => x.t);
  } else {
    out = out.sort(
      (a, b) =>
        Number(b.builtin) - Number(a.builtin) ||
        b.usageCount - a.usageCount ||
        a.title.localeCompare(b.title),
    );
  }

  return out;
}

/** Top templates for a niche (for the "start here" rail). */
export function recommendTemplates(templates: TemplateRecord[], niche: string, limit = 4): TemplateRecord[] {
  return filterTemplates(templates, { niche, builtin: true })
    .slice()
    .sort((a, b) => b.usageCount - a.usageCount || a.title.localeCompare(b.title))
    .slice(0, limit);
}

// ───────────────────────── BUILTIN SEED ─────────────────────────

export interface BuiltinTemplate extends TemplateInput {
  key: string;
}

/**
 * 24 builtin templates across niches × formats.
 * Variables use {{product}}, {{benefit}}, {{audience}}, {{niche}} etc.
 */
export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  // ── FITNESS ──
  {
    key: "fitness-reel-transformation",
    niche: "fitness",
    format: "reel_script",
    title: "Transformation Reel Script",
    description: "Before/after style Reel script that hooks with a result, then introduces {{product}} as the lever.",
    tags: ["hook", "result", "before-after"],
    body: `[0-2s] HOOK: "I {{benefit_result}} in 30 days — and I didn't change my whole routine."
[2-8s] PROBLEM: "I used to think {{common_belief}}. Turns out the real issue was {{problem}}."
[8-15s] SOLUTION: "Then I found {{product}}. It {{key_benefit}} — that's it, one change."
[15-25s] PROOF: "Here's the proof: {{proof_point}}."
[25-30s] CTA: "Link in bio to try {{product}} — {{offer}}."`,
  },
  {
    key: "fitness-hook-5-questions",
    niche: "fitness",
    format: "hook",
    title: "5 Question Hooks for {{niche}} Reels",
    description: "Five curiosity-gap hook lines tuned for fitness content — pick one per Reel.",
    tags: ["curiosity", "questions"],
    body: `1. "Why does {{common_advice}} actually make {{audience}} slower?"
2. "What would happen if {{audience}} did the opposite of {{common_belief}}?"
3. "Is {{product}} worth it? I tested it for 30 days."
4. "The {{niche}} mistake I see {{audience}} make every single day?"
5. "What if {{benefit_result}} had nothing to do with {{common_belief}}?"`,
  },
  {
    key: "fitness-caption-cta",
    niche: "fitness",
    format: "caption",
    title: "Saveable Caption + CTA",
    description: "Caption format that asks for a save first, then drops the affiliate CTA softly.",
    tags: ["saveable", "cta"],
    body: `{{tip_one}} → save this one for later 📌

{{tip_two}} — that's the part {{audience}} always skip.

If you want the shortcut: {{product}} does the heavy lifting ({{key_benefit}}).

🔗 Link in bio. #{{niche}} #fitness tips #{{audience}}`,
  },

  // ── BEAUTY ──
  {
    key: "beauty-reel-get-ready",
    niche: "beauty",
    format: "reel_script",
    title: "GRWM Product Drop Reel",
    description: "Get-ready-with-me script that introduces {{product}} naturally mid-routine.",
    tags: ["grwm", "routine"],
    body: `[0-3s] HOOK: "Getting ready in {{time_limit}} — but I'm skipping my usual {{usual_step}}."
[3-10s] ROUTINE: "Primer first. Then {{product}} — it {{key_benefit}}."
[10-20s] DEMO: Watch it apply. No filter, natural light.
[20-28s] RESULT: "That's the finished look — {{proof_point}}."
[28-30s] CTA: "{{product}} is linked in bio. {{offer}}"`,
  },
  {
    key: "beauty-hook-myth-bust",
    niche: "beauty",
    format: "hook",
    title: "Myth-Bust Hooks",
    description: "Contrarian hooks that make {{audience}} stop and defend their routine in comments.",
    tags: ["contrarian", "myth"],
    body: `"{{common_belief}} is why your {{problem}} won't go away."
"The {{beauty_step}} everyone does backwards — and it's wasting their money."
"You don't need 10 products. You need {{product}} and this one other thing."
"Stop buying {{common_advice}} — dermatologists changed their minds."`,
  },
  {
    key: "beauty-dm-review-reply",
    niche: "beauty",
    format: "dm_sequence",
    title: "DM: Review → Product Reply",
    description: "Three-message DM flow when {{audience}} asks which product you use.",
    tags: ["dm", "social-proof"],
    body: `Msg 1 (instant): "Hey! It's {{product}} — I've used it for {{duration}} and {{key_benefit}} is why I stuck with it."
Msg 2 (if reply): "Want the link? {{offer}} is on right now — here: {{link}}"
Msg 3 (if silence, 48h): "Still deciding? Happy to answer anything about how it worked for my {{problem}}."`,
  },

  // ── TECH ──
  {
    key: "tech-reel-unboxing-verdict",
    niche: "tech",
    format: "reel_script",
    title: "Unboxing → Verdict Reel",
    description: "Fast unboxing Reel that ends with a blunt buy/skip verdict — high save rate.",
    tags: ["unboxing", "verdict"],
    body: `[0-2s] HOOK: "{{product}} at {{price}} — buy or skip? Verdict in 20 seconds."
[2-8s] UNBOX: Fast cuts — box, contents, first boot.
[8-14s] SPEC CHECK: "{{spec_one}} ✓. {{spec_two}} — mostly ✓."
[14-20s] VERDICT: "{{verdict}} — because {{reason}}."
[20-22s] CTA: "Link in bio. {{offer}}"`,
  },
  {
    key: "tech-hook-alternative",
    niche: "tech",
    format: "hook",
    title: "{{product}} Alternative Hooks",
    description: "High-intent alternative-search hooks — captures people comparison shopping.",
    tags: ["alternative", "comparison", "high-intent"],
    body: `"Stop paying for {{expensive_tool}} — this {{price_point}} alternative does {{key_benefit}}."
"{{product}} vs {{competitor}}: I used both for 30 days. One wins clearly."
"The {{category}} tool nobody talks about but should."`,
  },
  {
    key: "tech-caption-thread",
    niche: "tech",
    format: "caption",
    title: "Mini-Review Caption",
    description: "Structured mini-review caption: what it is, who it's for, who should skip.",
    tags: ["review", "structured"],
    body: `{{product}} — 30-day verdict:

✅ What's good: {{pro_one}}
✅ Also good: {{pro_two}}
❌ Skip if: {{con_one}}

Overall: {{verdict}}. Link in bio if you want it — {{offer}}.`,
  },

  // ── FINANCE ──
  {
    key: "finance-reel-myth",
    niche: "finance",
    format: "reel_script",
    title: "Money Myth Reel",
    description: "Debunks a common money belief, then positions {{product}} as the smarter path.",
    tags: ["myth", "authority"],
    body: `[0-3s] HOOK: "The {{money_advice}} your parents told you is costing you money."
[3-10s] WHY IT'S WRONG: "Here's what actually happens when {{audience}} {{common_belief}}..."
[10-18s] THE FIX: "What works instead: {{strategy}} — that's what {{product}} helps you do."
[18-25s] PROOF: "{{proof_point}}."
[25-30s] CTA + DISCLOSURE: "Link in bio. (Affiliate — I may earn a commission.)"`,
  },
  {
    key: "finance-caption-checklist",
    niche: "finance",
    format: "caption",
    title: "Money Checklist Caption",
    description: "Save-first checklist caption with soft product placement at the end.",
    tags: ["checklist", "saveable"],
    body: `{{audience}} money checklist:

1. {{step_one}}
2. {{step_two}}
3. {{step_three}}
4. {{step_four}}

Save this. If step {{n}} feels hard, {{product}} automates it — link in bio.

#moneytips #{{niche}} #{{audience}}`,
  },

  // ── HOME ──
  {
    key: "home-reel-before-after",
    niche: "home",
    format: "reel_script",
    title: "Room Glow-Up Reel",
    description: "Before/after reveal Reel with a mid-video product credit — strong rewatch rate.",
    tags: ["before-after", "reveal"],
    body: `[0-2s] HOOK: "This corner of my home was the saddest part of the house."
[2-6s] BEFORE: pan the sad corner (harsh light, clutter).
[6-14s] PROCESS: fast cuts — the swap, the {{product}} install.
[14-20s] REVEAL: slow pan, natural light, music drop.
[20-25s] "Everything's linked in bio — {{product}} was {{key_benefit}}."`,
  },
  {
    key: "home-hook-problem",
    niche: "home",
    format: "hook",
    title: "Pain-Point Hooks",
    description: "Hooks that name the exact household frustration, so {{audience}} self-identifies.",
    tags: ["pain-point", "relatable"],
    body: `"If your {{room}} still {{problem}}, watch this."
"I fixed the one thing that made my {{room}} feel cheap."
"The {{home_item}} that {{audience}} regret buying — and the one they don't."`,
  },

  // ── FOOD ──
  {
    key: "food-reel-recipe-speedrun",
    niche: "food",
    format: "reel_script",
    title: "60-Second Recipe Reel",
    description: "Speed-run recipe Reel with product placement at the ingredient list.",
    tags: ["recipe", "speedrun"],
    body: `[0-2s] HOOK: "{{dish}} in {{time_limit}} — no experience needed."
[2-15s] INGREDIENTS: fast cuts, {{product}} gets a 1s hero shot.
[15-40s] STEPS: 3 steps max, on-screen text for each.
[40-50s] PLATE: the finished dish, steam, texture close-up.
[50-60s] CTA: "Full recipe + {{product}} link in bio."`,
  },
  {
    key: "food-caption-craving",
    niche: "food",
    format: "caption",
    title: "Craving Caption",
    description: "Short sensory caption engineered for shares and 'recipe?' comments.",
    tags: ["sensory", "engagement"],
    body: `Crispy outside. {{texture}} inside. {{dish}} that {{benefit_result}}.

Recipe:
→ {{ingredient_one}}
→ {{ingredient_two}}
→ {{product}} (trust me on this one)

Comment "RECIPE" and I'll send the full method. 🔗 in bio.`,
  },

  // ── FASHION ──
  {
    key: "fashion-reel-outfit-formula",
    niche: "fashion",
    format: "reel_script",
    title: "Outfit Formula Reel",
    description: "Three-piece outfit formula Reel with each piece tagged to an affiliate link.",
    tags: ["outfit", "haul"],
    body: `[0-2s] HOOK: "The {{occasion}} formula that never fails: 3 pieces, 1 look."
[2-8s] PIECE 1: "{{piece_one}} — {{why_it_works}}."
[8-14s] PIECE 2: "{{piece_two}} — the anchor."
[14-20s] PIECE 3: "{{piece_three}} — the pop."
[20-26s] FULL LOOK: mirror spin.
[26-30s] CTA: "All 3 linked in bio 🛒"`,
  },
  {
    key: "fashion-hook-trend",
    niche: "fashion",
    format: "hook",
    title: "Trend-vs-Taste Hooks",
    description: "Hooks that position {{audience}} above the trend cycle — high comment bait.",
    tags: ["trend", "comments"],
    body: `"{{trend}} is out. {{alternative}} is the {{season}} move."
"3 trends that look expensive but cost {{price_point}}."
"Why {{audience}} are quietly ditching {{trend}}."`,
  },

  // ── TRAVEL ──
  {
    key: "travel-reel-hidden-gem",
    niche: "travel",
    format: "reel_script",
    title: "Hidden Gem Reel",
    description: "Destination reveal Reel with a packing/gear affiliate hook at the end.",
    tags: ["destination", "reveal"],
    body: `[0-2s] HOOK: "Nobody talks about {{destination}} — here's why it's my favorite."
[2-10s] THE SHOT: best angle, golden hour, 2s hold.
[10-18s] THE DETAIL: "{{detail}} — it's the little thing that makes it."
[18-26s] TIP: "Go in {{season}} and {{tip_benefit}}."
[26-30s] CTA: "My {{gear_item}} for this trip is linked in bio."`,
  },
  {
    key: "travel-caption-itinerary",
    niche: "travel",
    format: "caption",
    title: "Micro-Itinerary Caption",
    description: "Saveable day-itinerary caption — the format travel audiences save most.",
    tags: ["itinerary", "saveable"],
    body: `{{destination}} in one day:

🌅 Morning: {{morning_activity}}
☀️ Afternoon: {{afternoon_activity}}
🌙 Night: {{night_activity}}

Save this for your trip ✈️ Packing list (with {{product}}) — link in bio.`,
  },

  // ── SAAS ──
  {
    key: "saas-reel-problem-agitate",
    niche: "saas",
    format: "reel_script",
    title: "Problem → Agitate → Solve Reel",
    description: "Classic PAS script for software offers — works for both organic and paid.",
    tags: ["pas", "software"],
    body: `[0-3s] HOOK: "If you still {{pain_point}} every week, this is for you."
[3-10s] AGITATE: "That's {{time_cost}} of your month gone — {{audience}} lose {{annual_cost}} a year to it."
[10-18s] SOLVE: "{{product}} does {{key_benefit}} automatically. Watch:"
[18-25s] DEMO: screen recording, 3 clicks max.
[25-30s] CTA: "Free trial via link in bio — {{offer}}."`,
  },
  {
    key: "saas-caption-comparison",
    niche: "saas",
    format: "caption",
    title: "Tool Comparison Caption",
    description: "Head-to-head comparison caption with a clear winner and disclosure line.",
    tags: ["comparison", "disclosure"],
    body: `{{tool_one}} vs {{tool_two}} — after 30 days:

{{tool_one}}: {{verdict_one}}
{{tool_two}}: {{verdict_two}}

Winner: {{winner}} because {{reason}}.

(Affiliate link — I may earn a commission.) Link in bio.`,
  },

  // ── GENERIC (any niche) ──
  {
    key: "generic-hook-formulas",
    niche: "generic",
    format: "hook",
    title: "5 Universal Hook Formulas",
    description: "Five fill-in-the-blank hooks that work in any niche — the swiss army knife.",
    tags: ["universal", "fill-in-blank"],
    body: `1. "Stop {{negative_action}} — it's killing your {{desired_result}}."
2. "I {{impressive_result}} in {{timeframe}}. Here's the exact system."
3. "The {{niche}} metric nobody tracks — and it predicts {{desired_result}}."
4. "{{common_belief}} is wrong. Here's what actually works."
5. "3 things {{audience}} should do before {{milestone}}."`,
  },
  {
    key: "generic-dm-four-message",
    niche: "generic",
    format: "dm_sequence",
    title: "The 4-Message Closing DM Flow",
    description: "Deliver → qualify → recommend → follow-up. The proven DM close, fill-in-the-blank.",
    tags: ["dm", "closing", "proven"],
    body: `Msg 1 (instant): "Here's what you asked for: {{deliverable}} — want the 2-min summary?"
Msg 2 (within 1h): "Quick q — are you starting from scratch, or do you already {{existing_state}}?"
Msg 3: "Based on that, {{product}} fits best — {{key_benefit}}. {{offer}}"
Msg 4 (48h silence): "Still deciding? The usual hesitation is {{objection}} — happy to answer anything."`,
  },
  {
    key: "generic-reel-listicle",
    niche: "generic",
    format: "reel_script",
    title: "Numbered Listicle Reel",
    description: "The saveable N-things format — reliable reach for educational niches.",
    tags: ["listicle", "saveable"],
    body: `[0-2s] HOOK: "{{n}} things {{audience}} should know about {{topic}} — #3 is the one nobody does."
[2-8s] ITEM 1: {{item_one}}
[8-14s] ITEM 2: {{item_two}}
[14-20s] ITEM 3: {{item_three}} (the secret one)
[20-26s] ITEM 4: {{item_four}}
[26-30s] CTA: "Save this. Full guide + {{product}} link in bio."`,
  },
  {
    key: "generic-email-welcome-sequence",
    niche: "generic",
    format: "email",
    title: "3-Email Welcome Sequence",
    description: "Welcome → value → offer sequence for new subscribers from DM funnels.",
    tags: ["email", "sequence", "welcome"],
    body: `Email 1 (instant) — SUBJECT: "Welcome! Your {{deliverable}} inside"
Body: Deliver the promised resource + one quick win: {{quick_win}}.

Email 2 (day 2) — SUBJECT: "The {{niche}} mistake I see {{audience}} make"
Body: Teach the #1 {{common_belief}} myth, show {{proof_point}}.

Email 3 (day 4) — SUBJECT: "Should you get {{product}}?"
Body: Honest fit check — who it's for ({{ideal_user}}), who should skip, {{offer}}. Affiliate disclosure included.`,
  },
  {
    key: "generic-caption-social-proof",
    niche: "generic",
    format: "caption",
    title: "Social Proof Caption",
    description: "Results-first caption built around one customer story and a soft CTA.",
    tags: ["social-proof", "story"],
    body: `"{{testimonial_quote}}" — {{customer_name}}, {{customer_context}}

{{customer_name}} {{result_detail}}.

That's {{key_benefit}} in the wild. If you want the same: {{product}} is linked in bio. {{offer}}.`,
  },
];
