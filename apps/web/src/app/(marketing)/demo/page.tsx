import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "A day on autopilot &mdash; 4 AM to 11 PM, step by step. Live product demo coming soon.",
  alternates: { canonical: "/demo" },
};

const TIMELINE = [
  {
    t: "04:00",
    tag: "research",
    title: "Product Finder starts scanning",
    d: "Amazon Best Sellers, Movers & Shakers, ClickBank gravity scan &mdash; 38 products scanned, 6 new winners, each with AI score 0&ndash;100. Flops archived automatically.",
  },
  {
    t: "05:10",
    tag: "strategy",
    title: "Character writes thought journal",
    d: "Last week&apos;s CTR data drives strategy: &lsquo;question-hooks drove 34% higher, shifting protein product to morning slot.&rsquo; You read this in your dashboard.",
  },
  {
    t: "05:40",
    tag: "content",
    title: "Content Studio generates drafts",
    d: "Caption + hook + ad copy per product &mdash; 3 variants, your brand voice (English/Hindi/Hinglish). Auto #ad disclosure and false-claim filter active.",
  },
  {
    t: "06:30",
    tag: "video",
    title: "Video Engine renders reels",
    d: "Scripts &rarr; scenes &rarr; 9:16 clips: voiceover, music, word-level captions. Platform pool (included in plan) or your Gemini key via BYOK (&minus;30%).",
  },
  {
    t: "09:00",
    tag: "publish",
    title: "Scheduler publishes posts",
    d: "Peak hours on Instagram + YouTube &mdash; 6 posts live. First-comment hashtags, retry on failure, quiet hours respected.",
  },
  {
    t: "14:22",
    tag: "comment &rarr; dm",
    title: "Comment received &mdash; DM sent in 22s",
    d: "&lsquo;User asked &ldquo;how much?&rdquo; &rarr; semantic match understands &rarr; price + discount + link reply in DM. One DM per user (24h cooldown), within daily cap.&rsquo;",
  },
  {
    t: "17:00",
    tag: "optimize",
    title: "Optimizer boosts Hook B",
    d: "Hook B CTR +31% &mdash; pushing it, pausing underperformers. The loop runs itself, you don&apos;t intervene.",
  },
  {
    t: "23:00",
    tag: "report",
    title: "Daily report in your inbox",
    d: "6 posts &middot; 1,240 clicks &middot; 14 sales &middot; $38.20 commission &mdash; plus next week&apos;s plan. You just read it.",
  },
];

export default function DemoPage() {
  return (
    <>
      <PageHeader
        kicker="Product demo"
        title={
          <>
            A day on autopilot &mdash;
            <span className="text-signal">minute by minute.</span>
          </>
        }
        sub="An example day (illustrative &mdash; real numbers depend on your niche). Below is the full timeline of what the system did overnight."
      />

      {/* honest note */}
      <section className="mx-auto max-w-6xl px-4 pt-10 md:px-6">
        <div className="rounded-xl border border-amber/40 bg-amber/5 px-5 py-4">
          <p className="label text-amber">Example &mdash; not a guarantee</p>
          <p className="mt-2 text-sm leading-relaxed text-bone-2">
            This timeline shows what the system can do. No income guarantee &mdash;
            results depend on niche, content, and consistency.
          </p>
        </div>
      </section>

      {/* timeline */}
      <section className="mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-16">
        <div className="relative space-y-5 border-l border-ink-4 pl-6 md:pl-8">
          {TIMELINE.map((s) => (
            <div key={s.t} className="relative">
              {/* dot */}
              <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-ink bg-signal md:-left-[39px]" />

              <div className="panel p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-lg font-semibold text-signal">
                    {s.t}
                  </span>
                  <span className="label rounded border border-ink-4 bg-ink px-2 py-0.5 text-bone-3">
                    {s.tag}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold tracking-tight md:text-xl">
                  {s.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-bone-2">
                  {s.d}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* live demo CTA */}
      <section className="border-y border-ink-3 bg-ink-2">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center md:px-6 md:py-16">
          <p className="label text-signal">Live demo</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
            Try it yourself &mdash; 4 minutes, no card.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-bone-2">
            Free plan includes product finder, link engine, content studio, and 2
            trial videos. Full interactive demo (video walkthrough) arrives at
            launch.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn-signal px-7 py-3.5 text-base">
              Start free &rarr;
            </Link>
            <Link href="/features" className="btn-ghost px-7 py-3.5 text-base">
              View modules
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}