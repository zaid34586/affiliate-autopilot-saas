import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "From fitness to tech, solo to agency — autopilot setups for every niche and use case.",
  alternates: { canonical: "/solutions" },
};

const NICHES = [
  {
    n: "Fitness & Health",
    eg: "supplements, equipment, programs",
    why: "Fresh reels + product demos daily — DM engine performs best here.",
  },
  {
    n: "Tech & Gadgets",
    eg: "accessories, SaaS, gizmos",
    why: "Comparison + listicle videos are perfect — AI score picks high-commission gear.",
  },
  {
    n: "Beauty & Skincare",
    eg: "makeup, skincare, tools",
    why: "UGC-style testimonials + before/after formats — audience has high buy intent.",
  },
  {
    n: "Home & Kitchen",
    eg: "gadgets, decor, appliances",
    why: "Problem→solution reels convert — geo-smart links handle Amazon.in/.com both.",
  },
  {
    n: "Personal Finance",
    eg: "credit cards, courses, tools",
    why: "Long-form trust content + weekly reports — compliance layer filters claims.",
  },
  {
    n: "Food & Nutrition",
    eg: "supplements, kits, recipes",
    why: "Recipe reels + product placement — daily schedule keeps consistency.",
  },
  {
    n: "Fashion & Travel",
    eg: "apparel, gear, bookings",
    why: "Seasonal trends — trend miner + auto-refresh catches winners continuously.",
  },
  {
    n: "Custom niche",
    eg: "anything — pets, hobbies, courses",
    why: "Define your niche, AI finds products and writes scripts accordingly.",
  },
];

const USE_CASES = [
  {
    t: '"I\'m solo — no time"',
    d: "Full autopilot: morning research, all-day posts, nightly report. You just do the weekly review.",
    level: "Fire-and-forget",
  },
  {
    t: '"I want to approve before posting"',
    d: "Semi mode: AI drafts, you preview and approve — one click, then auto-publish + DM.",
    level: "Semi",
  },
  {
    t: '"My agency has 8 clients"',
    d: "Agency plan: 10 workspaces, separate brand voices, white-label analytics, dedicated support.",
    level: "Agency",
  },
  {
    t: '"I just need links and captions"',
    d: "Free plan: product finder + link engine + content studio — upgrade when you need video.",
    level: "Free",
  },
];

const SIZES = [
  {
    s: "Creator (0–10k)",
    tip: "Start with Semi — consistency first, scale later.",
    plan: "Free → Starter",
  },
  {
    s: "Growth (10–100k)",
    tip: "Full autopilot + DM engine — that's where compounding starts.",
    plan: "Pro",
  },
  {
    s: "Agency (clients)",
    tip: "10 workspaces, separate character per client.",
    plan: "Agency",
  },
];

export default function SolutionsPage() {
  return (
    <>
      <PageHeader
        kicker="Solutions"
        title={
          <>
            Your niche, your setup —
            <span className="text-signal">same system.</span>
          </>
        }
        sub="One OS, works differently for every niche, size, and use case."
      />

      {/* by niche */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-16">
        <p className="label text-signal">By niche</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NICHES.map((n) => (
            <div key={n.n} className="panel panel-hover p-5 hover:border-ink-4">
              <h3 className="font-semibold tracking-tight">{n.n}</h3>
              <p className="label mt-1.5 text-bone-3">{n.eg}</p>
              <p className="mt-3 text-sm leading-relaxed text-bone-2">{n.why}</p>
            </div>
          ))}
        </div>
      </section>

      {/* by use case */}
      <section className="border-y border-ink-3 bg-ink-2">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-16">
          <p className="label text-signal">By use case</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {USE_CASES.map((u) => (
              <div key={u.t} className="rounded-xl border border-ink-3 bg-ink p-6">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold tracking-tight">{u.t}</h3>
                  <span className="label shrink-0 rounded border border-signal/40 bg-signal/10 px-1.5 py-0.5 text-signal">
                    {u.level}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-bone-2">{u.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* by size */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-16">
        <p className="label text-signal">By size</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {SIZES.map((s) => (
            <div key={s.s} className="panel p-6">
              <h3 className="font-semibold tracking-tight">{s.s}</h3>
              <p className="mt-3 text-sm leading-relaxed text-bone-2">{s.tip}</p>
              <p className="label mt-4 text-signal">{s.plan}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-ink-3 bg-ink-2 p-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Build your setup in 4 minutes.
          </h2>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn-signal px-6 py-3 text-base">
              Start free →
            </Link>
            <Link href="/pricing" className="btn-ghost px-6 py-3 text-base">
              View plans
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}