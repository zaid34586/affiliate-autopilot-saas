const SPECS = [
  { k: "7", v: "social platforms" },
  { k: "6", v: "affiliate networks" },
  { k: "5", v: "video modes" },
  { k: "9:16", v: "auto-rendered reels" },
  { k: "24/7", v: "autopilot scheduler" },
];

export function TrustBar() {
  return (
    <section className="border-b border-ink-3 bg-ink-2">
      <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-ink-3 border-x border-ink-3 sm:grid-cols-3 md:grid-cols-5 md:divide-y-0">
        {SPECS.map((s) => (
          <div key={s.v} className="px-4 py-5 text-center md:px-6">
            <p className="font-mono text-xl font-semibold text-signal md:text-2xl">
              {s.k}
            </p>
            <p className="label mt-1 text-bone-3">{s.v}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
