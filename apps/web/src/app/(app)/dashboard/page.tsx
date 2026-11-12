import Link from "next/link";
import type { Metadata } from "next";
import { eq, count } from "drizzle-orm";
import { autopilotConfig, characters, connections } from "@aa/db";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/session";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { user, workspace } = await requireWorkspace();

  const [character] = await db
    .select({ name: characters.name, bio: characters.bio })
    .from(characters)
    .where(eq(characters.workspaceId, workspace.id))
    .limit(1);

  const [connCount] = await db
    .select({ value: count() })
    .from(connections)
    .where(eq(connections.workspaceId, workspace.id));

  const [autopilot] = await db
    .select({ level: autopilotConfig.level, paused: autopilotConfig.paused })
    .from(autopilotConfig)
    .where(eq(autopilotConfig.workspaceId, workspace.id))
    .limit(1);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const checklist = [
    {
      done: Boolean(character),
      label: "Onboarding complete — niche + character set",
      href: "/onboarding",
      cta: character ? "Review" : "Start setup",
    },
    {
      done: (connCount?.value ?? 0) > 0,
      label: "Connect your first account (social / affiliate)",
      href: "/dashboard/connections",
      cta: "Connect",
    },
    {
      done: autopilot && autopilot.level !== "manual",
      label: "Turn on Autopilot (Phase 5 mein live hoga)",
      href: "/dashboard/autopilot",
      cta: "Open",
    },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  const stats = [
    { label: "Clicks today", value: "0" },
    { label: "Conversions", value: "0" },
    { label: "Earnings", value: "$0.00" },
    { label: "Posts today", value: "0" },
  ];

  return (
    <div>
      {/* header */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-bone-3">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            {greeting}, {user.name?.split(" ")[0] ?? "there"}.
          </h1>
          <p className="mt-1.5 text-sm text-bone-2">
            Foundation live hai — niche se launch tak ka raasta neeche hai.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-ink-3 bg-ink-2 px-3 py-2">
          <span
            className={`status-dot ${autopilot?.paused ? "bg-danger" : "bg-amber"} pulse-slow`}
          />
          <span className="label text-bone-2">
            Autopilot · {autopilot?.level ?? "manual"}
          </span>
        </div>
      </header>

      {/* stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="panel px-4 py-4">
            <p className="label text-bone-3">{s.label}</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-bone">
              {s.value}
            </p>
            <p className="mt-1 text-xs text-bone-3">awaiting data</p>
          </div>
        ))}
      </section>

      <div className="mt-7 grid gap-6 lg:grid-cols-5">
        {/* getting started */}
        <section className="panel p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              Getting started
            </h2>
            <span className="label text-bone-3">
              {doneCount}/{checklist.length} done
            </span>
          </div>

          <ol className="space-y-2.5">
            {checklist.map((c, i) => (
              <li
                key={c.href}
                className="flex items-center gap-3 rounded-lg border border-ink-3 bg-ink px-3.5 py-3"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    c.done
                      ? "bg-signal text-ink"
                      : "border border-ink-4 text-bone-3"
                  }`}
                >
                  {c.done ? "✓" : i + 1}
                </span>
                <span
                  className={`flex-1 text-sm ${c.done ? "text-bone-3 line-through" : "text-bone-2"}`}
                >
                  {c.label}
                </span>
                <Link
                  href={c.href}
                  className="label rounded border border-ink-4 px-2 py-1 text-bone-2 transition-colors hover:border-signal hover:text-signal"
                >
                  {c.cta} →
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* character card */}
        <section className="panel grid-dots p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              🎭 Your character
            </h2>
            <Link
              href="/dashboard/character"
              className="label text-bone-3 hover:text-signal"
            >
              open →
            </Link>
          </div>

          {character ? (
            <div className="mt-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-signal text-xl font-bold text-ink">
                {character.name.charAt(0).toUpperCase()}
              </div>
              <p className="mt-3 font-medium">@{character.name}</p>
              <p className="mt-1 text-xs text-bone-3">{character.bio}</p>
              <p className="label mt-4 text-amber">
                thought journal · phase 5
              </p>
            </div>
          ) : (
            <div className="mt-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-ink-4 text-xl text-bone-3">
                ?
              </div>
              <p className="mt-3 text-sm text-bone-2">
                Character abhi nahi bana
              </p>
              <Link href="/onboarding" className="btn-signal mt-4 inline-flex">
                Create via setup
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* system log */}
      <section className="panel mt-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">System log</h2>
          <span className="label text-bone-3">phase 0 · foundation</span>
        </div>
        <ul className="space-y-2 font-mono text-xs text-bone-3">
          <li>
            <span className="text-signal">✓</span> database · 21 tables live
            (supabase · ap-south-1)
          </li>
          <li>
            <span className="text-signal">✓</span> auth · sessions + workspace
            auto-provision
          </li>
          <li>
            <span className="text-signal">✓</span> character ·{" "}
            {character ? `@${character.name} created` : "awaits onboarding"}
          </li>
          <li>
            <span className="text-amber">◌</span> queues (bullmq) · phase 4+
          </li>
          <li>
            <span className="text-amber">◌</span> autopilot scheduler · phase 5
          </li>
        </ul>
      </section>
    </div>
  );
}
