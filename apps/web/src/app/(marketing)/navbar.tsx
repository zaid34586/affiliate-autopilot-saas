"use client";

import Link from "next/link";
import { useState } from "react";

const NAV = [
  { label: "Product", href: "/features" },
  { label: "Solutions", href: "/solutions" },
  { label: "Integrations", href: "/integrations" },
  { label: "Pricing", href: "/pricing" },
  { label: "Resources", href: "/blog" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-ink-3 bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        {/* logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <span className="status-dot bg-signal pulse-slow" />
          <span className="label text-bone">Affiliate Autopilot</span>
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-bone-2 transition-colors hover:bg-ink-2 hover:text-bone"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm text-bone-2 transition-colors hover:text-bone"
          >
            Log in
          </Link>
          <Link href="/signup" className="btn-signal">
            Get started — free
          </Link>
        </div>

        {/* mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="label rounded-lg border border-ink-4 px-3 py-2 text-bone-2 md:hidden"
          aria-label="Toggle menu"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {/* mobile menu */}
      {open && (
        <div className="border-t border-ink-3 bg-ink px-4 pb-5 pt-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-bone-2 hover:bg-ink-2 hover:text-bone"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2.5">
            <Link href="/login" className="btn-ghost w-full">
              Log in
            </Link>
            <Link href="/signup" className="btn-signal w-full">
              Get started — free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
