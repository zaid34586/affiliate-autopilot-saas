import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Writing on affiliate marketing systems, DM funnels, and AI content engines — arriving at launch.",
  alternates: { canonical: "/blog" },
};

const TOPICS = [
  {
    t: "DM sales engine playbook",
    d: "How to set up the comment → DM funnel, which triggers work, how to avoid spam.",
  },
  {
    t: "Product research frameworks",
    d: "How we pick winners using commission %, trend, and content-fit — behind the AI score.",
  },
  {
    t: "Reels that actually convert",
    d: "Hook tests, first-2-second rules, comparison vs listicle formats — from real experiments.",
  },
  {
    t: "Compliance 101",
    d: "#ad disclosure, income claims, platform ToS — what's right for the long game.",
  },
];

export default function BlogPage() {
  return (
    <>
      <PageHeader
        kicker="Blog"
        title={
          <>
            Writing that comes
            <span className="text-signal">from inside the system.</span>
          </>
        }
        sub="Practical guides on affiliate systems, DM funnels, and AI content engines — no listicle bait."
      />

      <section className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-16">
        <div className="rounded-xl border border-amber/40 bg-amber/5 px-5 py-4">
          <p className="label text-amber">Status: coming soon</p>
          <p className="mt-2 text-sm leading-relaxed text-bone-2">
            Blog is in wireframe stage (MDX setup planned for Phase 1). First post
            lands here first.
          </p>
        </div>

        <p className="label mt-10 text-signal">Planned topics</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {TOPICS.map((t) => (
            <div key={t.t} className="panel p-5">
              <h2 className="font-semibold tracking-tight">{t.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-bone-2">{t.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/signup" className="btn-signal px-6 py-3">
            Get early access →
          </Link>
          <Link href="/docs" className="btn-ghost px-6 py-3">
            Read docs
          </Link>
        </div>
      </section>
    </>
  );
}