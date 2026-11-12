import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { template: "%s — Legal", default: "Legal" },
};

const LINKS = [
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Cookie Policy", href: "/legal/cookies" },
  { label: "Refund Policy", href: "/legal/refunds" },
  { label: "Acceptable Use & AI Policy", href: "/legal/acceptable-use" },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-16">
      <nav className="mb-10 flex flex-wrap gap-2">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="label rounded-lg border border-ink-4 px-3 py-2 text-bone-2 transition-colors hover:border-signal hover:text-signal"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="prose-legal max-w-3xl">{children}</div>
    </div>
  );
}
