import Link from "next/link";

const PLANS = [
  { name: "Free", price: "$0", note: "explore", cta: "Start free", href: "/signup", featured: false },
  { name: "Starter", price: "$29", note: "8 videos/mo", cta: "Choose Starter", href: "/signup", featured: false },
  { name: "Pro", price: "$79", note: "30 videos/mo", cta: "Choose Pro", href: "/signup", featured: true },
  { name: "Agency", price: "$249", note: "120 videos/mo", cta: "Choose Agency", href: "/signup", featured: false },
];

export function PricingTeaser() {
  return (
    <section className="border-b border-ink-3 bg-ink-2">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <div className="flex flex-col items-start gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="label text-signal">Pricing</p>
            <h2 className="mt-4 text-3xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
              Start free. Pay when revenue arrives.
            </h2>
          </div>
          <Link
            href="/pricing"
            className="label text-bone-2 underline underline-offset-4 hover:text-signal"
          >
            full pricing + faq →
          </Link>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col rounded-xl border p-6 ${
                p.featured
                  ? "border-signal bg-signal/5 shadow-[0_0_60px_-25px_rgba(212,240,75,0.4)]"
                  : "border-ink-3 bg-ink"
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
              <p className="mt-4 font-mono text-3xl font-semibold">
                {p.price}
                <span className="text-sm font-normal text-bone-3">/mo</span>
              </p>
              <p className="label mt-2 text-bone-3">{p.note}</p>
              <Link
                href={p.href}
                className={p.featured ? "btn-signal mt-6 w-full" : "btn-ghost mt-6 w-full"}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="label mt-6 text-bone-3">
          add your Gemini key (BYOK) → −30% on all plans · 7-day pro trial with card
        </p>
      </div>
    </section>
  );
}