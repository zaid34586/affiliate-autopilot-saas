import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "7-day money-back, video quota, cancellations — all clear.",
  alternates: { canonical: "/legal/refunds" },
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 text-xl font-semibold tracking-tight text-bone">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-sm leading-relaxed text-bone-2 md:text-base">
      {children}
    </p>
  );
}

export default function RefundsPage() {
  return (
    <article>
      <p className="label text-signal">Legal</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Refund Policy
      </h1>
      <p className="label mt-3 text-bone-3">Last updated: 12 Nov 2026</p>

      <div className="rounded-xl border border-signal/40 bg-signal/5 px-5 py-4">
        <p className="text-sm leading-relaxed text-bone-2">
          <strong className="text-signal">Simple rule:</strong> first paid
          subscription gets 7-day money-back &mdash; no questions.
        </p>
      </div>

      <H2>7-day money-back (first paid plan)</H2>
      <P>
        If you subscribe to Starter/Pro/Agency for the first time and cancel
        within 7 days &mdash; full refund, no questions. Email{" "}
        <a
          href="mailto:hello@affiliateautopilot.app?subject=Refund%20request"
          className="text-signal underline underline-offset-4"
        >
          hello@affiliateautopilot.app
        </a>{" "}
        (subject: &ldquo;Refund request&rdquo;) or use the support channel. Refund hits
        original payment method in 5&ndash;10 business days.
      </P>

      <H2>Renewals</H2>
      <P>
        No 7-day window on renewals (monthly cycle). Renewal reminder email
        goes out first &mdash; cancel there if needed.
      </P>

      <H2>Cancellation</H2>
      <P>
        Settings &rarr; Billing &rarr; one click. Cancel and plan runs through the
        billing period end, then drops to Free. No pro-rata refund on renewals
        (unless the 7-day window above applies).
      </P>

      <H2>Video quota & top-ups</H2>
      <P>
        Monthly video quota used = no refund (cost already incurred). Unused
        top-up packs refundable if within 7-day window.
      </P>

      <H2>Free plan & trials</H2>
      <P>
        Free plan has no charge &mdash; no refund needed. 7-day Pro trial (card
        required) &mdash; cancel during trial, no charge.
      </P>

      <H2>Exceptions</H2>
      <P>
        Refund may be denied for: (a) policy abuse (repeated refund fraud),
        (b) account terminated for Terms violation. Otherwise we decide
        humanly &mdash; keeping it simple.
      </P>

      <H2>How to request</H2>
      <P>
        Email{" "}
        <a
          href="mailto:hello@affiliateautopilot.app?subject=Refund%20request"
          className="text-signal underline underline-offset-4"
        >
          hello@affiliateautopilot.app
        </a>{" "}
        from your account email. Include: plan, payment date, reason
        (optional). Typical response: 1 business day.
      </P>
    </article>
  );
}