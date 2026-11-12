import Link from "next/link";

const STEPS = [
  {
    n: "01",
    t: "Connect",
    d: "Link your social accounts + affiliate networks. 4-minute setup — then it never asks again.",
    cta: { label: "View integrations →", href: "/integrations" },
  },
  {
    n: "02",
    t: "Configure autopilot",
    d: "Pick niche, tone, posting schedule, approval level — from Manual to Fire-and-forget.",
    cta: { label: "View pricing →", href: "/pricing" },
  },
  {
    n: "03",
    t: "Watch results",
    d: "Wake up: posts live, comment DMs sent, clicks and sales tracked. Just read the weekly report.",
    cta: { label: "Start free →", href: "/signup" },
  },
];

export function How() {
  return (
    <section id="how" className="bg-bone text-ink scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <p className="label text-ink/50">How it works</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
          3 steps. Then just watch.
        </h2>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="relative rounded-2xl border border-ink/10 bg-white/70 p-7"
            >
              <span className="font-mono text-5xl font-semibold text-ink/10">
                {s.n}
              </span>
              <h3 className="mt-4 text-xl font-semibold tracking-tight">
                {s.t}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/60">
                {s.d}
              </p>
              <Link
                href={s.cta.href}
                className="mt-5 inline-block text-sm font-medium text-ink underline decoration-signal-dim decoration-2 underline-offset-4 hover:decoration-ink"
              >
                {s.cta.label}
              </Link>
              {i < STEPS.length - 1 && (
                <span className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-ink/25 md:block">
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}