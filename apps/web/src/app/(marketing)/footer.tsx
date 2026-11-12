import Link from "next/link";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Integrations", href: "/integrations" },
      { label: "Solutions", href: "/solutions" },
      { label: "Demo", href: "/demo" },
      { label: "Customers", href: "/customers" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Resources", href: "/resources" },
      { label: "Help center", href: "/help" },
      { label: "Documentation", href: "/docs" },
      { label: "Status", href: "/security" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Security", href: "/security" },
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Refund Policy", href: "/legal/refunds" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-ink-3 bg-ink-2">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="grid gap-10 md:grid-cols-5">
          {/* brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="status-dot bg-signal pulse-slow" />
              <span className="label text-bone">Affiliate Autopilot</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-bone-3">
              AI marketing operating system for affiliate marketers — research
              to DM sales, all on 24/7 autopilot.
            </p>
            <p className="label mt-5 text-bone-3">
              © {new Date().getFullYear()} Affiliate Autopilot
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="label mb-4 text-bone-2">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-bone-3 transition-colors hover:text-signal"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* bottom bar */}
        <div className="mt-12 flex flex-col gap-3 border-t border-ink-3 pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-xs leading-relaxed text-bone-3">
            Affiliate disclosure: some product links on this platform are
            affiliate links. We may earn a commission at no extra cost to you.
          </p>
          <p className="label text-bone-3">Built for the 24/7 era</p>
        </div>
      </div>
    </footer>
  );
}
