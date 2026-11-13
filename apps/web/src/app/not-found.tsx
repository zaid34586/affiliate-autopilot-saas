import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid-dots flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-7xl font-semibold text-signal md:text-8xl">
        404
      </p>
      <p className="label mt-4 text-bone-3">page not found</p>
      <h1 className="mt-6 max-w-md text-2xl font-semibold tracking-tight md:text-3xl">
        This page does not exist — the link may be outdated.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-bone-2">
        No worries — the autopilot runs 24/7. Start from the links below.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-signal px-6 py-3">
          ← Back home
        </Link>
        <Link href="/features" className="btn-ghost px-6 py-3">
          View features
        </Link>
      </div>
    </div>
  );
}
