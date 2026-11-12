import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "What cookies we use, what they do, how to control them.",
  alternates: { canonical: "/legal/cookies" },
};

const COOKIES = [
  {
    n: "next-auth.session-token",
    type: "Essential",
    d: "Maintains login session (JWT, httpOnly, secure).",
  },
  {
    n: "csrf / callback state",
    type: "Essential",
    d: "Auth flow security &mdash; temporary.",
  },
  {
    n: "Analytics (optional)",
    type: "Analytics",
    d: "If enabled, anonymized page views. At launch: minimal or none.",
  },
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

export default function CookiesPage() {
  return (
    <article>
      <p className="label text-signal">Legal</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Cookie Policy
      </h1>
      <p className="label mt-3 text-bone-3">Last updated: 12 Nov 2026</p>

      <H2>Short version</H2>
      <P>
        We use essential cookies (login session) &mdash; the Service can&apos;t work
        without them. No ad-tracking cookies, no selling.
      </P>

      <H2>Cookies we use</H2>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="border-b border-ink-4">
              <th className="label py-2.5 text-left text-bone-3">Cookie</th>
              <th className="label py-2.5 text-left text-bone-3">Type</th>
              <th className="label py-2.5 text-left text-bone-3">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map((c) => (
              <tr key={c.n} className="border-b border-ink-3">
                <td className="py-3 font-mono text-xs text-bone">{c.n}</td>
                <td className="py-3 text-sm text-bone-2">{c.type}</td>
                <td className="py-3 text-sm text-bone-2">{c.d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Control</H2>
      <P>
        Delete essential cookies via browser settings &mdash; you&apos;ll be logged out.
        We don&apos;t use third-party ad cookies, so no consent banner needed
        (unless optional analytics is added &mdash; then we&apos;ll ask first).
      </P>

      <H2>Changes</H2>
      <P>
        New cookie = policy update + notice. Questions:{" "}
        <a
          href="mailto:hello@affiliateautopilot.app?subject=Cookie%20question"
          className="text-signal underline underline-offset-4"
        >
          hello@affiliateautopilot.app
        </a>
      </P>
    </article>
  );
}