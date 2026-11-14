import Link from "next/link";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { brandProfiles, characters } from "@aa/db";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/session";
import { ModulePage } from "@/components/module-page";
import { CharacterChat } from "./character-chat";

export const metadata: Metadata = { title: "Character" };

export default async function CharacterPage() {
  const { workspace } = await requireWorkspace();

  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.workspaceId, workspace.id))
    .limit(1);

  const [brand] = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.workspaceId, workspace.id))
    .limit(1);

  const extra = character ? (
    <>
    <div className="mb-7 grid gap-5 md:grid-cols-3">
      {/* identity */}
      <div className="panel grid-dots p-5 text-center md:col-span-1">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-signal text-2xl font-bold text-ink">
          {character.name.charAt(0).toUpperCase()}
        </div>
        <p className="mt-4 text-lg font-semibold tracking-tight">
          @{character.name}
        </p>
        <p className="label mt-1 text-bone-3">
          {brand?.niche ?? "niche unset"} · {brand?.tone ?? "friendly"}
        </p>
        <p className="mt-4 text-xs leading-relaxed text-bone-3">
          {character.bio}
        </p>
      </div>

      {/* guardrails / mind */}
      <div className="panel p-5 md:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">
            Identity rules (guardrails)
          </h2>
          <span className="label text-bone-3">stored ✓</span>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-bone-2">
          <li className="flex gap-3">
            <span className="status-dot mt-1.5 bg-signal-dim" />
            Always uses the connected handle&apos;s name — @{character.name}
          </li>
          <li className="flex gap-3">
            <span className="status-dot mt-1.5 bg-signal-dim" />
            Never makes a claim you did not approve
          </li>
          <li className="flex gap-3">
            <span className="status-dot mt-1.5 bg-signal-dim" />
            Politely declines negative or abusive comments — never spam
          </li>
        </ul>

        <div className="mt-5 rounded-lg border border-ink-3 bg-ink px-4 py-3">
          <p className="label text-amber">💭 thought journal</p>
          <p className="mt-1.5 text-xs text-bone-3">
            It writes daily strategy thoughts — the journal table is live and
            the self-reflection writing engine ships with Phase 5 Module C.
          </p>
        </div>
      </div>
      </div>

      {/* Phase 5 Module C — discussion chat */}
      <CharacterChat />
    </>
  ) : (
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-ink-4 px-5 py-4">
      <p className="text-sm text-bone-2">
        No character yet — finish onboarding and the name is created
        automatically from your handle.
      </p>
      <Link href="/onboarding" className="btn-signal">
        Run setup →
      </Link>
    </div>
  );

  return <ModulePage href="/dashboard/character" extra={extra} />;
}
