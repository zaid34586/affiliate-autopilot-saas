import type { Metadata } from "next";

export function PageHeader({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: React.ReactNode;
  sub?: string;
}) {
  return (
    <header className="grid-dots border-b border-ink-3">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <p className="label text-signal">{kicker}</p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-[1.08] tracking-tight md:text-5xl">
          {title}
        </h1>
        {sub && (
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-bone-2 md:text-lg">
            {sub}
          </p>
        )}
      </div>
    </header>
  );
}

/** Metadata helper — consistent title template ke saath. */
export function pageMeta(title: string, description: string): Metadata {
  return { title, description };
}
