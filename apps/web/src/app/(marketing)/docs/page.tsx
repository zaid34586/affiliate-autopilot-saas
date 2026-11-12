import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Product documentation — module guides, concepts, and API docs (expanding at launch).",
  alternates: { canonical: "/docs" },
};

const DOCS = [
  {
    g: "Product guides",
    items: [
      { t: "Quickstart — first day", status: "draft", d: "Setup, connections, first autopilot schedule." },
      { t: "Autopilot levels explained", status: "planned", d: "Manual / Semi / Full / Fire-and-forget — what's automatic." },
      { t: "DM engine configuration", status: "planned", d: "Triggers, caps, cooldowns, approval modes." },
      { t: "Video engine & BYOK", status: "planned", d: "Platform pool vs your Gemini key, quota math." },
    ],
  },
  {
    g: "Concepts",
    items: [
      { t: "AI Product Score", status: "planned", d: "How the 0–100 score is calculated — which factors." },
      { t: "Attribution: post → click → sale", status: "planned", d: "UTM, short links, network conversions." },
      { t: "Character & guardrails", status: "planned", d: "How the persona forms, what it never claims." },
    ],
  },
  {
    g: "Developers (at launch)",
    items: [
      { t: "REST API reference", status: "planned", d: "API keys, rate limits, webhooks." },
      { t: "Webhook events", status: "planned", d: "post.published, dm.sent, conversion.synced…" },
    ],
  },
];

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "drafting", cls: "border-amber/40 bg-amber/10 text-amber" },
  planned: { label: "planned", cls: "border-ink-4 bg-ink text-bone-3" },
};

export default function DocsPage() {
  return (
    <>
      <PageHeader
        kicker="Documentation"
        title={
          <>
            Docs —
            <span className="text-signal">currently skeleton.</span>
          </>
        }
        sub="Documentation builds alongside the product, phase by phase. Honest status on what exists, what's drafting."
      />

      <div className="mx-auto max-w-4xl px-4 py-14 md:px-6 md:py-16">
        <div className="space-y-10">
          {DOCS.map((grp) => (
            <section key={grp.g}>
              <p className="label text-signal">{grp.g}</p>
              <div className="mt-4 space-y-3">
                {grp.items.map((it) => (
                  <div
                    key={it.t}
                    className="panel flex flex-wrap items-start justify-between gap-3 p-5"
                  >
                    <div>
                      <h2 className="font-medium">{it.t}</h2>
                      <p className="mt-1.5 text-sm text-bone-2">{it.d}</p>
                    </div>
                    <span
                      className={`label shrink-0 rounded border px-1.5 py-0.5 ${STATUS[it.status].cls}`}
                    >
                      {STATUS[it.status].label}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-ink-3 bg-ink-2 p-8 text-center">
          <p className="label text-bone-3">For now</p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight md:text-2xl">
            Module details are on /features.
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/features" className="btn-signal px-6 py-3">
              View features →
            </Link>
            <Link href="/help" className="btn-ghost px-6 py-3">
              Help center
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}