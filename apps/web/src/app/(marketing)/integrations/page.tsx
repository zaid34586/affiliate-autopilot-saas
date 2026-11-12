import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "Integrations",
  description:
    "Instagram, YouTube, Amazon, ClickBank, Stripe, Gemini — where everything connects, and honest status on what's ready.",
  alternates: { canonical: "/integrations" },
};

type Status = "beta" | "roadmap" | "built";
type Item = { n: string; d: string; s: Status };

const GROUPS: { g: string; note: string; items: Item[] }[] = [
  {
    g: "Social platforms",
    note: "Where you publish + manage comments/DMs",
    items: [
      { n: "Instagram", d: "Reels publish, comments, DM triggers (Meta Graph API)", s: "beta" },
      { n: "YouTube", d: "Shorts publish + analytics (Data API v3)", s: "beta" },
      { n: "TikTok", d: "Content Posting API — after developer audit; manual export fallback until then", s: "roadmap" },
      { n: "Facebook", d: "Pages + comments (Meta Graph API)", s: "roadmap" },
      { n: "X (Twitter)", d: "API v2 — paid tiers, cost evaluation needed", s: "roadmap" },
      { n: "Pinterest", d: "Rich pins + scheduling", s: "roadmap" },
      { n: "LinkedIn", d: "Share API — page/user posting", s: "roadmap" },
      { n: "WhatsApp", d: "Click-to-Chat links + Business API bot funnel", s: "roadmap" },
    ],
  },
  {
    g: "Affiliate networks",
    note: "Where products and commissions come from",
    items: [
      { n: "Amazon Associates", d: "Product Advertising API — best sellers, movers & shakers", s: "beta" },
      { n: "ClickBank", d: "Marketplace + gravity data", s: "beta" },
      { n: "Digistore24", d: "EU digital marketplace API", s: "beta" },
      { n: "ShareASale", d: "Merchant offers API", s: "roadmap" },
      { n: "Impact", d: "Brand marketplace API", s: "roadmap" },
      { n: "CJ Affiliate", d: "Enterprise brands API", s: "roadmap" },
      { n: "Custom import", d: "CSV/API — bring your own products", s: "beta" },
    ],
  },
  {
    g: "AI & video",
    note: "The engine that creates content and reels",
    items: [
      { n: "Gemini / Veo — Platform Pool", d: "Our key, included in plan — zero setup", s: "built" },
      { n: "Gemini — BYOK", d: "Your key → −30% discount", s: "built" },
      { n: "ElevenLabs", d: "Voiceover + voice clone (Pro+)", s: "built" },
      { n: "HeyGen", d: "AI avatar videos — optional mode", s: "roadmap" },
    ],
  },
  {
    g: "Billing & infra",
    note: "Payments and functionality",
    items: [
      { n: "Stripe", d: "Subscriptions, invoices, customer portal (international)", s: "beta" },
      { n: "Razorpay", d: "India cards + UPI subscriptions", s: "beta" },
      { n: "Custom short domain", d: "go.yourbrand.com — your redirector (Bitly optional)", s: "roadmap" },
    ],
  },
];

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  beta: { label: "at public beta", cls: "border-signal/40 bg-signal/10 text-signal" },
  roadmap: { label: "roadmap", cls: "border-ink-4 bg-ink text-bone-3" },
  built: { label: "built-in", cls: "border-sky/40 bg-sky/10 text-sky" },
};

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        kicker="Integrations"
        title={
          <>
            Connects where
            <span className="text-signal">your business runs.</span>
          </>
        }
        sub="Every integration status is honest — what's in beta, what's on the roadmap. No fake 'available' badges."
      />

      <div className="mx-auto max-w-6xl px-4 md:px-6">
        {GROUPS.map((grp) => (
          <section key={grp.g} className="border-b border-ink-3 py-12 md:py-14">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {grp.g}
              </h2>
              <p className="text-sm text-bone-3">{grp.note}</p>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {grp.items.map((it) => (
                <div key={it.n} className="panel panel-hover p-5 hover:border-ink-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium">{it.n}</h3>
                    <span
                      className={`label shrink-0 rounded border px-1.5 py-0.5 ${STATUS_META[it.s].cls}`}
                    >
                      {STATUS_META[it.s].label}
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-bone-2">
                    {it.d}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* token vault note */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-16">
        <div className="grid gap-6 rounded-2xl border border-ink-3 bg-ink-2 p-7 md:grid-cols-2 md:p-9">
          <div>
            <p className="label text-signal">Token vault</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight md:text-2xl">
              All tokens encrypted — never in the browser.
            </h2>
          </div>
          <ul className="space-y-2.5 text-sm text-bone-2">
            {[
              "AES-256 encrypted at rest, server-only",
              "Auto-refresh + per-scope revoke UI",
              "Client never receives access tokens",
              "OAuth disconnect = token deleted (GDPR)",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="status-dot mt-1.5 shrink-0 bg-signal-dim" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 text-center">
          <Link href="/signup" className="btn-signal px-7 py-3.5 text-base">
            Connect your first account →
          </Link>
        </div>
      </section>
    </>
  );
}