/**
 * Phase 5 Module C — DM suggestion orchestration (DB layer).
 * Loads the DM + character + product + brand context, delegates to the
 * pure core in dm-replies-core.ts. The suggestion is returned to the
 * caller — the existing draft/approve flow stays the only way a body
 * is ever changed or sent (no silent mutation).
 */

import { db } from "@/lib/db";
import {
  brandProfiles,
  characters,
  dmMessages,
  products,
} from "@aa/db";
import { and, eq } from "drizzle-orm";
import { buildDmSuggestion, type DmSuggestionResult } from "./dm-replies-core";

export { classifyDmIntent, buildDmSuggestion } from "./dm-replies-core";
export type { DmIntent, DmSuggestionInput, DmSuggestionResult } from "./dm-replies-core";

export type SuggestError =
  | { error: string; status: 404 }
  | { error: string; status: 400 };

/** Statuses for which a suggestion makes sense (not already sent/failed). */
const SUGGESTABLE = ["draft", "queued", "approved"];

export async function suggestDmReply(
  workspaceId: string,
  id: string,
): Promise<
  | (DmSuggestionResult & { delivery: "sandbox"; recipientHandle: string })
  | SuggestError
> {
  const [dm] = await db
    .select()
    .from(dmMessages)
    .where(and(eq(dmMessages.id, id), eq(dmMessages.workspaceId, workspaceId)))
    .limit(1);

  if (!dm) return { error: "DM not found", status: 404 };
  if (!SUGGESTABLE.includes(dm.status)) {
    return {
      error: `DM is "${dm.status}" — suggestions only apply to draft/queued/approved DMs`,
      status: 400,
    };
  }

  const [character] = await db
    .select({ name: characters.name })
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId))
    .limit(1);

  if (!character) {
    return { error: "No character yet — finish onboarding first", status: 404 };
  }

  const [brand] = await db
    .select({ niche: brandProfiles.niche })
    .from(brandProfiles)
    .where(eq(brandProfiles.workspaceId, workspaceId))
    .limit(1);

  let productTitle: string | null = null;
  if (dm.productId) {
    const [p] = await db
      .select({ title: products.title })
      .from(products)
      .where(eq(products.id, dm.productId))
      .limit(1);
    productTitle = p?.title ?? null;
  }

  const result = buildDmSuggestion({
    triggerKeyword: dm.triggerKeyword,
    currentBody: dm.body,
    recipientHandle: dm.recipientHandle,
    characterName: character.name,
    niche: brand?.niche ?? null,
    productTitle,
    linkUrl: dm.uniqueLinkCode
      ? `https://go.affiliateautopilot.app/${dm.uniqueLinkCode}`
      : null,
  });

  return { ...result, delivery: "sandbox", recipientHandle: dm.recipientHandle };
}
