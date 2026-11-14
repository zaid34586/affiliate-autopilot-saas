export type NavItem = {
  index: string;
  label: string;
  href: string;
  module: string;
  summary: string;
  bullets: string[];
  /** Kaunsa phase is module ko live karega */
  phase: string;
};

/** Sidebar ka main nav — affiliate modules ke naam se (roadmap §Phase 2). */
export const MAIN_NAV: NavItem[] = [
  {
    index: "01",
    label: "Overview",
    href: "/dashboard",
    module: "Overview",
    summary: "Command center — today's activity and what's running right now.",
    bullets: ["Today at a glance", "Getting-started checklist", "Autopilot status"],
    phase: "live",
  },
  {
    index: "02",
    label: "Products",
    href: "/dashboard/products",
    module: "Product Finder",
    summary:
      "AI finds top-performing products, scores them 0–100, and refreshes daily.",
    bullets: [
      "Amazon / ClickBank / Digistore se auto-fetch",
      "AI product score (commission, trend, content-fit)",
      "Saved library + daily auto-refresh",
    ],
    phase: "Phase 3",
  },
  {
    index: "03",
    label: "Links",
    href: "/dashboard/links",
    module: "Link Engine",
    summary:
      "Auto affiliate links, short domain, click tracking, geo-smart redirect.",
    bullets: [
      "UTM builder + go.yourbrand.com short links",
      "Click tracking per post / product / platform",
      "Dead link auto-flag (daily health check)",
    ],
    phase: "Phase 3",
  },
  {
    index: "04",
    label: "Content",
    href: "/dashboard/content",
    module: "AI Content Studio",
    summary:
      "Captions, ad copy, scripts — 3 variants in your brand tone, with compliance checks.",
    bullets: [
      "Platform-wise captions + hooks",
      "Auto #ad + false-claim filter",
      "Draft → approve → schedule flow",
    ],
    phase: "Phase 3",
  },
  {
    index: "05",
    label: "Videos",
    href: "/dashboard/videos",
    module: "Video Engine",
    summary:
      "Ready-to-post 9:16 reels from a script — zero setup (bring-your-own-key optional).",
    bullets: [
      "Showcase + listicle modes",
      "Voiceover + music + word captions",
      "Render queue + cost/quota tracker",
    ],
    phase: "live",
  },
  {
    index: "06",
    label: "Calendar",
    href: "/dashboard/calendar",
    module: "Publisher",
    summary: "Week/month calendar, drag-drop schedule, auto-post + retry.",
    bullets: [
      "Schedule posts per platform",
      "Auto-publish with retry + error states",
      "Manual export fallback (MP4 + caption)",
    ],
    phase: "Phase 3",
  },
  {
    index: "07",
    label: "DM Inbox",
    href: "/dashboard/dm-inbox",
    module: "DM Sales Engine",
    summary:
      "Comment lands → keyword trigger → your Character DMs the link within 30 seconds.",
    bullets: [
      "Comment → auto-DM keyword triggers",
      "Unified inbox across every platform",
      "Approval modes: draft / semi / full auto",
    ],
    phase: "Phase 3",
  },
  {
    index: "08",
    label: "Character",
    href: "/dashboard/character",
    module: "🎭 Character",
    summary:
      "Your AI persona — named after your handle, keeps a thought journal, and joins the conversation.",
    bullets: [
      "Profile = handle + personality + guardrails",
      "Daily thinking journal (strategy thoughts)",
      "Discuss with you and your audience",
    ],
    phase: "Phase 3–5",
  },
  {
    index: "09",
    label: "Analytics",
    href: "/dashboard/analytics",
    module: "Analytics",
    summary:
      "Post → click → sale fully attributed. Earnings per product, post, and platform.",
    bullets: [
      "Clicks, CTR, conversions, earnings",
      "Revenue attribution (post → click → sale)",
      "Weekly AI report",
    ],
    phase: "Phase 5",
  },
  {
    index: "10",
    label: "Trend Miner",
    href: "/dashboard/trend-miner",
    module: "Trend Miner",
    summary:
      "Scans trending hashtags/audio → finds viral posts → suggests remixes for your products.",
    bullets: [
      "Trending hashtags + audio (IG/TikTok/YT)",
      "Viral post detection + affiliate link extraction",
      "AI remix suggestions (hook + script + confidence)",
    ],
    phase: "Phase 5",
  },
];

/** Bottom nav — connections, autopilot, settings. */
export const BOTTOM_NAV: NavItem[] = [
  {
    index: "11",
    label: "Connections",
    href: "/dashboard/connections",
    module: "Connections",
    summary:
      "All your social + affiliate accounts in one place — status, health, revoke.",
    bullets: [
      "Social: Instagram, TikTok, YouTube, X…",
      "Affiliate: Amazon, ClickBank, Digistore…",
      "Encrypted token vault (AES-256)",
    ],
    phase: "Phase 2–3",
  },
  {
    index: "12",
    label: "Autopilot",
    href: "/dashboard/autopilot",
    module: "Autopilot",
    summary:
      "24/7 scheduler — research at 4am, videos at 6am, posts all day, report at 11pm.",
    bullets: [
      "Levels: Manual / Semi / Full / Fire-and-forget",
      "Daily caps + quiet hours + circuit breakers",
      "Job history (what ran, why it failed)",
    ],
    phase: "Phase 5",
  },
  {
    index: "13",
    label: "Settings",
    href: "/dashboard/settings",
    module: "Settings",
    summary: "Account, workspace, brand voice, AI keys, billing — all in one place.",
    bullets: [
      "Account / Workspace / Brand / AI",
      "Notifications + Security",
      "Billing & plan (Free / Starter / Pro / Agency)",
    ],
    phase: "Phase 2–3",
  },
];

export const ALL_NAV: NavItem[] = [...MAIN_NAV, ...BOTTOM_NAV];

export function findNavItem(href: string): NavItem | undefined {
  return ALL_NAV.find((n) => n.href === href);
}
