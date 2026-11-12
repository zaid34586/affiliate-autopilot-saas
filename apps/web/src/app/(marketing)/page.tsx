import Link from "next/link";

/**
 * Phase 0 placeholder — asli marketing site Phase 1 mein banegi
 * (landing, pricing, legal sab).
 */
export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2.5">
          <span className="status-dot bg-signal pulse-slow" />
          <span className="label text-bone">Affiliate Autopilot</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn-signal">
            Get started
          </Link>
        </nav>
      </header>

      <section className="grid-dots flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="label mb-6 text-signal">
          Ai marketing operating system
        </p>
        <h1 className="max-w-4xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          Your affiliate marketing team,
          <br />
          <span className="text-signal">running 24/7.</span>
        </h1>
        <p className="mt-6 max-w-xl text-bone-2 md:text-lg">
          Products dhundhta hai, links banata hai, reels generate karta hai,
          post karta hai, comments ka DM mein link bhejta hai — sab apne aap.
          Phase 0 foundation abhi live hai.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="btn-signal px-6 py-3 text-base">
            Start free →
          </Link>
          <Link href="/login" className="btn-ghost px-6 py-3 text-base">
            I have an account
          </Link>
        </div>
        <p className="label mt-14 text-bone-3">
          Foundation phase · public site coming in phase 1
        </p>
      </section>
    </main>
  );
}
