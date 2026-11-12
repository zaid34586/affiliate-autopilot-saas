import Link from "next/link";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* announcement bar */}
      <div className="border-b border-ink-3 bg-ink-2">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2 text-center">
          <span className="status-dot bg-signal pulse-slow" />
          <p className="label text-bone-2">
            Early access open — founding members get{" "}
            <span className="text-signal">launch pricing locked</span>
          </p>
          <Link
            href="/signup"
            className="label hidden text-signal underline underline-offset-4 hover:text-bone sm:block"
          >
            join →
          </Link>
        </div>
      </div>

      <Navbar />

      <main className="flex-1">{children}</main>

      <Footer />
    </div>
  );
}
