import Link from "next/link";

export function FinalCta() {
  return (
    <section className="bg-signal text-ink">
      <div className="mx-auto max-w-4xl px-4 py-20 text-center md:px-6 md:py-24">
        <p className="label text-ink/60">Ready?</p>
        <h2 className="mt-4 text-3xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
          Set up today — your team runs itself tomorrow.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-ink/70">
          Free plan, no card, 4-minute setup. Try it first — then decide when to
          turn on autopilot.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-ink px-7 py-3.5 text-base font-semibold text-signal transition-transform hover:-translate-y-0.5"
          >
            Start free →
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-lg border border-ink/30 px-7 py-3.5 text-base font-medium text-ink transition-colors hover:border-ink hover:bg-ink/5"
          >
            See pricing
          </Link>
        </div>
        <p className="label mt-7 text-ink/50">
          no credit card · cancel anytime · human support
        </p>
      </div>
    </section>
  );
}