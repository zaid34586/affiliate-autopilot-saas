const STEPS = [
  "Goal",
  "Research",
  "Strategy",
  "Content",
  "Video",
  "Publish",
  "Comment → DM",
  "Track",
  "Optimize",
  "Learn",
];

export function Loop() {
  return (
    <section className="border-b border-ink-3">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="label text-signal">One loop, zero babysitting</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
              A complete loop — running while you sleep.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-bone-2 md:text-right">
            This isn&apos;t a collection of tools — it&apos;s an operating system that thinks,
            executes, and improves itself for the next day.
          </p>
        </div>

        {/* conveyor */}
        <div className="mt-12 rounded-2xl border border-ink-3 bg-ink-2 p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3 md:gap-x-3">
            {STEPS.map((s, i) => (
              <span key={s} className="flex items-center gap-2 md:gap-3">
                <span className="group flex items-center gap-2 rounded-lg border border-ink-4 bg-ink px-3 py-2.5 transition-colors hover:border-signal">
                  <span className="label text-signal-dim">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="whitespace-nowrap text-sm font-medium text-bone">
                    {s}
                  </span>
                </span>
                {i < STEPS.length - 1 && (
                  <span className="text-bone-3">→</span>
                )}
              </span>
            ))}
            {/* repeat */}
            <span className="flex items-center gap-2 md:gap-3">
              <span className="text-bone-3">→</span>
              <span className="flex items-center gap-2 rounded-lg border border-signal/50 bg-signal/10 px-3 py-2.5">
                <span className="text-sm font-semibold text-signal">Repeat</span>
                <span className="text-signal">↻</span>
              </span>
            </span>
          </div>

          <p className="label mt-6 text-bone-3">
            goal to repeat — every step handled by AI · you approve
          </p>
        </div>
      </div>
    </section>
  );
}