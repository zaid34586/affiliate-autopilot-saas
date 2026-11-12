export function Character() {
  return (
    <section className="border-b border-ink-3">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-28 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="label text-signal">
            The differentiator — Character
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            Your own AI persona —
            <span className="text-signal">that thinks.</span>
          </h2>
          <p className="mt-5 max-w-lg leading-relaxed text-bone-2">
            Every workspace gets a Character named after
            <span className="text-bone">your social handle.</span>
            It writes daily strategy (thought journal), talks to your audience in
            that personality, and discusses with you —
            <span className="text-bone">&ldquo;what should we post tomorrow?&rdquo;</span>
          </p>

          <ul className="mt-8 space-y-3">
            {[
              "Thinks — daily thought journal with strategy + self-reflection",
              "Discusses — with you and your audience (comments/DMs)",
              "Guardrails — never makes claims you haven't approved",
              "Consistency — same identity across every platform",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm text-bone-2">
                <span className="status-dot mt-1.5 shrink-0 bg-signal" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* journal mock */}
        <div className="panel p-0">
          <div className="flex items-center justify-between border-b border-ink-3 px-5 py-3.5">
            <span className="label text-bone-3">thought journal — day 12</span>
            <span className="label text-amber">💭 thinking</span>
          </div>

          <div className="space-y-4 p-5">
            <div className="rounded-lg border border-ink-3 bg-ink px-4 py-3.5">
              <p className="label mb-2 text-signal-dim">06:12 · strategy</p>
              <p className="text-sm leading-relaxed text-bone-2">
                &ldquo;Testing question-hooks on tomorrow&apos;s 3 posts &mdash; last week they
                drove 34% higher CTR. Shifting the protein product to morning
                slot.&rdquo;
              </p>
            </div>

            <div className="rounded-lg border border-ink-3 bg-ink px-4 py-3.5">
              <p className="label mb-2 text-signal-dim">14:22 · audience</p>
              <p className="text-sm leading-relaxed text-bone-2">
                Comment: <span className="text-bone">&ldquo;does this actually work?&rdquo;</span>
                <br />
                Character (22s later): &ldquo;Yes &mdash; 30-day refund too. Sending link 👉 go.fit/x9k&rdquo;
              </p>
            </div>

            <div className="rounded-lg border border-ink-3 bg-ink px-4 py-3.5">
              <p className="label mb-2 text-signal-dim">23:00 · reflection</p>
              <p className="text-sm leading-relaxed text-bone-2">
                &ldquo;Today&apos;s comparison reel flopped &mdash; product needs to show in first
                2 seconds. Tomorrow: price badge on thumbnail.&rdquo;
              </p>
            </div>
          </div>

          <div className="border-t border-ink-3 px-5 py-3">
            <p className="label text-bone-3">
              example journal · created under your handle
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}