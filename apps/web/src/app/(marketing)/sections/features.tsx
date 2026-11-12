import {
  Radar,
  Link2,
  PenLine,
  Clapperboard,
  MessageSquareMore,
  Drama,
} from "lucide-react";

const FEATURES = [
  {
    icon: Radar,
    t: "Product Finder",
    d: "Scours Amazon, ClickBank, Digistore for best-sellers — every product scored 0–100 by AI (commission, trend, content-fit). Fresh winners daily, flops archived automatically.",
  },
  {
    icon: Link2,
    t: "Link Engine",
    d: "Every product gets an affiliate link + UTM automatically. Short domain, click tracking, geo-smart redirects (India → Amazon.in). Dead links checked daily.",
  },
  {
    icon: PenLine,
    t: "Content Studio",
    d: "Captions, ad copy, hooks — 3 variants in your brand voice (English/Hindi/Hinglish). Auto #ad disclosure + false-claim filter for compliance.",
  },
  {
    icon: Clapperboard,
    t: "Video Engine",
    d: "Script to ready 9:16 reel — voiceover, music, word-level captions. Zero setup (our pool) or your Gemini key (BYOK, −30%).",
  },
  {
    icon: MessageSquareMore,
    t: "🔥 DM Sales Engine",
    d: 'Comment asks "link?" or "how much?" → Character sends link in DM within 30s. One DM per user (24h), daily caps — spam-safe by design.',
  },
  {
    icon: Drama,
    t: "🎭 Character",
    d: "Named after your social handle. Thinks (daily thought journal), replies to comments/DMs, never makes claims you haven't approved.",
  },
];

export function Features() {
  return (
    <section className="border-b border-ink-3 bg-ink-2">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <p className="label text-signal">Modules</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
          One system. Eight modules.
          <span className="text-signal"> Complete loop.</span>
        </h2>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.t}
                className="panel panel-hover group p-6 hover:border-ink-4"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-ink-4 bg-ink text-signal transition-colors group-hover:border-signal/50">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {f.t}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-bone-2">
                  {f.d}
                </p>
              </div>
            );
          })}
        </div>

        <p className="label mt-8 text-bone-3">
          Also: calendar scheduler · link-in-bio page · weekly AI report · multi-workspace teams
        </p>
      </div>
    </section>
  );
}