import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../components/page-header";

export const metadata: Metadata = {
  title: "Customers",
  description:
    "Affiliate Autopilot is pre-launch &mdash; no fake testimonials here. Join early access.",
  alternates: { canonical: "/customers" },
};

export default function CustomersPage() {
  return (
    <>
      <PageHeader
        kicker="Customers"
        title={
          <>
            No fake testimonials
            <span className="text-signal">here.</span>
          </>
        }
        sub="Product is still building. So no numbers, no quotes &mdash; not 10,000 users, not $50K earnings. What&apos;s here will be real."
      />

      <section className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-16">
        <div className="space-y-6 text-base leading-relaxed text-bone-2">
          <div className="panel p-6">
            <p className="label text-amber">Status: pre-launch</p>
            <p className="mt-3">
              Foundation is live (auth, workspaces, onboarding, dashboard),
              modules shipping phase-wise. When the first paying customers arrive
              and results verify &mdash; their stories go here, with permission, real
              numbers included.
            </p>
          </div>

          <div className="panel p-6">
            <p className="label text-signal">First wave: founding members</p>
            <p className="mt-3">
              Launch pricing locked, direct line to the builder, roadmap vote &mdash;
              that&apos;s what founding members get. You can join from day one.
            </p>
          </div>

          <div className="rounded-xl border border-ink-3 bg-ink-2 p-6">
            <p className="label text-bone-3">Are you in?</p>
            <p className="mt-3">
              If you do affiliate marketing and want a system that runs overnight
              &mdash; grab early access. First 100 members get direct roadmap input
              too.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-signal px-6 py-3">
                Join early access &rarr;
              </Link>
              <Link href="/about" className="btn-ghost px-6 py-3">
                Read about us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}