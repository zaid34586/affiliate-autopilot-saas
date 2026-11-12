import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "Security & Trust",
  description:
    "AES-256 token vault, TLS, daily backups, GDPR export/delete, hosted payments — complete security posture.",
  alternates: { canonical: "/security" },
};

const PILLARS = [
  {
    t: "Token vault",
    items: [
      "All OAuth/API tokens AES-256 encrypted at rest (server-side)",
      "Tokens never reach the browser/client — server calls only",
      "Auto-refresh rotation + per-connection revoke UI",
      "Disconnect = token permanently deleted (GDPR)",
    ],
  },
  {
    t: "Data protection",
    items: [
      "Encryption in transit (TLS 1.2+) — every request",
      "Encryption at rest — managed PostgreSQL (Supabase)",
      "Daily automated backups + point-in-time recovery",
      "GDPR: export or delete your data in one click",
    ],
  },
  {
    t: "Payments",
    items: [
      "Stripe/Razorpay hosted checkout — card data never on our servers",
      "PCI scope minimal (Level 4 SAQ-A)",
      "Webhook signatures verified + idempotency",
    ],
  },
  {
    t: "Platform & abuse",
    items: [
      "Official APIs only — no scraping, platform ToS respected",
      "Rate limiting: API + DM + render caps per workspace",
      "Signup CAPTCHA + free-tier fraud detection",
      "Every chargeable action audit-logged (jobs_audit + credits)",
    ],
  },
  {
    t: "Content compliance",
    items: [
      "Auto affiliate disclosure (#ad) — per FTC/ASA rules",
      "False-claim filter — income/health claims blocked",
      "AI-generated content label where platform requires",
      "No 'guaranteed income' marketing claims — ever",
    ],
  },
  {
    t: "Engineering",
    items: [
      "Secrets in env/secrets manager — never in repo",
      "Role-based access control (owner/admin/editor/analyst/viewer)",
      "Org isolation tests — no cross-workspace data leaks",
      "Dependency scanning + pre-commit hooks",
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHeader
        kicker="Security & trust"
        title={
          <>
            Your accounts.
            <span className="text-signal">Your control.</span>
          </>
        }
        sub="Affiliate links and social accounts = your revenue. That's why security isn't a feature — it's architecture."
      />

      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-16">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.t} className="panel p-6">
              <h2 className="text-lg font-semibold tracking-tight">{p.t}</h2>
              <ul className="mt-4 space-y-2.5">
                {p.items.map((i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm leading-relaxed text-bone-2"
                  >
                    <span className="status-dot mt-1.5 shrink-0 bg-signal-dim" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* incident / contact */}
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-ink-3 bg-ink-2 p-7">
            <p className="label text-amber">Security report</p>
            <p className="mt-3 text-sm leading-relaxed text-bone-2">
              Found a vulnerability? Responsible disclosure — we&apos;ll confirm and
              credit you. (Security inbox goes public at launch.)
            </p>
            <Link href="/contact" className="btn-ghost mt-5 inline-flex">
              How to report →
            </Link>
          </div>
          <div className="rounded-2xl border border-ink-3 bg-ink-2 p-7">
            <p className="label text-signal">Your data</p>
            <p className="mt-3 text-sm leading-relaxed text-bone-2">
              Export or permanently delete your data — dashboard → Settings →
              Security. Ready for GDPR/DPDP both.
            </p>
            <Link href="/legal/privacy" className="btn-ghost mt-5 inline-flex">
              Privacy Policy →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}