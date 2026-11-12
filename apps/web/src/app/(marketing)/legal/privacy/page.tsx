import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What data we collect, where it's stored, and how to export or delete it.",
  alternates: { canonical: "/legal/privacy" },
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

export default function PrivacyPage() {
  return (
    <article>
      <p className="label text-signal">Legal</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Privacy Policy
      </h1>
      <p className="label mt-3 text-bone-3">Last updated: 12 Nov 2026</p>

      <div className="rounded-xl border border-amber/40 bg-amber/5 px-5 py-4">
        <p className="text-sm leading-relaxed text-bone-2">
          <strong className="text-amber">Draft notice:</strong> this is a
          GDPR/DPDP-structured draft &mdash; legal review required before launch.
        </p>
      </div>

      <H2>1. Data we collect</H2>
      <P>
        <strong className="text-bone">Account data:</strong> email, password
        (bcrypt-hashed), name/handle. <strong className="text-bone">
        Workspace data:</strong> niche, tone settings, affiliate network IDs,
        content and posts you create. <strong className="text-bone">
        Connected account data:</strong> limited profile/analytics from social
        and affiliate platforms (with your authorization). <strong className="text-bone">
        Usage data:</strong> device, browser, pages &mdash; for product improvement.
      </P>

      <H2>2. OAuth tokens</H2>
      <P>
        When you connect Instagram/YouTube/etc., we receive access/refresh
        tokens. These are <strong className="text-bone">AES-256 encrypted</strong>
        in our token vault, stored server-side only, and never reach the
        browser. Disconnect = token permanently deleted.
      </P>

      <H2>3. How we use data</H2>
      <P>
        To run the Service (posting, DM replies, analytics, billing), support,
        abuse prevention, and product improvement. We don&apos;t sell data &mdash; ever.
        No third-party ad trackers.
      </P>

      <H2>4. AI processing</H2>
      <P>
        To generate content, necessary context goes to AI models (e.g., Gemini
        API) &mdash; product details, draft captions. We never send passwords or
        payment data to AI. AI providers have data-processing terms.
      </P>

      <H2>5. Legal bases (GDPR)</H2>
      <P>
        Contract performance (running the Service), legitimate interests
        (security, improvement), consent (marketing emails, optional cookies),
        legal obligation (billing records).
      </P>

      <H2>6. Sharing</H2>
      <P>
        Only vendors who need it: hosting (Supabase), payments (Stripe/Razorpay),
        email, AI APIs &mdash; all under contract. Legal requirements honored. No
        data sales.
      </P>

      <H2>7. Retention</H2>
      <P>
        Data kept while account exists &mdash; 30 days after deletion (backup cycles).
        Billing records retained per tax law requirements.
      </P>

      <H2>8. Your rights</H2>
      <P>
        Under GDPR/DPDP: access, correction, export, deletion, objection.
        Dashboard &rarr; Settings &rarr; Security for one-click export/delete, or email{" "}
        <a
          href="mailto:hello@affiliateautopilot.app?subject=Privacy%20request"
          className="text-signal underline underline-offset-4"
        >
          hello@affiliateautopilot.app
        </a>
        . Response within 30 days.
      </P>

      <H2>9. Security</H2>
      <P>
        TLS in transit, encryption at rest, daily backups, RBAC, audit logs.
        No system is 100% secure &mdash; if breach occurs, affected users notified
        within 72 hours (where law requires).
      </P>

      <H2>10. International transfers</H2>
      <P>
        Data may be hosted in India/US/EU regions (Supabase/AWS). Standard
        contractual clauses for GDPR.
      </P>

      <H2>11. Children</H2>
      <P>
        Service is 18+. We don&apos;t knowingly collect children&apos;s data.
      </P>

      <H2>12. Changes & contact</H2>
      <P>
        Policy changes trigger email + in-app notice. Questions:{" "}
        <a
          href="mailto:hello@affiliateautopilot.app?subject=Privacy%20question"
          className="text-signal underline underline-offset-4"
        >
          hello@affiliateautopilot.app
        </a>
      </P>
    </article>
  );
}