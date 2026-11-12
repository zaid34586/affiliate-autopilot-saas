import Link from "next/link";
import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free / Starter $29 / Pro $79 / Agency $249 — videos, autopilot, DM engine all included. BYOK for −30%.",
  alternates: { canonical: "/pricing" },
};

const PLANS = [
  {
    name: "Free",
    price: "$0",
    blurb: "Try the full system — no card required.",
    cta: "Start free",
    featured: false,
    features: [
      "10 products tracked",
      "30 AI scripts/mo",
      "2 trial videos",
      "1 platform auto-post",
      "10 copilot messages",
      "Community support",
    ],
    not: ["Autopilot", "BYOK discount"],
  },
  {
    name: "Starter",
    price: "$29",
    blurb: "First real workflow — small but consistent.",
    cta: "Choose Starter",
    featured: false,
    features: [
      "50 products tracked",
      "300 AI scripts/mo",
      "8 videos/mo",
      "3 platforms auto-post",
      "Semi autopilot",
      "BYOK −30%",
      "100 copilot messages",
      "Email support",
    ],
    not: ["Voice clone"],
  },
  {
    name: "Pro",
    price: "$79",
    blurb: "For serious affiliates — full autopilot.",
    cta: "Choose Pro",
    featured: true,
    features: [
      "Unlimited products",
      "1,500 AI scripts/mo",
      "30 videos/mo",
      "All platforms auto-post",
      "Full autopilot",
      "BYOK −30%",
      "Voice clone",
      "Unlimited copilot",
      "3 team members",
      "1-year analytics + export",
      "Priority support",
    ],
    not: [],
  },
  {
    name: "Agency",
    price: "$249",
    blurb: "10 workspaces, scale with clients.",
    cta: "Choose Agency",
    featured: false,
    features: [
      "10 workspaces",
      "Unlimited products",
      "6,000 AI scripts/mo",
      "120 videos/mo + priority render",
      "All platforms, full autopilot",
      "BYOK −30%",
      "Voice clone",
      "10 team members",
      "White-label analytics",
      "Dedicated support",
    ],
    not: [],
  },
];

const ROWS: { label: string; values: (string | boolean)[] }[] = [
  { label: "Workspaces", values: ["1", "1", "1", "10"] },
  { label: "Products tracked", values: ["10", "50", "Unlimited", "Unlimited"] },
  { label: "AI scripts / mo", values: ["30", "300", "1,500", "6,000"] },
  { label: "AI videos / mo", values: ["0 (2 trial)", "8", "30", "120"] },
  { label: "Auto-posting", values: ["1 platform", "3 platforms", "All", "All"] },
  { label: "Autopilot", values: [false, "Semi", "Full", "Full"] },
  { label: "BYOK −30%", values: [false, true, true, true] },
  { label: "Voice clone", values: [false, false, true, true] },
  { label: "Copilot chat", values: ["10 msgs", "100", "Unlimited", "Unlimited"] },
  { label: "Team members", values: ["1", "1", "3", "10"] },
  { label: "Analytics", values: ["Basic", "30-day", "1-year + export", "White-label"] },
  { label: "Support", values: ["Community", "Email", "Priority", "Dedicated"] },
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check size={16} className="mx-auto text-signal" />;
  if (v === false) return <Minus size={16} className="mx-auto text-bone-3" />;
  return <span className="text-sm text-bone-2">{v}</span>;
}

export default function PricingPage() {
  return (
    <>
      <PageHeader
        kicker="Pricing"
        title={
          <>
            Transparent pricing —
            <span className="text-signal">video cost included.</span>
          </>
        }
        sub="Start free, upgrade when revenue arrives. Annual = 2 months free. Every paid plan gets −30% with your own Gemini key (BYOK)."
      />

      {/* plan cards */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-16">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col rounded-xl border p-6 ${
                p.featured
                  ? "border-signal bg-signal/5 shadow-[0_0_70px_-30px_rgba(212,240,75,0.45)]"
                  : "border-ink-3 bg-ink-2"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="label text-bone-2">{p.name}</p>
                {p.featured && (
                  <span className="label rounded border border-signal/40 bg-signal/10 px-1.5 py-0.5 text-signal">
                    popular
                  </span>
                )}
              </div>
              <p className="mt-4 font-mono text-4xl font-semibold tracking-tight">
                {p.price}
                <span className="text-sm font-normal text-bone-3">/mo</span>
              </p>
              <p className="mt-2 min-h-[40px] text-sm text-bone-3">{p.blurb}</p>

              <Link
                href="/signup"
                className={p.featured ? "btn-signal mt-5 w-full" : "btn-ghost mt-5 w-full"}
              >
                {p.cta}
              </Link>

              <ul className="mt-6 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-bone-2">
                    <Check size={15} className="mt-0.5 shrink-0 text-signal" />
                    {f}
                  </li>
                ))}
                {p.not.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-bone-3">
                    <Minus size={15} className="mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="label mt-6 text-center text-bone-3">
          7-day pro trial (card required, 3 videos) · video top-up: $19 / 10
          videos · cancel anytime
        </p>
      </section>

      {/* comparison table */}
      <section className="border-y border-ink-3 bg-ink-2">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-16">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Full comparison
          </h2>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-ink-4">
                  <th className="label py-3 text-left text-bone-3">Feature</th>
                  {PLANS.map((p) => (
                    <th
                      key={p.name}
                      className={`label py-3 text-center ${
                        p.featured ? "text-signal" : "text-bone-2"
                      }`}
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-ink-3">
                    <td className="py-3.5 text-sm text-bone-2">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="py-3.5 text-center">
                        <Cell v={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* pricing FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
          Pricing questions
        </h2>
        <div className="mt-8 divide-y divide-ink-3 rounded-2xl border border-ink-3 bg-ink-2">
          {[
            {
              q: "Why is video so expensive — and what's included?",
              a: "AI video generation (Veo-class model) + FFmpeg render + voiceover all have real cost — that's why videos are quota-based. Plan price includes platform pool cost; no hidden per-video charges (while quota lasts).",
            },
            {
              q: "How does BYOK −30% work?",
              a: "Settings → AI → paste your Gemini key. After that, every plan's video quota counts 30% cheaper (we don't bear the render cost).",
            },
            {
              q: "Why no video on Free plan?",
              a: "Every video has real cost — so Free gets only 2 trial videos. Everything else (products, links, captions, 1 platform posting) stays free.",
            },
            {
              q: "Yearly billing?",
              a: "Yes — annual gets 2 months free (pay for 10, get 12).",
            },
            {
              q: "How do refunds work?",
              a: "7-day money-back on first paid subscription — no questions. Details: Refund Policy.",
            },
          ].map((f) => (
            <details key={f.q} className="group px-5 py-4 md:px-7">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-bone md:text-base">
                {f.q}
                <span className="shrink-0 text-bone-3 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-bone-2">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-signal/40 bg-signal/5 p-8 text-center">
          <h3 className="text-xl font-semibold tracking-tight md:text-2xl">
            Try the full system on free first.
          </h3>
          <Link href="/signup" className="btn-signal mt-6 px-7 py-3.5 text-base">
            Start free →
          </Link>
        </div>
      </section>
    </>
  );
}