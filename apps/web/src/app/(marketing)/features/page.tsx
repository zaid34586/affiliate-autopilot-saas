import Link from "next/link";
import type { Metadata } from "next";
import {
  Radar,
  Link2,
  PenLine,
  Clapperboard,
  CalendarDays,
  MessageSquareMore,
  Drama,
  ChartNoAxesCombined,
} from "lucide-react";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Product finder, link engine, content studio, video engine, publisher, DM sales engine, character, and analytics — every module detailed.",
  alternates: { canonical: "/features" },
};

const MODULES = [
  {
    id: "finder",
    icon: Radar,
    tag: "Module A",
    t: "Product Finder",
    lead: "AI finds what's selling right now — top 1% products, fresh daily.",
    bullets: [
      "Auto-fetch from Amazon (Best Sellers, Movers & Shakers), ClickBank, Digistore24, ShareASale, Impact, CJ",
      "AI Product Score 0–100 — commission %, price point, rating, review count, competition, content-fit, seasonality",
      "Filters: niche, price range, commission min, marketplace, region",
      "Daily refresh job — new winners added, flops archived",
      "Product library: saved products + historical score graph",
    ],
  },
  {
    id: "links",
    icon: Link2,
    tag: "Module B",
    t: "Link Engine",
    lead: "Every click tracked — which post, which country, which product.",
    bullets: [
      "Auto affiliate link generation + UTM builder (source/medium/campaign/content)",
      "Your short domain: go.yourbrand.com/xyz + QR code",
      "Click tracking per post, per product, per platform",
      "Geo-smart redirect — India user → Amazon.in, US → Amazon.com",
      "Daily link health check — dead links auto-flagged",
    ],
  },
  {
    id: "content",
    icon: PenLine,
    tag: "Module C",
    t: "AI Content Studio",
    lead: "Captions, ad copy, scripts — your voice, 3 variants, compliance built in.",
    bullets: [
      "Platform-wise generation — IG caption, YT title, ad copy, hook lines",
      "3 variants per piece — A/B test to find winners",
      "Brand voice settings: tone, languages (English / Hindi / Hinglish), banned words",
      "Compliance layer: auto #ad disclosure + false-claim filter",
      "Draft → approve → schedule flow, regenerate + inline edit",
    ],
  },
  {
    id: "video",
    icon: Clapperboard,
    tag: "Module D",
    t: "Video Engine 🎬",
    lead: "Script to ready 9:16 reel in 3 minutes — zero video editing.",
    bullets: [
      "5 modes: product showcase, listicle, UGC-style, testimonial, comparison",
      "Scene splitter: script → 5–6 scenes → parallel clip generation",
      "Voiceover (ElevenLabs presets), music library + auto-ducking, word-level captions",
      "Platform pool (our key, included in plan) — or your Gemini key via BYOK (−30%)",
      "Render queue: progress, retry, failure reasons + cost/quota dashboard",
    ],
  },
  {
    id: "publish",
    icon: CalendarDays,
    tag: "Module E",
    t: "Publisher & Calendar",
    lead: "Schedule or go full autopilot — posts publish themselves, never missed.",
    bullets: [
      "Week/month calendar, drag-drop scheduling",
      "Auto-publish to IG + YouTube (+ TikTok post-audit) with retry + error states",
      "First-comment scheduling (hashtags or link)",
      "Manual fallback: download MP4 + caption, upload yourself",
      "Quiet hours + daily caps per platform",
    ],
  },
  {
    id: "dm",
    icon: MessageSquareMore,
    tag: "Module F — flagship",
    t: "🔥 DM Sales Engine",
    lead: 'Comment asks "link?" — link lands in their DM within 30 seconds.',
    bullets: [
      "Comment webhook → keyword triggers: link, price, buy, dm, where, order…",
      "AI semantic match — not just exact words, understands 'how much?' too",
      "Smart replies: price askers get price + discount + link, doubters get concise answer",
      "Approval modes: 🔴 draft approve | 🟡 semi | 🟢 full auto (default semi)",
      "Anti-spam: 1 DM per user (24h), daily caps, quiet hours, blocklist, sentiment skip",
      "Full DM funnel: greet → pitch → link → 2h follow-up → checkout link",
    ],
  },
  {
    id: "character",
    icon: Drama,
    tag: "Module G",
    t: "🎭 Character",
    lead: "Named after your handle. It thinks, discusses, sells.",
    bullets: [
      "Auto-created after onboarding — name = primary social handle",
      "Daily thinking journal: strategy thoughts + self-reflection (failed post → insight)",
      "Discusses with you: 'what should we post tomorrow?' → reasoned answer",
      "Discusses with audience: comment/DM replies in the same personality",
      "Guardrails: never makes claims you haven't approved",
    ],
  },
  {
    id: "analytics",
    icon: ChartNoAxesCombined,
    tag: "Module H",
    t: "Analytics & Reports",
    lead: "Post → click → sale fully attributed. What worked, what didn't — at a glance.",
    bullets: [
      "Platform insights sync (IG/YT/TikTok APIs) — 3–6× daily",
      "Affiliate conversions sync — network APIs for pending/approved/reversed",
      "Dashboards: clicks, CTR, conversions, earnings per product/post/platform",
      "Weekly AI report: what worked, what didn't, next week's plan",
      "Revenue attribution: which post earned how much commission",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHeader
        kicker="Features — module wise"
        title={
          <>
            One OS, eight modules —
            <span className="text-signal">complete loop covered.</span>
          </>
        }
        sub="Every module works on its own, and together they form a 24/7 system. Every detail below."
      />

      <div className="mx-auto max-w-6xl px-4 md:px-6">
        {MODULES.map((m, i) => {
          const Icon = m.icon;
          return (
            <section
              key={m.id}
              id={m.id}
              className={`scroll-mt-24 border-b border-ink-3 py-14 md:py-16 ${
                i % 2 === 1 ? "" : ""
              }`}
            >
              <div className="grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-ink-4 bg-ink-2 text-signal">
                      <Icon size={20} strokeWidth={1.75} />
                    </span>
                    <span className="label text-bone-3">{m.tag}</span>
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold tracking-tight md:text-3xl">
                    {m.t}
                  </h2>
                  <p className="mt-3 leading-relaxed text-bone-2">{m.lead}</p>
                </div>

                <div className="lg:col-span-7">
                  <ul className="space-y-3 rounded-2xl border border-ink-3 bg-ink-2 p-5 md:p-6">
                    {m.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-3 text-sm leading-relaxed text-bone-2"
                      >
                        <span className="status-dot mt-1.5 shrink-0 bg-signal-dim" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* final CTA */}
      <section className="grid-dots border-b border-ink-3">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:px-6 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">
            Seen enough? Try it yourself.
          </h2>
          <p className="mt-4 text-bone-2">
            Free plan — 2 trial videos, no card. 4 minutes to set up.
          </p>
          <Link href="/signup" className="btn-signal mt-8 px-7 py-3.5 text-base">
            Start free →
          </Link>
        </div>
      </section>
    </>
  );
}