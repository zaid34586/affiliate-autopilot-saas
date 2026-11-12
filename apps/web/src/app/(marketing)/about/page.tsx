import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "About",
  description:
    "What Affiliate Autopilot is and why we're building it — one small product, one big loop.",
  alternates: { canonical: "/about" },
};

const VALUES = [
  {
    t: "Systems over tools",
    d: "Tools give you features, you still do the work. We build the loop that runs itself.",
  },
  {
    t: "Honest numbers",
    d: "No fake &lsquo;10,000 happy users.&rsquo; What&apos;s real &mdash; real earnings, real stats, real roadmap.",
  },
  {
    t: "Approval stays with you",
    d: "Autopilot as much as you want &mdash; but final control always yours (Manual to Fire-and-forget).",
  },
  {
    t: "Compliance first",
    d: "Official APIs, disclosed affiliate links, no income claims. If you&apos;re playing the long game, this is the only way.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        kicker="About"
        title={
          <>
            One small product &mdash;
            <span className="text-signal">one big loop.</span>
          </>
        }
      />

      <div className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-16">
        <div className="space-y-6 text-base leading-relaxed text-bone-2 md:text-lg">
          <p>
            <strong className="text-bone">Affiliate Autopilot</strong> is an AI
            marketing operating system for affiliate marketers. It starts with the
            question every creator asks:
            <span className="text-bone">
              &ldquo;what should the next campaign do?&rdquo;
            </span>
          </p>
          <p>
            Today the answer is scattered across 10 tools &mdash; one finds products,
            one writes, one posts, and you&apos;re replying to DMs at 2 AM. We stitch
            it into one loop: goal &rarr; research &rarr; strategy &rarr; content &rarr; video &rarr;
            publish &rarr; comment/DM &rarr; track &rarr; optimize &rarr; repeat.
          </p>
          <p>
            The product has its own Character too &mdash; named after your social
            handle &mdash; that thinks daily (thought journal), talks to your audience
            in that personality, and discusses with you what the next move
            should be.
          </p>
          <p className="rounded-xl border border-ink-3 bg-ink-2 p-5 text-sm text-bone-3">
            Note: this product is still building (foundation live, modules
            shipping phase-wise). What&apos;s on the roadmap ships &mdash; no shortcuts, no
            fake testimonials.
          </p>
        </div>

        {/* values */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.t} className="panel p-5">
              <h2 className="font-semibold tracking-tight">{v.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-bone-2">{v.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/signup" className="btn-signal px-6 py-3">
            Join early access &rarr;
          </Link>
          <Link href="/contact" className="btn-ghost px-6 py-3">
            Get in touch
          </Link>
        </div>
      </div>
    </>
  );
}