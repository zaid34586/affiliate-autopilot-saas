import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Affiliate Autopilot Terms of Service.",
  alternates: { canonical: "/legal/terms" },
};

const LAST_UPDATED = "12 Nov 2026";

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

export default function TermsPage() {
  return (
    <article>
      <p className="label text-signal">Legal</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Terms of Service
      </h1>
      <p className="label mt-3 text-bone-3">Last updated: {LAST_UPDATED}</p>

      <div className="rounded-xl border border-amber/40 bg-amber/5 px-5 py-4">
        <p className="text-sm leading-relaxed text-bone-2">
          <strong className="text-amber">Draft notice:</strong> this is a
          product-specific draft of standard SaaS terms &mdash; have a lawyer review
          before launch. Nothing is final until sign-off.
        </p>
      </div>

      <H2>1. Acceptance</H2>
      <P>
        By using Affiliate Autopilot (&ldquo;Service&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) you agree to these
        Terms. If you don&apos;t agree, don&apos;t use the Service. Creating an account
        confirms you&apos;re 18+ and legally able to contract.
      </P>

      <H2>2. Your account</H2>
      <P>
        You&apos;re responsible for your login credentials. One workspace has roles
        (owner/admin/editor/analyst/viewer) &mdash; you decide who does what. Tell us
        if you spot unauthorized access.
      </P>

      <H2>3. Your content & accounts</H2>
      <P>
        Your social accounts, affiliate links, and associated content are yours.
        You grant us a limited license to process, schedule, and publish that
        content &mdash; solely for what the Service is designed to do. You&apos;re
        responsible for what gets posted from your connected accounts.
      </P>

      <H2>4. Autopilot levels</H2>
      <P>
        The Service offers 4 levels (Manual, Semi, Full, Fire-and-forget). You
        choose how much posting/DM automates. Quiet hours, daily caps, and
        anti-spam limits always apply and you can tighten them further.
      </P>

      <H2>5. Subscriptions & billing</H2>
      <P>
        Paid plans bill monthly/yearly (via Stripe/Razorpay). Renewal is
        automatic until cancelled. Cancel and service continues through the
        current billing period. Video quotas are plan-based; BYOK (your Gemini
        key) applies a discount.
      </P>

      <H2>6. Refunds</H2>
      <P>
        First paid subscription: 7-day money-back &mdash; details in Refund Policy.
        Other cases: no pro-rata refund, but you can cancel anytime.
      </P>

      <H2>7. Acceptable use</H2>
      <P>
        Service is for legitimate affiliate marketing. Prohibited: spam,
        misleading claims, scraping, platform ToS violations, unauthorized use
        of others&apos; accounts &mdash; details in Acceptable Use & AI Policy.
      </P>

      <H2>8. AI-generated content disclaimer</H2>
      <P>
        The Service generates content via AI (captions, scripts, videos,
        replies). AI can be wrong or imperfect &mdash; pre-publish review is your
        responsibility. We filter income/health claims, but your niche&apos;s
        compliance rules (FTC/ASA/Indian law) are yours to follow. No income
        guarantees.
      </P>

      <H2>9. Third-party services</H2>
      <P>
        Platforms you connect (Instagram, YouTube, Amazon, ClickBank, Gemini,
        Stripe, etc.) have their own Terms. We use them only per your
        authorization. Their outages or policy changes aren&apos;t our liability.
      </P>

      <H2>10. Warranties & liability</H2>
      <P>
        Service is &ldquo;as is&rdquo; &mdash; no guarantee of uninterrupted, error-free, or
        results-producing operation. To the maximum extent permitted by law, our
        liability is capped at your last 12 months of fees. Some jurisdictions
        don&apos;t allow this &mdash; there our liability is to the fullest extent.
      </P>

      <H2>11. Termination</H2>
      <P>
        You can delete your account anytime. We may suspend/terminate for
        material Terms violations (spam, fraud) &mdash; with notice first, unless
        immediate risk exists.
      </P>

      <H2>12. Changes</H2>
      <P>
        Terms changes trigger email + in-app notice. Continuing after a major
        change = acceptance. Last updated date is at the top.
      </P>

      <H2>13. Contact</H2>
      <P>
        Questions?{" "}
        <a
          href="mailto:hello@affiliateautopilot.app?subject=Terms%20question"
          className="text-signal underline underline-offset-4"
        >
          hello@affiliateautopilot.app
        </a>
      </P>
    </article>
  );
}