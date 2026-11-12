import type { Metadata } from "next";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "Contact",
  description: "Support, sales, and partnerships — all in one place.",
  alternates: { canonical: "/contact" },
};

const CHANNELS = [
  {
    t: "Support",
    d: "Product issues, billing, account &mdash; need a fast answer? Pro plan gets priority support.",
    mail: "hello@affiliateautopilot.app",
    subject: "Support request",
  },
  {
    t: "Sales / Agencies",
    d: "Team plans, custom workspaces, agency onboarding &mdash; demo available too.",
    mail: "hello@affiliateautopilot.app",
    subject: "Sales enquiry",
  },
  {
    t: "Partnerships",
    d: "Affiliate networks, integrations, creator collaborations.",
    mail: "hello@affiliateautopilot.app",
    subject: "Partnership",
  },
  {
    t: "Security",
    d: "Vulnerability reports &mdash; responsible disclosure, credit included.",
    mail: "hello@affiliateautopilot.app",
    subject: "Security report",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        kicker="Contact"
        title={
          <>
            Talk to us &mdash;
            <span className="text-signal">we&apos;re listening.</span>
          </>
        }
        sub="Reply typically within 24 hours (working days). Pro/Agency gets priority."
      />

      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-16">
        <div className="grid gap-4 md:grid-cols-2">
          {CHANNELS.map((c) => (
            <a
              key={c.t}
              href={`mailto:${c.mail}?subject=${encodeURIComponent(c.subject)}`}
              className="panel panel-hover group p-6 hover:border-signal/50"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">{c.t}</h2>
                <span className="label text-bone-3 transition-colors group-hover:text-signal">
                  mail &rarr;
                </span>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-bone-2">
                {c.d}
              </p>
              <p className="label mt-4 text-signal">{c.mail}</p>
            </a>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-ink-3 bg-ink-2 p-7">
          <p className="label text-bone-3">Office hours</p>
          <p className="mt-2 text-sm text-bone-2">
            Mon&ndash;Fri, 10:00&ndash;19:00 IST &middot; Critical billing issues: 24&times;7 webhook
            monitoring (auto-alerts).
          </p>
        </div>
      </div>
    </>
  );
}