import Link from "next/link";

const FEED = [
  { t: "04:00", tag: "research", text: "38 products scanned → 6 new winners identified", tone: "signal" },
  { t: "05:10", tag: "scripts", text: "9 ad scripts drafted in your brand voice", tone: "signal" },
  { t: "06:30", tag: "renders", text: "4 reels rendered — 9:16, captions synced", tone: "signal" },
  { t: "09:00", tag: "publish", text: "6 posts live on Instagram + YouTube", tone: "signal" },
  { t: "14:22", tag: "comment→dm", text: 'User commented "link?" → DM sent in 22s', tone: "amber" },
  { t: "20:00", tag: "optimizer", text: "Hook B outperforming +31% CTR → boosting", tone: "signal" },
  { t: "23:00", tag: "report", text: "Today: 6 posts · 1,240 clicks · 14 sales", tone: "sky" },
];

export function Hero() {
  return (
    <section className="grid-dots relative overflow-hidden border-b border-ink-3">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 md:px-6 md:pb-24 md:pt-24 lg:grid-cols-2 lg:items-center lg:gap-10">
        {/* ── copy ── */}
        <div>
          <p className="label mb-6 inline-flex items-center gap-2 rounded-full border border-ink-4 bg-ink-2 px-3 py-1.5 text-bone-2">
            <span className="status-dot bg-signal pulse-slow" />
            AI marketing operating system
          </p>

          <h1 className="text-4xl font-semibold leading-[1.03] tracking-tight md:text-6xl">
            Your affiliate marketing team,
            <br />
            <span className="text-signal">running 24/7.</span>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-bone-2 md:text-lg">
            AI finds best-selling products, builds links, generates reels, publishes
            posts — and when someone comments <span className="text-bone">&ldquo;link?&rdquo;</span>
            the DM with the link goes out in 30 seconds. You just approve.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn-signal px-6 py-3 text-base">
              Start free — no card
            </Link>
            <a href="#how" className="btn-ghost px-6 py-3 text-base">
              See how it works ↓
            </a>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
            {[
              "Free plan forever",
              "Setup in 4 minutes",
              "Cancel anytime",
            ].map((t) => (
              <span key={t} className="flex items-center gap-2 text-xs text-bone-3">
                <span className="status-dot bg-signal-dim" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* ── console preview ── */}
        <div className="panel relative p-0 shadow-[0_0_80px_-30px_rgba(212,240,75,0.25)]">
          {/* title bar */}
          <div className="flex items-center justify-between border-b border-ink-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="status-dot bg-danger/70" />
              <span className="status-dot bg-amber/70" />
              <span className="status-dot bg-signal/70" />
              <span className="label ml-2 text-bone-3">autopilot.log</span>
            </div>
            <span className="label flex items-center gap-1.5 text-signal">
              <span className="status-dot bg-signal pulse-slow" /> running
            </span>
          </div>

          {/* stats */}
          <div className="grid grid-cols-3 divide-x divide-ink-3 border-b border-ink-3">
            {[
              { k: "clicks · 24h", v: "1,240" },
              { k: "sales", v: "14" },
              { k: "est. commission", v: "$38.20" },
            ].map((s) => (
              <div key={s.k} className="px-4 py-3.5">
                <p className="label text-bone-3">{s.k}</p>
                <p className="mt-1 font-mono text-lg font-semibold text-bone md:text-xl">
                  {s.v}
                </p>
              </div>
            ))}
          </div>

          {/* feed */}
          <ul className="max-h-[330px] space-y-0.5 overflow-hidden p-3">
            {FEED.map((f) => (
              <li
                key={f.t}
                className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-ink-3/50"
              >
                <span className="label mt-0.5 w-10 shrink-0 text-bone-3">
                  {f.t}
                </span>
                <span
                  className={`label mt-0.5 w-24 shrink-0 truncate ${
                    f.tone === "amber"
                      ? "text-amber"
                      : f.tone === "sky"
                        ? "text-sky"
                        : "text-signal"
                  }`}
                >
                  {f.tag}
                </span>
                <span className="text-xs leading-relaxed text-bone-2 md:text-sm">
                  {f.text}
                </span>
              </li>
            ))}
          </ul>

          {/* footer bar */}
          <div className="flex items-center justify-between border-t border-ink-3 px-4 py-2.5">
            <span className="label text-bone-3">
              example — a day on autopilot
            </span>
            <span className="label text-bone-3">level: full</span>
          </div>
        </div>
      </div>
    </section>
  );
}