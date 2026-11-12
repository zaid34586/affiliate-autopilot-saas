import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceptable Use & AI Policy",
  description:
    "What's allowed, what's not — and your responsibility with AI content.",
  alternates: { canonical: "/legal/acceptable-use" },
};

const BANNED = [
  "Spam &mdash; bulk unsolicited DMs, comment flooding, mass follow/unfollow tricks",
  "Misleading claims &mdash; fake income/health claims, doctored results, fake urgency",
  "Platform ToS violations &mdash; unofficial APIs, scraping logged-in sessions, automation where platform forbids it",
  "Unauthorized use of others&apos; accounts or intellectual property",
  "Illegal content &mdash; fraud, counterfeit, adult content (where platform/plan disallows), hate/harassment",
  "Crypto/health niche false guarantees and regulatory violations",
  "Service misuse &mdash; credential sharing, reverse engineering, overload/testing without permission",
];

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

export default function AcceptableUsePage() {
  return (
    <article>
      <p className="label text-signal">Legal</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Acceptable Use & AI Policy
      </h1>
      <p className="label mt-3 text-bone-3">Last updated: 12 Nov 2026</p>

      <H2>1. Allowed use</H2>
      <P>
        Legitimate affiliate marketing: promoting products in your niche,
        publishing content on your accounts, replying helpfully to genuine
        audience comments. That&apos;s it.
      </P>

      <H2>2. Banned</H2>
      <ul className="mt-4 space-y-2.5">
        {BANNED.map((b) => (
          <li
            key={b}
            className="flex items-start gap-3 text-sm leading-relaxed text-bone-2"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
            {b}
          </li>
        ))}
      </ul>

      <H2>3. DM engine rules (enforced by us)</H2>
      <P>
        Every connected account has built-in anti-spam limits that can&apos;t be
        disabled: max one DM per user per 24 hours, daily DM caps, quiet hours,
        blocklist, negative sentiment skip. These protect both platform rules
        and your audience.
      </P>

      <H2>4. Content compliance</H2>
      <P>
        We auto-add affiliate disclosure (#ad / &ldquo;affiliate link&rdquo;) and block
        false claims (income/health guarantees). Where platforms require
        AI-content labels, those apply too. Still &mdash; final pre-publish review is
        your responsibility, per your niche&apos;s regulations (FTC, ASA, Indian
        consumer rules).
      </P>

      <H2>5. AI-specific terms</H2>
      <P>
        <strong className="text-bone">AI content:</strong> captions, scripts,
        videos, and replies are AI-generated &mdash; they can be inaccurate. You
        confirm you review AI content before publishing.
      </P>
      <P>
        <strong className="text-bone">Character:</strong> your AI persona,
        named from your handle, speaks in your brand voice. Guardrails exist (no
        fabricated claims, no guaranteed-income promises) &mdash; but it&apos;s still AI,
        so your supervision is required.
      </P>
      <P>
        <strong className="text-bone">No bots created:</strong> we use only
        official APIs. No fake engagement (buying followers, engagement pods),
        no platform-manual automation bypasses.
      </P>

      <H2>6. Enforcement</H2>
      <P>
        Violation found: first warning + limit tightening (lower DM caps), then
        posting disabled, then account termination for repeated/severe cases
        (with Refund Policy exceptions). Fraud/legal risk = immediate action.
      </P>

      <H2>7. Report</H2>
      <P>
        Someone violating this against you?{" "}
        <a
          href="mailto:hello@affiliateautopilot.app?subject=Abuse%20report"
          className="text-signal underline underline-offset-4"
        >
          hello@affiliateautopilot.app
        </a>{" "}
        &mdash; 24h review.
      </P>
    </article>
  );
}