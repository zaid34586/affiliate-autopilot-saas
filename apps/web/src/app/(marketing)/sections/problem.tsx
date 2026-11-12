const PAINS = [
  {
    n: "01",
    t: "10 tools, zero system",
    d: "One tool finds products, another writes copy, a third publishes — and you're stuck doing the connective work.",
  },
  {
    n: "02",
    t: "Links don't equal sales",
    d: "A comment asks 'link?' — and you spend 2 hours replying. By then the buyer has moved on.",
  },
  {
    n: "03",
    t: "No attribution, no insight",
    d: "Which post drove the click? Which product earned the commission? Without attribution, you're flying blind.",
  },
  {
    n: "04",
    t: "Optimization never happens",
    d: "You learn from yesterday's post — when the system should have told you yesterday what to boost and what to kill.",
  },
];

export function Problem() {
  return (
    <section className="bg-bone text-ink">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <p className="label text-ink/50">The problem</p>
        <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
          The problem in affiliate marketing isn&apos;t the product —
          <span className="text-ink/40">it&apos;s the missing system.</span>
        </h2>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PAINS.map((p) => (
            <div
              key={p.n}
              className="rounded-xl border border-ink/10 bg-white/60 p-6 transition-colors hover:border-ink/25"
            >
              <span className="label text-ink/40">{p.n}</span>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">
                {p.t}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-ink/60">
                {p.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}