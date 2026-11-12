import { findNavItem } from "@/lib/nav";

/**
 * Har module ka Phase-0 skeleton — structure + empty state dikhta hai,
 * data uske phase mein aayega.
 */
export function ModulePage({
  href,
  extra,
}: {
  href: string;
  extra?: React.ReactNode;
}) {
  const item = findNavItem(href);
  if (!item) return null;

  return (
    <div>
      <header className="mb-7">
        <p className="label text-bone-3">
          {item.index} · {item.phase === "live" ? "live" : `coming in ${item.phase}`}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
          {item.module}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-bone-2 md:text-base">
          {item.summary}
        </p>
      </header>

      {extra}

      <div className="grid-dots flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-4 px-6 py-16 text-center">
        <span className="label rounded border border-ink-4 bg-ink-2 px-2 py-1 text-amber">
          {item.phase === "live" ? "empty state" : `${item.phase} — not wired yet`}
        </span>
        <p className="mt-5 text-lg font-medium text-bone-2">
          Abhi yahan data nahi hai
        </p>
        <p className="mt-1.5 max-w-md text-sm text-bone-3">
          {item.phase === "live"
            ? "Upar wale checklist se shuru karo."
            : `Phase 0 foundation ke baad — ${item.phase} mein ye module live ho jayega. Structure abhi se ready hai.`}
        </p>

        <ul className="mt-7 grid w-full max-w-lg gap-2.5 text-left">
          {item.bullets.map((b) => (
            <li
              key={b}
              className="flex items-start gap-3 rounded-lg border border-ink-3 bg-ink-2 px-3.5 py-2.5 text-sm text-bone-2"
            >
              <span className="status-dot mt-1.5 bg-signal-dim" />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
