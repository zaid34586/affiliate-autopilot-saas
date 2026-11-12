const FAQS = [
  {
    q: "Do I need my own Google Flow / Gemini account?",
    a: "No. The video engine runs on our platform pool — cost is included in your plan, one click and the reel is ready. If you add your own Gemini key you get 30% off (BYOK), but it's not required.",
  },
  {
    q: "Will it post from my accounts without my control?",
    a: "You decide. Autopilot has 4 levels: Manual (approve every post), Semi (draft preview), Full (auto with limits), Fire-and-forget. New users default to Semi, and quiet hours + daily caps always apply.",
  },
  {
    q: "Won't sending DMs from comments get my account banned?",
    a: "That's why there's an anti-spam layer: one DM per user (24h cooldown), daily caps, quiet hours, blocklist, negative sentiment skip. All designed within platform rules.",
  },
  {
    q: "How are earnings tracked?",
    a: "Every short link tracks clicks, and affiliate networks sync conversions. Dashboard shows post → click → sale fully attributed — which post earned how much commission.",
  },
  {
    q: "What's included in the Free plan?",
    a: "Product finder, links, content studio, and 2 trial videos — no card needed. Videos are a monthly quota on paid plans (Starter 8, Pro 30, Agency 120).",
  },
  {
    q: "Is my data safe? Where do OAuth tokens live?",
    a: "All tokens are AES-256 encrypted in our token vault and never reach the client. AI only receives data it needs for the task. Details: Security page + Privacy Policy.",
  },
];

export function Faq() {
  return (
    <section className="border-b border-ink-3">
      <div className="mx-auto max-w-3xl px-4 py-20 md:px-6 md:py-28">
        <p className="label text-center text-signal">FAQ</p>
        <h2 className="mt-4 text-center text-3xl font-semibold tracking-tight md:text-5xl">
          Frequently asked questions
        </h2>

        <div className="mt-12 divide-y divide-ink-3 rounded-2xl border border-ink-3 bg-ink-2">
          {FAQS.map((f) => (
            <details key={f.q} className="group px-5 py-4 md:px-7">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-bone md:text-base">
                {f.q}
                <span className="shrink-0 text-bone-3 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-bone-2">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}