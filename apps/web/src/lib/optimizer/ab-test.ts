/**
 * Phase 6 — A/B Test DB Orchestration.
 *
 * Database operations for A/B testing:
 * - Create, read, update A/B tests
 * - Record results per variant
 * - Analyze and select winners
 * - Auto-apply winning variants
 */

import { db } from "@/lib/db";
import { abTests, abTestResults, optimizerDecisions, posts } from "@aa/db";
import { eq, and, desc, sql, sum, inArray } from "drizzle-orm";
import {
  AbTestConfig,
  AbTestVariant,
  AbTestAnalysis,
  analyzeAbTest,
  shouldStopAbTest,
  generateAllAbTestConfigs,
} from "./ab-test-core";

export interface CreateAbTestInput {
  workspaceId: string;
  name: string;
  testType: "hook" | "cta" | "format" | "timing";
  variants: AbTestVariant[];
  trafficSplit: Record<string, number>;
  metric: "ctr" | "conversions" | "revenue" | "engagement";
  minSampleSize?: number;
  confidenceLevel?: number;
}

export interface RecordResultInput {
  abTestId: string;
  variantId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  engagement: number;
}

/**
 * Create a new A/B test
 */
export async function createAbTest(input: CreateAbTestInput) {
  const [test] = await db
    .insert(abTests)
    .values({
      workspaceId: input.workspaceId,
      name: input.name,
      testType: input.testType,
      variants: input.variants,
      trafficSplit: input.trafficSplit,
      metric: input.metric,
      minSampleSize: input.minSampleSize || 100,
      confidenceLevel: (input.confidenceLevel || 0.95).toFixed(2),
      status: "draft",
    })
    .returning();

  return test;
}

/**
 * Start an A/B test (change status to running)
 */
export async function startAbTest(workspaceId: string, testId: string) {
  const [test] = await db
    .update(abTests)
    .set({
      status: "running",
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(abTests.id, testId), eq(abTests.workspaceId, workspaceId)))
    .returning();

  return test;
}

/**
 * Pause an A/B test
 */
export async function pauseAbTest(workspaceId: string, testId: string) {
  const [test] = await db
    .update(abTests)
    .set({
      status: "paused",
      updatedAt: new Date(),
    })
    .where(and(eq(abTests.id, testId), eq(abTests.workspaceId, workspaceId)))
    .returning();

  return test;
}

/**
 * Get A/B test by ID
 */
export async function getAbTest(workspaceId: string, testId: string) {
  const [test] = await db
    .select()
    .from(abTests)
    .where(and(eq(abTests.id, testId), eq(abTests.workspaceId, workspaceId)))
    .limit(1);

  return test;
}

/**
 * List A/B tests for a workspace
 */
export async function listAbTests(workspaceId: string, status?: string) {
  const where = status
    ? and(eq(abTests.workspaceId, workspaceId), eq(abTests.status, status))
    : eq(abTests.workspaceId, workspaceId);

  return db
    .select()
    .from(abTests)
    .where(where)
    .orderBy(desc(abTests.createdAt));
}

/**
 * Record results for a variant
 */
export async function recordAbTestResult(input: RecordResultInput) {
  const [result] = await db
    .insert(abTestResults)
    .values({
      abTestId: input.abTestId,
      variantId: input.variantId,
      impressions: input.impressions,
      clicks: input.clicks,
      conversions: input.conversions,
      revenue: input.revenue,
      engagement: input.engagement,
      computedAt: new Date(),
    } as any)
    .returning();

  return result;
}

/**
 * Get aggregated results for an A/B test
 */
export async function getAbTestAggregatedResults(testId: string) {
  return db
    .select({
      variantId: abTestResults.variantId,
      impressions: sum(abTestResults.impressions),
      clicks: sum(abTestResults.clicks),
      conversions: sum(abTestResults.conversions),
      revenue: sum(abTestResults.revenue),
      engagement: sum(abTestResults.engagement),
    })
    .from(abTestResults)
    .where(eq(abTestResults.abTestId, testId))
    .groupBy(abTestResults.variantId);
}

/**
 * Analyze A/B test and determine winner
 */
export async function analyzeAndUpdateAbTest(workspaceId: string, testId: string): Promise<AbTestAnalysis | null> {
  const test = await getAbTest(workspaceId, testId);
  if (!test) return null;

  const config: AbTestConfig = {
    name: test.name,
    testType: test.testType as "hook" | "cta" | "format" | "timing",
    variants: test.variants as AbTestVariant[],
    trafficSplit: test.trafficSplit as Record<string, number>,
    metric: test.metric as "ctr" | "conversions" | "revenue" | "engagement",
    minSampleSize: test.minSampleSize ?? 100,
    confidenceLevel: parseFloat(test.confidenceLevel as string) || 0.95,
  };

  const rawResults = await getAbTestAggregatedResults(testId);
  const results = rawResults.map(r => ({
    variantId: r.variantId,
    impressions: Number(r.impressions || 0),
    clicks: Number(r.clicks || 0),
    conversions: Number(r.conversions || 0),
    revenue: Number(r.revenue || 0),
    engagement: Number(r.engagement || 0),
  }));

  const analysis = analyzeAbTest(testId, config, results);

  // Update test with winner if found
  if (analysis.winnerVariantId && analysis.isSignificant) {
    await db
      .update(abTests)
      .set({
        status: "completed",
        winnerVariantId: analysis.winnerVariantId,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(abTests.id, testId));
  } else if (shouldStopAbTest(analysis)) {
    await db
      .update(abTests)
      .set({
        status: "completed",
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(abTests.id, testId));
  }

  return analysis;
}

/**
 * Auto-create A/B tests from optimizer decisions
 */
export async function createAbTestsFromOptimizerDecisions(workspaceId: string) {
  // Get pending A/B test decisions from optimizer
  const decisions = await db
    .select()
    .from(optimizerDecisions)
    .where(and(eq(optimizerDecisions.workspaceId, workspaceId), eq(optimizerDecisions.decisionType, "ab_test"), eq(optimizerDecisions.executed, false)))
    .limit(10);

  const createdTests = [];

  for (const decision of decisions) {
    try {
      // Get the post to generate test configs
      const [post] = await db
        .select({
          id: posts.id,
          platform: posts.platform,
        })
        .from(posts)
        .where(eq(posts.id, decision.targetId))
        .limit(1);

      if (!post) continue;

      // Generate test configs for this post
      const postMetrics = {
        postId: post.id,
        platform: post.platform,
        format: undefined,
        hook: decision.metadata?.hook as string | undefined,
        cta: decision.metadata?.cta as string | undefined,
        postingTime: decision.createdAt,
      };

      const configs = generateAllAbTestConfigs(postMetrics);

      // Create the most relevant test based on optimizer metadata
      const testType = (decision.metadata?.threshold as string) || "cta";
      const config = configs.find(c => c.testType === testType) || configs[1]; // default to CTA test

      const test = await createAbTest({
        workspaceId,
        name: config.name,
        testType: config.testType,
        variants: config.variants,
        trafficSplit: config.trafficSplit,
        metric: config.metric,
        minSampleSize: config.minSampleSize,
        confidenceLevel: config.confidenceLevel,
      });

      // Start the test
      await startAbTest(workspaceId, test.id);

      // Mark optimizer decision as executed
      await db
        .update(optimizerDecisions)
        .set({
          executed: true,
          executedAt: new Date(),
          result: { abTestId: test.id, testType: config.testType },
        })
        .where(eq(optimizerDecisions.id, decision.id));

      createdTests.push(test);
    } catch (error) {
      console.error(`Failed to create A/B test for decision ${decision.id}:`, error);
    }
  }

  return createdTests;
}

/**
 * Apply winning variant (update posts with winning config)
 */
export async function applyWinningVariant(workspaceId: string, testId: string) {
  const test = await getAbTest(workspaceId, testId);
  if (!test || !test.winnerVariantId) return { success: false, error: "No winner found" };

  const winner = test.variants.find((v: AbTestVariant) => v.id === test.winnerVariantId);
  if (!winner) return { success: false, error: "Winner variant not found" };

  // Apply winner config to relevant posts
  // This would depend on test type - update posts with winning hook/cta/format/timing
  // For now, just mark as completed

  await db
    .update(abTests)
    .set({
      status: "completed",
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(abTests.id, testId));

  return { success: true, winnerConfig: winner.config };
}

/**
 * Run A/B test analysis for all running tests
 */
export async function runAbTestAnalysis(workspaceId: string) {
  const runningTests = await listAbTests(workspaceId, "running");
  const analyses = [];

  for (const test of runningTests) {
    const analysis = await analyzeAndUpdateAbTest(workspaceId, test.id);
    if (analysis) analyses.push(analysis);
  }

  return analyses;
}