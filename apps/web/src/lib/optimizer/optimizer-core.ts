/**
 * Phase 6 — Auto-Optimizer Core (pure logic).
 *
 * Analyzes post performance and makes optimization decisions:
 * - BOOST: posts performing above threshold → increase distribution
 * - PAUSE: posts performing below threshold → stop distribution
 * - REMIX: high-performing content → suggest remix for new products
 * - A/B TEST: create tests for underperforming elements
 *
 * All decisions are data-driven with confidence scores.
 */

export type OptimizerMode = "conservative" | "balanced" | "aggressive";

export interface OptimizerConfig {
  enabled: boolean;
  mode: OptimizerMode;
  minCtrThreshold: number;
  minConversionRate: number;
  boostThreshold: number; // multiplier above average
  pauseThreshold: number; // multiplier below average
  lookbackDays: number;
  minPostsForDecision: number;
}

export interface PostMetrics {
  postId: string;
  videoId?: string;
  platform: string;
  format?: string;
  hook?: string;
  cta?: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  engagementRate?: number;
  ctr?: number;
  conversionRate?: number;
  roi?: number;
  postingTime: Date;
}

export interface OptimizerDecision {
  decisionType: "boost" | "pause" | "remix" | "ab_test";
  targetId: string;
  targetType: "post" | "video";
  reason: string;
  confidence: number; // 0-100
  metadata: Record<string, unknown>;
}

const DEFAULT_CONFIG: OptimizerConfig = {
  enabled: true,
  mode: "conservative",
  minCtrThreshold: 0.005, // 0.5%
  minConversionRate: 0.001, // 0.1%
  boostThreshold: 0.02, // 2% above average
  pauseThreshold: 0.001, // 0.1% below average
  lookbackDays: 7,
  minPostsForDecision: 5,
};

function getModeMultipliers(mode: OptimizerMode) {
  switch (mode) {
    case "conservative":
      return { boost: 1.5, pause: 0.5 };
    case "balanced":
      return { boost: 1.3, pause: 0.7 };
    case "aggressive":
      return { boost: 1.2, pause: 0.8 };
  }
}

/**
 * Calculate average metrics across all posts in the lookback period.
 */
function calculateAverages(posts: PostMetrics[]): { avgCtr: number; avgConversionRate: number; avgRoi: number } {
  if (posts.length === 0) return { avgCtr: 0, avgConversionRate: 0, avgRoi: 0 };

  const sums = posts.reduce(
    (acc, p) => {
      acc.ctr += p.ctr ?? 0;
      acc.conversionRate += p.conversionRate ?? 0;
      acc.roi += p.roi ?? 0;
      return acc;
    },
    { ctr: 0, conversionRate: 0, roi: 0 },
  );

  return {
    avgCtr: sums.ctr / posts.length,
    avgConversionRate: sums.conversionRate / posts.length,
    avgRoi: sums.roi / posts.length,
  };
}

/**
 * Main optimizer logic: analyze posts and generate decisions.
 */
export function runOptimizer(
  posts: PostMetrics[],
  config: Partial<OptimizerConfig> = {},
): OptimizerDecision[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (!cfg.enabled) return [];

  const decisions: OptimizerDecision[] = [];
  const now = new Date();
  const lookbackStart = new Date(now.getTime() - cfg.lookbackDays * 24 * 60 * 60 * 1000);

  // Filter posts in lookback window with minimum data
  const recentPosts = posts.filter(
    (p) => p.postingTime >= lookbackStart && p.impressions >= 100,
  );

  if (recentPosts.length < cfg.minPostsForDecision) return [];

  const { avgCtr, avgConversionRate, avgRoi } = calculateAverages(recentPosts);
  const multipliers = getModeMultipliers(cfg.mode);

  const boostCtrThreshold = avgCtr * (1 + cfg.boostThreshold * multipliers.boost);
  const pauseCtrThreshold = avgCtr * (1 - cfg.pauseThreshold * multipliers.pause);
  const boostConvThreshold = avgConversionRate * (1 + cfg.boostThreshold * multipliers.boost);
  const pauseConvThreshold = avgConversionRate * (1 - cfg.pauseThreshold * multipliers.pause);

  for (const post of recentPosts) {
    const postCtr = post.ctr ?? 0;
    const postConvRate = post.conversionRate ?? 0;
    const postRoi = post.roi ?? 0;

    // BOOST: High CTR AND high conversion rate
    if (postCtr >= boostCtrThreshold && postConvRate >= boostConvThreshold) {
      const confidence = Math.min(
        95,
        50 +
          (postCtr / avgCtr - 1) * 100 +
          (postConvRate / avgConversionRate - 1) * 50,
      );
      decisions.push({
        decisionType: "boost",
        targetId: post.postId,
        targetType: "post",
        reason: `CTR ${(postCtr * 100).toFixed(2)}% (avg ${(avgCtr * 100).toFixed(2)}%), Conversion ${(postConvRate * 100).toFixed(2)}% (avg ${(avgConversionRate * 100).toFixed(2)}%) — significantly above average`,
        confidence: Math.round(confidence),
        metadata: {
          avgCtr,
          avgConversionRate,
          postCtr,
          postConversionRate: postConvRate,
          threshold: "boost",
        },
      });
    }

    // PAUSE: Very low CTR OR very low conversion rate
    else if (postCtr <= pauseCtrThreshold || postConvRate <= pauseConvThreshold) {
      const reasonParts = [];
      if (postCtr <= pauseCtrThreshold) {
        reasonParts.push(`CTR ${(postCtr * 100).toFixed(2)}% below pause threshold ${(pauseCtrThreshold * 100).toFixed(2)}%`);
      }
      if (postConvRate <= pauseConvThreshold) {
        reasonParts.push(`Conversion ${(postConvRate * 100).toFixed(2)}% below pause threshold ${(pauseConvThreshold * 100).toFixed(2)}%`);
      }
      const confidence = Math.min(90, 40 + Math.abs((postCtr - avgCtr) / avgCtr) * 100);
      decisions.push({
        decisionType: "pause",
        targetId: post.postId,
        targetType: "post",
        reason: reasonParts.join("; "),
        confidence: Math.round(confidence),
        metadata: {
          avgCtr,
          avgConversionRate,
          postCtr,
          postConversionRate: postConvRate,
          threshold: "pause",
        },
      });
    }

    // REMIX: High ROI but low volume — remix for new product
    else if (postRoi > avgRoi * 1.5 && post.impressions < avgCtr * 10000) {
      const confidence = Math.min(85, 40 + (postRoi / avgRoi) * 20);
      decisions.push({
        decisionType: "remix",
        targetId: post.postId,
        targetType: "post",
        reason: `ROI ${postRoi.toFixed(2)}x (avg ${avgRoi.toFixed(2)}x) with low impressions ${post.impressions} — good candidate for remix with new product`,
        confidence: Math.round(confidence),
        metadata: {
          avgRoi,
          postRoi,
          impressions: post.impressions,
          threshold: "remix",
        },
      });
    }

    // A/B TEST: Decent CTR but low conversion — test new CTA/hook
    else if (postCtr >= avgCtr * 0.8 && postConvRate < avgConversionRate * 0.5 && post.clicks > 10) {
      const confidence = Math.min(75, 30 + (avgConversionRate / Math.max(postConvRate, 0.001)) * 10);
      decisions.push({
        decisionType: "ab_test",
        targetId: post.postId,
        targetType: "post",
        reason: `CTR ${(postCtr * 100).toFixed(2)}% decent but conversion ${(postConvRate * 100).toFixed(2)}% low (${post.clicks} clicks, ${post.conversions} conversions) — test new CTA/hook`,
        confidence: Math.round(confidence),
        metadata: {
          avgCtr,
          avgConversionRate,
          postCtr,
          postConversionRate: postConvRate,
          clicks: post.clicks,
          conversions: post.conversions,
          threshold: "ab_test",
        },
      });
    }
  }

  return decisions;
}

/**
 * Generate A/B test configuration for a given post and test type.
 */
export function generateAbTestConfig(
  post: PostMetrics,
  testType: "hook" | "cta" | "format" | "timing",
): {
  name: string;
  testType: string;
  variants: { id: string; name: string; config: Record<string, unknown> }[];
  trafficSplit: Record<string, number>;
  metric: string;
} {
  const baseConfig = {
    platform: post.platform,
    format: post.format,
    hook: post.hook,
    cta: post.cta,
  };

  switch (testType) {
    case "hook":
      return {
        name: `Hook test for post ${post.postId.slice(0, 8)}`,
        testType: "hook",
        variants: [
          { id: "control", name: "Current Hook", config: { hook: post.hook } },
          { id: "variant_a", name: "Question Hook", config: { hook: "What if you could..." } },
          { id: "variant_b", name: "Benefit Hook", config: { hook: "Get the results you want..." } },
        ],
        trafficSplit: { control: 40, variant_a: 30, variant_b: 30 },
        metric: "ctr",
      };
    case "cta":
      return {
        name: `CTA test for post ${post.postId.slice(0, 8)}`,
        testType: "cta",
        variants: [
          { id: "control", name: "Current CTA", config: { cta: post.cta } },
          { id: "variant_a", name: "Direct CTA", config: { cta: "Get it now →" } },
          { id: "variant_b", name: "Soft CTA", config: { cta: "Learn more →" } },
        ],
        trafficSplit: { control: 40, variant_a: 30, variant_b: 30 },
        metric: "conversions",
      };
    case "format":
      return {
        name: `Format test for post ${post.postId.slice(0, 8)}`,
        testType: "format",
        variants: [
          { id: "control", name: "Current Format", config: { format: post.format } },
          { id: "variant_a", name: "Showcase", config: { format: "showcase" } },
          { id: "variant_b", name: "Tutorial", config: { format: "tutorial" } },
        ],
        trafficSplit: { control: 40, variant_a: 30, variant_b: 30 },
        metric: "engagement",
      };
    case "timing":
      return {
        name: `Timing test for post ${post.postId.slice(0, 8)}`,
        testType: "timing",
        variants: [
          { id: "control", name: "Current Time", config: { postingTime: post.postingTime } },
          { id: "variant_a", name: "Morning", config: { postingTime: "09:00" } },
          { id: "variant_b", name: "Evening", config: { postingTime: "19:00" } },
        ],
        trafficSplit: { control: 40, variant_a: 30, variant_b: 30 },
        metric: "ctr",
      };
    default:
      throw new Error(`Unknown test type: ${testType}`);
  }
}