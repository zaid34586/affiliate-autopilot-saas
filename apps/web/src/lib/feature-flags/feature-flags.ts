/**
 * Phase 7 — Feature Flags DB Orchestration.
 * 
 * Database operations for feature flags:
 * - CRUD operations
 * - Evaluation with logging
 * - Analytics
 */

import { db } from "@/lib/db";
import { featureFlags, featureFlagEvaluations } from "@aa/db";
import { eq, and, desc, sql, gte, inArray } from "drizzle-orm";
import {
  FeatureFlag,
  FeatureFlagEvaluation,
  FeatureFlagContext,
  evaluateFeatureFlag,
  validateFeatureFlag,
  DEFAULT_FLAGS,
} from "./feature-flags-core";

/**
 * Create a new feature flag
 */
export async function createFeatureFlag(input: {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  targeting?: FeatureFlag["targeting"];
  variants?: FeatureFlag["variants"];
  createdBy?: string;
}): Promise<FeatureFlag | null> {
  const validation = validateFeatureFlag(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(", "));
  }

  const [flag] = await db
    .insert(featureFlags)
    .values({
      key: input.key,
      name: input.name,
      description: input.description,
      enabled: input.enabled ?? false,
      rolloutPercentage: input.rolloutPercentage ?? 0,
      targeting: input.targeting || { userIds: [], workspaceIds: [], roles: [] },
      variants: input.variants || [{ key: "control", weight: 100 }],
      createdBy: input.createdBy,
    })
    .returning();

  return mapFlag(flag);
}

/**
 * Get feature flag by key
 */
export async function getFeatureFlag(key: string): Promise<FeatureFlag | null> {
  const [flag] = await db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.key, key))
    .limit(1);

  return flag ? mapFlag(flag) : null;
}

/**
 * Get all feature flags
 */
export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const flags = await db
    .select()
    .from(featureFlags)
    .orderBy(desc(featureFlags.createdAt));

  return flags.map(mapFlag);
}

/**
 * Update a feature flag
 */
export async function updateFeatureFlag(
  key: string,
  updates: Partial<Pick<FeatureFlag, "name" | "description" | "enabled" | "rolloutPercentage" | "targeting" | "variants">>
): Promise<FeatureFlag | null> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
  if (updates.rolloutPercentage !== undefined) updateData.rolloutPercentage = updates.rolloutPercentage;
  if (updates.targeting !== undefined) updateData.targeting = updates.targeting;
  if (updates.variants !== undefined) updateData.variants = updates.variants;

  const [flag] = await db
    .update(featureFlags)
    .set(updateData)
    .where(eq(featureFlags.key, key))
    .returning();

  return flag ? mapFlag(flag) : null;
}

/**
 * Toggle feature flag enabled state
 */
export async function toggleFeatureFlag(key: string, enabled: boolean): Promise<FeatureFlag | null> {
  return updateFeatureFlag(key, { enabled });
}

/**
 * Update rollout percentage
 */
export async function setRolloutPercentage(key: string, percentage: number): Promise<FeatureFlag | null> {
  if (percentage < 0 || percentage > 100) {
    throw new Error("Percentage must be between 0 and 100");
  }
  return updateFeatureFlag(key, { rolloutPercentage: percentage });
}

/**
 * Delete a feature flag
 */
export async function deleteFeatureFlag(key: string): Promise<boolean> {
  const result = await db
    .delete(featureFlags)
    .where(eq(featureFlags.key, key));
  // Check if any rows were affected by doing a select first
  const existing = await getFeatureFlag(key);
  if (!existing) return false;
  await db.delete(featureFlags).where(eq(featureFlags.key, key));
  return true;
}

/**
 * Evaluate feature flag for context and log evaluation
 */
export async function evaluateFlag(
  key: string,
  context: {
    workspaceId?: string;
    userId?: string;
    userRole?: string;
    customAttributes?: Record<string, unknown>;
  },
): Promise<{
  flagKey: string;
  enabled: boolean;
  variant: string;
  payload?: Record<string, unknown>;
  matched: boolean;
}> {
  const flag = await getFeatureFlag(key);
  
  if (!flag) {
    return {
      flagKey: key,
      enabled: false,
      variant: "control",
      matched: false,
    };
  }

  const evaluation = evaluateFeatureFlag(flag, context);

  // Log evaluation
  await db.insert(featureFlagEvaluations).values({
    flagKey: key,
    workspaceId: context.workspaceId,
    userId: context.userId,
    variant: evaluation.variant,
    matched: evaluation.matched,
    context: context.customAttributes || {},
  }).catch(err => console.error("Failed to log feature flag evaluation:", err));

  return evaluation;
}

/**
 * Evaluate multiple flags at once
 */
export async function evaluateFlags(
  keys: string[],
  context: {
    workspaceId?: string;
    userId?: string;
    userRole?: string;
  },
): Promise<Record<string, { enabled: boolean; variant: string; payload?: Record<string, unknown> }>> {
  const flags = await db
    .select()
    .from(featureFlags)
    .where(inArray(featureFlags.key, keys));

  const flagMap = new Map(flags.map(f => [f.key, mapFlag(f)]));
  
  const results: Record<string, { enabled: boolean; variant: string; payload?: Record<string, unknown> }> = {};
  
  for (const key of keys) {
    const flag = flagMap.get(key);
    if (!flag) {
      results[key] = { enabled: false, variant: "control" };
      continue;
    }
    
    const evaluation = evaluateFeatureFlag(flag, context);
    results[key] = {
      enabled: evaluation.enabled,
      variant: evaluation.variant,
      payload: evaluation.payload,
    };
  }

  return results;
}

/**
 * Get evaluation analytics for a flag
 */
export async function getFlagAnalytics(key: string, days = 7): Promise<{
  totalEvaluations: number;
  enabledCount: number;
  variantDistribution: Record<string, number>;
  uniqueWorkspaces: number;
  uniqueUsers: number;
}> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(featureFlagEvaluations)
    .where(and(eq(featureFlagEvaluations.flagKey, key), gte(featureFlagEvaluations.createdAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000))))
    .limit(1);

  const enabledResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(featureFlagEvaluations)
    .where(and(
      eq(featureFlagEvaluations.flagKey, key),
      sql`${featureFlagEvaluations.variant} != 'control'`, // Not control = enabled
      gte(featureFlagEvaluations.createdAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000))
    ))
    .limit(1);

  const variantResults = await db
    .select({
      variant: featureFlagEvaluations.variant,
      count: sql<number>`count(*)::int`,
    })
    .from(featureFlagEvaluations)
    .where(and(
      eq(featureFlagEvaluations.flagKey, key),
      gte(featureFlagEvaluations.createdAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000))
    ))
    .groupBy(featureFlagEvaluations.variant);

  const workspaceResult = await db
    .select({ count: sql<number>`count(DISTINCT ${featureFlagEvaluations.workspaceId})::int` })
    .from(featureFlagEvaluations)
    .where(and(
      eq(featureFlagEvaluations.flagKey, key),
      gte(featureFlagEvaluations.createdAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000))
    ))
    .limit(1);

  const userResult = await db
    .select({ count: sql<number>`count(DISTINCT ${featureFlagEvaluations.userId})::int` })
    .from(featureFlagEvaluations)
    .where(and(
      eq(featureFlagEvaluations.flagKey, key),
      gte(featureFlagEvaluations.createdAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000))
    ))
    .limit(1);

  return {
    totalEvaluations: Number(totalResult?.count || 0),
    enabledCount: Number(enabledResult?.[0]?.count || 0),
    variantDistribution: Object.fromEntries(
      variantResults.map(v => [v.variant, Number(v.count)])
    ),
    uniqueWorkspaces: Number(workspaceResult?.[0]?.count || 0),
    uniqueUsers: Number(userResult?.[0]?.count || 0),
  };
}

/**
 * Initialize default feature flags
 */
export async function initializeDefaultFlags(createdBy?: string): Promise<void> {
  for (const flag of DEFAULT_FLAGS) {
    const existing = await getFeatureFlag(flag.key!);
    if (!existing) {
      await createFeatureFlag({
        ...flag,
        createdBy,
      } as any);
    }
  }
}

/**
 * Map database row to FeatureFlag type
 */
function mapFlag(row: any): FeatureFlag {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    rolloutPercentage: row.rolloutPercentage,
    targeting: row.targeting as FeatureFlag["targeting"],
    variants: row.variants as FeatureFlag["variants"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}