import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Templates, checklists, and playbooks for affiliate marketers — arriving at launch.",
  alternates: { canonical: "/resources" },
};

const PLANNED = [
  {
    t: "DM trigger template pack",
    d: "20+ tested trigger phrases (Hindi + English) — which comment gets which reply, ready to import.",
    type: "Template",
  },
  {
    t: "Affiliate disclosure cheat-sheet",
    d: "FTC/ASA/Indian rules — where #ad goes, what to write, platform-by-platform.",
    type: "Checklist",
  },
  {
    t: "Reel hook swipe file",
    d: "40+ hook structures tested for conversion — adapt to your niche.",
    type: "Swipe file",
  },
  {
    t: "Niche selection worksheet",
    d: "Framework to pick niches using commission %, competition, and content-fit.",
    type: "Worksheet",
  },
  {
    t: "Weekly autopilot review template",
    d: "15-minute review — what worked, what to kill, next week's plan.",
    type: "Template",
  },
];

export default function ResourcesPage() {
  return (
    <>
      <PageHeader
        kicker="Resources"
        title={
          <>
            Templates that ship
            <span className="text-signal">with the system.</span>
          </>
        }
        sub="No generic PDFs — the same checklists and templates used inside the product. Currently drafting."
      />

      <section className="mx-auto max-w-4xl px-4 py-14 md:px-6 md:py-16">
        <div className="rounded-xl border border-amber/40 bg-amber/5 px-5 py-4">
          <p className="label text-amber">Status: in the works</p>
          <p className="mt-2 text-sm leading-relaxed text-bone-2">
            Resources ship at launch — product modules first (roadmap Phase 1 → 7).
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {PLANNED.map((r) => (
            <div
              key={r.t}
              className="panel flex flex-wrap items-start justify-between gap-3 p-5"
            >
              <div>
                <h2 className="font-medium">{r.t}</h2>
                <p className="mt-1.5 text-sm text-bone-2">{r.d}</p>
              </div>
              <span className="label shrink-0 rounded border border-ink-4 bg-ink px-1.5 py-0.5 text-bone-3">
                {r.type} — coming soon
              </span>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/signup" className="btn-signal px-6 py-3">
            Early access →
          </Link>
          <Link href="/blog" className="btn-ghost px-6 py-3">
            View blog
          </Link>
        </div>
      </section>
    </>
  );
}