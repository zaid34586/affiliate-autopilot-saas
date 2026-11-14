/**
 * Phase 5 Module D — DM Funnel Engine (DB orchestration).
 * Loads funnels, triggers, conversations; executes steps; respects anti-spam.
 */

import { db } from "@/lib/db";
import {
  dmTriggers,
  dmFunnels,
  dmFunnelSteps,
  dmTriggerFunnels,
  dmConversations,
  dmBlocklist,
  dmDailyCaps,
  dmMessages,
  characters,
  products,
} from "@aa/db";
import { and, eq, gte, lte, sql, inArray, desc } from "drizzle-orm";
import {
  matchTrigger,
  findMatchingFunnel,
  renderStepTemplate,
  checkStepConditions,
  getNextStepToSend,
  buildNextMessage,
  checkAntiSpam,
  isQuietHours,
  shouldSkipSentiment,
  type FunnelDefinition,
  type ConversationState,
  type FunnelStep,
  type FunnelExecutionResult,
} from "./funnel-core";

export { matchTrigger, findMatchingFunnel, checkAntiSpam } from "./funnel-core";
export type { FunnelDefinition, FunnelStep, ConversationState, FunnelExecutionResult } from "./funnel-core";

/** Load all active funnels with their steps for a workspace. */
export async function loadFunnels(workspaceId: string): Promise<FunnelDefinition[]> {
  const funnels = await db
    .select()
    .from(dmFunnels)
    .where(and(eq(dmFunnels.workspaceId, workspaceId), eq(dmFunnels.enabled, true)));

  if (funnels.length === 0) return [];

  const funnelIds = funnels.map((f) => f.id);
  const steps = await db
    .select()
    .from(dmFunnelSteps)
    .where(inArray(dmFunnelSteps.funnelId, funnelIds))
    .orderBy(dmFunnelSteps.funnelId, dmFunnelSteps.order);

  const stepsByFunnel = new Map<string, FunnelStep[]>();
  for (const step of steps) {
    const arr = stepsByFunnel.get(step.funnelId) ?? [];
    arr.push({
      id: step.id,
      stepType: step.stepType,
      order: step.order,
      template: step.template,
      delayHours: step.delayHours,
      conditions: (step.conditions ?? {}) as Record<string, unknown>,
    });
    stepsByFunnel.set(step.funnelId, arr);
  }

  return funnels.map((f) => ({
    id: f.id,
    name: f.name,
    steps: stepsByFunnel.get(f.id) ?? [],
    quietHoursStart: f.quietHoursStart ?? null,
    quietHoursEnd: f.quietHoursEnd ?? null,
    skipNegativeSentiment: f.skipNegativeSentiment ?? true,
  }));
}

/** Load triggers that have funnel mappings for a workspace. */
export async function loadTriggersWithFunnels(workspaceId: string): Promise<
  Array<{
    id: string;
    keywords: { set: string[]; semantic: boolean };
    funnelId: string | null;
    mode: string;
    cooldownHours: number;
    dailyCap: number;
  }>
> {
  const triggers = await db
    .select({
      id: dmTriggers.id,
      keywords: dmTriggers.keywords,
      mode: dmTriggers.mode,
      cooldownHours: dmTriggers.cooldownHours,
      dailyCap: dmTriggers.dailyCap,
      funnelId: dmTriggerFunnels.funnelId,
    })
    .from(dmTriggers)
    .leftJoin(dmTriggerFunnels, eq(dmTriggerFunnels.triggerId, dmTriggers.id))
    .where(and(eq(dmTriggers.workspaceId, workspaceId), eq(dmTriggers.enabled, true)));

  return triggers.map((t) => ({
    id: t.id,
    keywords: t.keywords ?? { set: [], semantic: false },
    funnelId: t.funnelId,
    mode: t.mode,
    cooldownHours: t.cooldownHours ?? 24,
    dailyCap: t.dailyCap ?? 100,
  }));
}

/** Load active conversations for a workspace that are ready for next step. */
export async function loadActiveConversations(
  workspaceId: string,
  now: Date = new Date(),
): Promise<ConversationState[]> {
  const rows = await db
    .select()
    .from(dmConversations)
    .where(
      and(
        eq(dmConversations.workspaceId, workspaceId),
        eq(dmConversations.status, "active"),
      ),
    );

  return rows
    .filter((r) => !r.nextStepAt || r.nextStepAt <= now)
    .map((r) => ({
      conversationId: r.id,
      funnelId: r.funnelId,
      recipientHandle: r.recipientHandle,
      platform: r.platform,
      currentStepIndex: r.currentStepIndex,
      status: r.status as "active" | "completed" | "paused" | "blocked",
      lastSentAt: r.lastSentAt,
      nextStepAt: r.nextStepAt,
      context: (r.context ?? {}) as Record<string, unknown>,
    }));
}

/** Load blocklist for a workspace. */
export async function loadBlocklist(workspaceId: string): Promise<
  Array<{ handle: string; platform: string | null }>
> {
  const rows = await db
    .select({ handle: dmBlocklist.handle, platform: dmBlocklist.platform })
    .from(dmBlocklist)
    .where(eq(dmBlocklist.workspaceId, workspaceId));
  return rows;
}

/** Load daily caps for a workspace for today. */
export async function loadDailyCaps(
  workspaceId: string,
): Promise<Array<{ platform: string; day: string; sentCount: number; limit: number }>> {
  const today = new Date().toISOString().split("T")[0];
  const rows = await db
    .select()
    .from(dmDailyCaps)
    .where(and(eq(dmDailyCaps.workspaceId, workspaceId), eq(dmDailyCaps.day, today)));
  return rows;
}

/** Count DMs sent by a funnel today. */
export async function countFunnelSentToday(
  workspaceId: string,
  _funnelId: string,
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dmMessages)
    .where(
      and(
        eq(dmMessages.workspaceId, workspaceId),
        eq(dmMessages.status, "sent"),
        gte(dmMessages.createdAt, today),
      ),
    )
    .limit(1);
  // Note: we don't have funnelId on dmMessages, so this is approximate.
  // Could add funnelId to dmMessages for exact tracking.
  return row?.count ?? 0;
}

/** Count total DMs sent by workspace today. */
export async function countWorkspaceSentToday(workspaceId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dmMessages)
    .where(and(eq(dmMessages.workspaceId, workspaceId), gte(dmMessages.createdAt, today)))
    .limit(1);
  return row?.count ?? 0;
}

/** Get or create a conversation for a recipient in a funnel. */
export async function getOrCreateConversation(
  workspaceId: string,
  funnelId: string,
  platform: string,
  recipientHandle: string,
  context: Record<string, unknown>,
): Promise<ConversationState | { error: string }> {
  // Check blocklist first
  const blocklist = await loadBlocklist(workspaceId);
  const handleLower = recipientHandle.toLowerCase().replace(/^@/, "");
  for (const b of blocklist) {
    if (b.handle.toLowerCase().replace(/^@/, "") === handleLower) {
      if (!b.platform || b.platform === platform) {
        return { error: "Blocklisted" };
      }
    }
  }

  // Check existing conversation
  const [existing] = await db
    .select()
    .from(dmConversations)
    .where(
      and(
        eq(dmConversations.funnelId, funnelId),
        eq(dmConversations.recipientHandle, recipientHandle),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.status === "active") {
      return { error: "Already in active conversation" };
    }
    if (existing.status === "completed") {
      return { error: "Funnel already completed" };
    }
    // Resume paused
    return {
      conversationId: existing.id,
      funnelId: existing.funnelId,
      recipientHandle: existing.recipientHandle,
      platform: existing.platform,
      currentStepIndex: existing.currentStepIndex,
      status: existing.status as "active" | "completed" | "paused" | "blocked",
      lastSentAt: existing.lastSentAt,
      nextStepAt: existing.nextStepAt,
      context: (existing.context ?? {}) as Record<string, unknown>,
    };
  }

  // Create new conversation
  const [row] = await db
    .insert(dmConversations)
    .values({
      workspaceId,
      funnelId,
      platform,
      recipientHandle,
      currentStepIndex: 0,
      status: "active",
      context: context as unknown as Record<string, unknown>,
      nextStepAt: new Date(), // immediate first step
    })
    .returning();

  return {
    conversationId: row!.id,
    funnelId,
    recipientHandle,
    platform,
    currentStepIndex: 0,
    status: "active",
    lastSentAt: null,
    nextStepAt: new Date(),
    context,
  };
}

/** Advance conversation to next step after sending. */
export async function advanceConversation(
  conversationId: string,
  nextStepIndex: number,
  nextStepAt: Date,
): Promise<void> {
  await db
    .update(dmConversations)
    .set({
      currentStepIndex: nextStepIndex,
      lastSentAt: new Date(),
      nextStepAt,
      status: nextStepIndex >= 100 ? "completed" : "active", // placeholder, real check in caller
      updatedAt: new Date(),
    })
    .where(eq(dmConversations.id, conversationId));
}

/** Complete a conversation (all steps sent). */
export async function completeConversation(conversationId: string): Promise<void> {
  await db
    .update(dmConversations)
    .set({
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(dmConversations.id, conversationId));
}

/** Increment daily cap counter. */
export async function incrementDailyCap(
  workspaceId: string,
  platform: string,
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const [existing] = await db
    .select()
    .from(dmDailyCaps)
    .where(
      and(
        eq(dmDailyCaps.workspaceId, workspaceId),
        eq(dmDailyCaps.platform, platform),
        eq(dmDailyCaps.day, today),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(dmDailyCaps)
      .set({ sentCount: existing.sentCount + 1, updatedAt: new Date() })
      .where(eq(dmDailyCaps.id, existing.id));
  } else {
    await db.insert(dmDailyCaps).values({
      workspaceId,
      platform,
      day: today,
      sentCount: 1,
      limit: 50,
    });
  }
}

/** Create a DM message record (queued for approval or auto-send). */
export async function createDmMessage(
  params: {
    workspaceId: string;
    characterId: string | null;
    platform: string;
    recipientHandle: string;
    triggerKeyword: string | null;
    postId: string | null;
    productId: string | null;
    body: string;
    uniqueLinkCode: string | null;
    approvalMode: "manual" | "semi" | "auto";
    funnelId?: string;
  },
): Promise<string> {
  const [row] = await db
    .insert(dmMessages)
    .values({
      workspaceId: params.workspaceId,
      characterId: params.characterId,
      platform: params.platform,
      channel: "dm",
      recipientHandle: params.recipientHandle,
      triggerKeyword: params.triggerKeyword,
      postId: params.postId,
      productId: params.productId,
      body: params.body,
      uniqueLinkCode: params.uniqueLinkCode,
      status: "queued",
      approvalMode: params.approvalMode,
    })
    .returning({ id: dmMessages.id });
  return row!.id;
}

/** Build context for a funnel from trigger match. */
export async function buildFunnelContext(
  workspaceId: string,
  triggerKeyword: string,
  productId: string | null,
  postId: string | null,
): Promise<{
  productTitle: string | null;
  linkUrl: string | null;
  characterName: string | null;
}> {
  let productTitle: string | null = null;
  let linkUrl: string | null = null;
  let characterName: string | null = null;

  if (productId) {
    const [p] = await db
      .select({ title: products.title })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    productTitle = p?.title ?? null;
    // linkUrl would come from the DM message's uniqueLinkCode when created
  }

  const [c] = await db
    .select({ name: characters.name })
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId))
    .limit(1);
  characterName = c?.name ?? null;

  return { productTitle, linkUrl, characterName };
}

/** Execute one funnel step for a conversation — creates DM message. */
export async function executeFunnelStep(
  workspaceId: string,
  funnel: FunnelDefinition,
  conversation: ConversationState,
  triggerKeyword: string,
  approvalMode: "manual" | "semi" | "auto",
): Promise<{ dmId: string; nextStepAt: Date } | { error: string }> {
  const step = funnel.steps[conversation.currentStepIndex];
  if (!step) {
    await completeConversation(conversation.conversationId);
    return { error: "No more steps" };
  }

  // Check conditions
  if (!checkStepConditions(step.conditions, conversation.context)) {
    // Skip this step
    const nextIndex = conversation.currentStepIndex + 1;
    if (nextIndex >= funnel.steps.length) {
      await completeConversation(conversation.conversationId);
      return { error: "Funnel completed (condition skip)" };
    }
    await advanceConversation(conversation.conversationId, nextIndex, new Date());
    // Recurse to try next step
    return executeFunnelStep(workspaceId, funnel, {
      ...conversation,
      currentStepIndex: nextIndex,
    }, triggerKeyword, approvalMode);
  }

  // Render template
  const body = renderStepTemplate(step.template, conversation.context);

  // Create DM message
  const dmId = await createDmMessage({
    workspaceId,
    characterId: null, // could be set from character
    platform: conversation.platform,
    recipientHandle: conversation.recipientHandle,
    triggerKeyword,
    postId: conversation.context.postId as string | null,
    productId: conversation.context.productId as string | null,
    body,
    uniqueLinkCode: conversation.context.linkCode as string | null,
    approvalMode,
    funnelId: funnel.id,
  });

  // Calculate next step time
  const nextStepAt = new Date(Date.now() + step.delayHours * 60 * 60 * 1000);
  const nextIndex = conversation.currentStepIndex + 1;

  if (nextIndex >= funnel.steps.length) {
    await completeConversation(conversation.conversationId);
  } else {
    await advanceConversation(conversation.conversationId, nextIndex, nextStepAt);
  }

  return { dmId, nextStepAt };
}