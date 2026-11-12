import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "Help Center",
  description:
    "Setup, connections, DM engine, billing — frequently asked questions.",
  alternates: { canonical: "/help" },
};

const SECTIONS = [
  {
    g: "Getting started",
    items: [
      { q: "How long does setup take?", a: "4 minutes: niche &rarr; affiliate accounts &rarr; handle/tone &rarr; character reveal. Then add connections." },
      { q: "Which autopilot level should I choose?", a: "New users: Semi (draft preview + approve) recommended. Comfortable? Full. Tight on time? Fire-and-forget." },
    ],
  },
  {
    g: "Connections & posting",
    items: [
      { q: "How do I connect Instagram?", a: "Dashboard &rarr; Connections &rarr; Instagram &rarr; OAuth (Business/Creator account required). Goes live in Phase 2." },
      { q: "Will it post without me?", a: "Only if Full/Fire-and-forget is on. Quiet hours + daily caps always apply." },
    ],
  },
  {
    g: "DM sales engine",
    items: [
      { q: "How many DMs per user?", a: "One per 24 hours (cooldown). Daily caps, quiet hours, blocklist also active &mdash; spam never happens." },
      { q: "Which comments trigger DMs?", a: "Keyword + semantic match: link, price, buy, where, order, &lsquo;how much?&rsquo; etc. You can edit the trigger list." },
    ],
  },
  {
    g: "Billing",
    items: [
      { q: "Do you offer refunds?", a: "First paid subscription: 7-day money-back &mdash; no questions. Details: Refund Policy." },
      { q: "How does BYOK &minus;30% work?", a: "Settings &rarr; AI &rarr; paste your Gemini key. Video quota then counts 30% cheaper." },
    ],
  },
];

export default function HelpPage() {
  return (
    <>
      <PageHeader
        kicker="Help center"
        title={
          <>
            Fast answers,
            <span className="text-signal">no runaround.</span>
          </>
        }
        sub="Your question should be answered here &mdash; if not, email support, 24h reply (working days)."
      />

      <div className="mx-auto max-w-4xl px-4 py-14 md:px-6 md:py-16">
        <div className="space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.g}>
              <p className="label text-signal">{s.g}</p>
              <div className="mt-4 divide-y divide-ink-3 rounded-2xl border border-ink-3 bg-ink-2">
                {s.items.map((it) => (
                  <details key={it.q} className="group px-5 py-4 md:px-7">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-bone md:text-base">
                      {it.q}
                      <span className="shrink-0 text-bone-3 transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-bone-2">
                      {it.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-ink-3 bg-ink-2 p-8 text-center">
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
            Didn&apos;t find your answer?
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="btn-signal px-6 py-3">
              Email support &rarr;
            </Link>
            <Link href="/docs" className="btn-ghost px-6 py-3">
              Read docs
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}