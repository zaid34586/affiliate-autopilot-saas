import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Every release, every module, what shipped — straight up.",
  alternates: { canonical: "/changelog" },
};

const ENTRIES = [
  {
    v: "Phase 0 &mdash; Foundation",
    date: "shipped",
    tag: "live",
    items: [
      "Supabase DB: 21 tables (workspaces, products, content, connections, autopilot&hellip;)",
      "NextAuth v5 &mdash; credentials login + workspace auto-provision",
      "4-step onboarding wizard (niche &rarr; affiliate &rarr; handle/tone &rarr; character reveal)",
      "Dashboard shell: 12 modules, overview command center, character page",
      "Design system, seed data, smoke tests (13/13), CI green",
    ],
  },
  {
    v: "Phase 1 &mdash; Public website",
    date: "in progress",
    tag: "wip",
    items: [
      "Landing page: hero console preview, 10-step loop, modules, pricing teaser, FAQ + JSON-LD",
      "Inner pages: features, pricing, solutions, integrations (honest status tags), security, about, contact",
      "Demo timeline, honest customers page, help/docs skeletons, changelog (this page)",
      "Legal pages + 404 + sitemap/robots",
    ],
  },
];

const NEXT = [
  "Phase 2 &mdash; SaaS core: connections page, RBAC, token vault, autopilot settings",
  "Phase 3 &mdash; DM engine + comment webhooks (flagship)",
  "Phase 4 &mdash; Video engine + render queue + R2",
];

const TAG: Record<string, string> = {
  live: "border-signal/40 bg-signal/10 text-signal",
  wip: "border-amber/40 bg-amber/10 text-amber",
};

export default function ChangelogPage() {
  return (
    <>
      <PageHeader
        kicker="Changelog"
        title={
          <>
            What shipped
            <span className="text-signal">is what&apos;s here.</span>
          </>
        }
        sub="Honest status per phase &mdash; what&apos;s live is live, what&apos;s pending is pending. No overclaims."
      />

      <div className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-16">
        <div className="space-y-6">
          {ENTRIES.map((e) => (
            <article key={e.v} className="panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight md:text-xl">
                  {e.v}
                </h2>
                <span
                  className={`label rounded border px-2 py-0.5 ${TAG[e.tag]}`}
                >
                  {e.date}
                </span>
              </div>
              <ul className="mt-4 space-y-2.5">
                {e.items.map((i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm leading-relaxed text-bone-2"
                  >
                    <span className="status-dot mt-1.5 shrink-0 bg-signal-dim" />
                    {i}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {/* coming next */}
        <div className="mt-10 rounded-2xl border border-ink-3 bg-ink-2 p-6">
          <p className="label text-signal">Coming next</p>
          <ol className="mt-4 space-y-2.5">
            {NEXT.map((n, i) => (
              <li
                key={n}
                className="flex items-start gap-3 text-sm text-bone-2"
              >
                <span className="label mt-0.5 text-bone-3">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {n}
              </li>
            ))}
          </ol>
          <p className="label mt-5 text-bone-3">
            public roadmap &mdash; /ROADMAP.md has the full 10-phase plan
          </p>
        </div>

        <div className="mt-10 text-center">
          <Link href="/signup" className="btn-signal px-6 py-3">
            Get early access &rarr;
          </Link>
        </div>
      </div>
    </>
  );
}