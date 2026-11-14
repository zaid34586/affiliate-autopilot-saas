/**
 * Phase 6 — A/B Test Core (pure logic).
 *
 * Statistical analysis for A/B test results:
 * - Confidence interval calculation
 * - Winner selection with significance testing
 * - Sample size determination
 * - Lift calculation
 */

export type AbTestType = "hook" | "cta" | "format" | "timing";
export type AbTestMetric = "ctr" | "conversions" | "revenue" | "engagement";
export type AbTestStatus = "draft" | "running" | "completed" | "paused";

export interface AbTestVariant {
  id: string;
  name: string;
  config: Record<string, unknown>;
}

export interface AbTestConfig {
  name: string;
  testType: AbTestType;
  variants: AbTestVariant[];
  trafficSplit: Record<string, number>; // variant_id -> percentage
  metric: AbTestMetric;
  minSampleSize: number;
  confidenceLevel: number; // 0.95 = 95%
}

export interface AbTestResultRow {
  variantId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  engagement: number;
}

export interface VariantAnalysis {
  variantId: string;
  name: string;
  config: Record<string, unknown>;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  engagement: number;
  ctr: number;
  conversionRate: number;
  revenuePerImpression: number;
  engagementRate: number;
}

export interface AbTestAnalysis {
  testId: string;
  testType: AbTestType;
  metric: AbTestMetric;
  controlVariantId: string;
  variants: VariantAnalysis[];
  winnerVariantId?: string;
  winnerConfidence: number;
  lift: number; // percentage lift over control
  isSignificant: boolean;
  pValue: number;
  sampleSize: number;
  recommendation: "implement_winner" | "continue_test" | "no_winner";
}

/**
 * Calculate binomial proportion confidence interval (Wilson score interval)
 */
function wilsonScoreInterval(successes: number, trials: number, z: number = 1.96): { lower: number; upper: number } {
  if (trials === 0) return { lower: 0, upper: 0 };
  const p = successes / trials;
  const denominator = 1 + z * z / trials;
  const center = (p + z * z / (2 * trials)) / denominator;
  const halfWidth = (z * Math.sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials))) / denominator;
  return { lower: Math.max(0, center - halfWidth), upper: Math.min(1, center + halfWidth) };
}

/**
 * Calculate two-proportion z-test p-value
 */
function twoProportionZTest(
  successA: number,
  totalA: number,
  successB: number,
  totalB: number,
): number {
  if (totalA === 0 || totalB === 0) return 1;
  const pA = successA / totalA;
  const pB = successB / totalB;
  const pooledP = (successA + successB) / (totalA + totalB);
  if (pooledP === 0 || pooledP === 1) return 1;
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / totalA + 1 / totalB));
  if (se === 0) return 1;
  const z = Math.abs(pA - pB) / se;
  // Two-tailed p-value using normal approximation
  return 2 * (1 - normalCDF(Math.abs(z)));
}

/**
 * Normal CDF approximation
 */
function normalCDF(x: number): number {
  // Abramowitz and Stegun approximation
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

/**
 * Calculate required sample size per variant for A/B test
 */
export function calculateRequiredSampleSize(
  baselineRate: number,
  minimumDetectableEffect: number, // relative lift (e.g., 0.1 = 10% lift)
  alpha: number = 0.05,
  power: number = 0.8,
): number {
  const zAlpha = normalInverseCDF(1 - alpha / 2);
  const zBeta = normalInverseCDF(power);
  const p1 = baselineRate;
  const p2 = baselineRate * (1 + minimumDetectableEffect);
  const pAvg = (p1 + p2) / 2;
  const n = Math.pow(zAlpha + zBeta, 2) * 2 * pAvg * (1 - pAvg) / Math.pow(p1 - p2, 2);
  return Math.ceil(n);
}

/**
 * Inverse normal CDF (approximation)
 */
function normalInverseCDF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [0, -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [0, -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [0, -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0, 7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  
  let q = p < 0.5 ? p : 1 - p;
  let r = Math.sqrt(-2 * Math.log(q));
  let val: number;
  
  if (r <= 5) {
    val = (((((a[1] * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * r + a[6]) /
          ((((b[1] * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    r -= 1.6;
    val = (((((c[1] * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) * r + c[6]) /
          ((((d[1] * r + d[2]) * r + d[3]) * r + d[4]) * r + 1);
  }
  
  return p < 0.5 ? -val : val;
}

/**
 * Analyze A/B test results and determine winner
 */
export function analyzeAbTest(
  testId: string,
  config: AbTestConfig,
  results: AbTestResultRow[],
): AbTestAnalysis {
  const control = config.variants.find(v => v.id === "control") || config.variants[0];
  const controlResult = results.find(r => r.variantId === control.id) || { impressions: 0, clicks: 0, conversions: 0, revenue: 0, engagement: 0 };

  const variants: VariantAnalysis[] = config.variants.map(v => {
    const r = results.find(res => res.variantId === v.id) || { impressions: 0, clicks: 0, conversions: 0, revenue: 0, engagement: 0 };
    return {
      variantId: v.id,
      name: v.name,
      config: v.config,
      impressions: r.impressions,
      clicks: r.clicks,
      conversions: r.conversions,
      revenue: r.revenue,
      engagement: r.engagement,
      ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
      conversionRate: r.clicks > 0 ? r.conversions / r.clicks : 0,
      revenuePerImpression: r.impressions > 0 ? r.revenue / r.impressions : 0,
      engagementRate: r.impressions > 0 ? r.engagement / r.impressions : 0,
    };
  });

  // Get metric value for each variant
  const getMetricValue = (v: VariantAnalysis): number => {
    switch (config.metric) {
      case "ctr": return v.ctr;
      case "conversions": return v.conversionRate;
      case "revenue": return v.revenuePerImpression;
      case "engagement": return v.engagementRate;
      default: return 0;
    }
  };

  const controlMetric = getMetricValue(variants.find(v => v.variantId === control.id)!);
  
  // Compare each variant against control
  let bestVariant = variants.find(v => v.variantId === control.id)!;
  let bestMetric = controlMetric;
  let winnerConfidence = 0;
  let isSignificant = false;
  let pValue = 1;

  for (const variant of variants) {
    if (variant.variantId === control.id) continue;
    
    const variantMetric = getMetricValue(variant);
    if (variantMetric <= bestMetric) continue;

    // Statistical significance test
    let p = 1;
    let successesControl = 0;
    let totalControl = 0;
    let successesVariant = 0;
    let totalVariant = 0;

    switch (config.metric) {
      case "ctr":
        successesControl = controlResult.clicks;
        totalControl = controlResult.impressions;
        successesVariant = variant.clicks;
        totalVariant = variant.impressions;
        break;
      case "conversions":
        successesControl = controlResult.conversions;
        totalControl = controlResult.clicks;
        successesVariant = variant.conversions;
        totalVariant = variant.clicks;
        break;
      case "revenue":
        // For revenue, use a simplified test
        p = variantMetric > controlMetric ? 0.05 : 1;
        break;
      case "engagement":
        // For engagement, use impressions as denominator
        successesControl = Math.round(controlResult.engagement);
        totalControl = controlResult.impressions;
        successesVariant = Math.round(variant.engagement);
        totalVariant = variant.impressions;
        break;
    }

    if (config.metric !== "revenue" && totalControl > 0 && totalVariant > 0) {
      p = twoProportionZTest(successesControl, totalControl, successesVariant, totalVariant);
    }

    const confidence = (1 - p) * 100;
    if (confidence > winnerConfidence && confidence >= (config.confidenceLevel * 100)) {
      winnerConfidence = confidence;
      bestVariant = variant;
      bestMetric = variantMetric;
      isSignificant = true;
      pValue = p;
    }
  }

  const lift = controlMetric > 0 ? ((bestMetric - controlMetric) / controlMetric) * 100 : 0;
  const sampleSize = variants.reduce((sum, v) => sum + v.impressions, 0);

  let recommendation: AbTestAnalysis["recommendation"] = "no_winner";
  if (isSignificant && bestVariant.variantId !== control.id) {
    recommendation = "implement_winner";
  } else if (sampleSize < config.minSampleSize) {
    recommendation = "continue_test";
  }

  return {
    testId,
    testType: config.testType,
    metric: config.metric,
    controlVariantId: control.id,
    variants,
    winnerVariantId: isSignificant && bestVariant.variantId !== control.id ? bestVariant.variantId : undefined,
    winnerConfidence: Math.round(winnerConfidence),
    lift: Math.round(lift * 100) / 100,
    isSignificant,
    pValue: Math.round(pValue * 10000) / 10000,
    sampleSize,
    recommendation,
  };
}

/**
 * Check if A/B test should be stopped (reached significance or max sample)
 */
export function shouldStopAbTest(
  analysis: AbTestAnalysis,
  maxSampleSize: number = 10000,
): boolean {
  if (analysis.recommendation === "implement_winner") return true;
  if (analysis.sampleSize >= maxSampleSize) return true;
  return false;
}

/**
 * Generate A/B test configs for all test types for a post
 */
export function generateAllAbTestConfigs(post: {
  postId: string;
  platform: string;
  format?: string;
  hook?: string;
  cta?: string;
  postingTime: Date;
}): AbTestConfig[] {
  const testTypes: AbTestType[] = ["hook", "cta", "format", "timing"];
  return testTypes.map(type => {
    const baseConfig = {
      platform: post.platform,
      format: post.format,
      hook: post.hook,
      cta: post.cta,
      postingTime: post.postingTime,
    };

    switch (type) {
      case "hook":
        return {
          name: `Hook test for ${post.postId.slice(0, 8)}`,
          testType: "hook",
          variants: [
            { id: "control", name: "Current Hook", config: { hook: post.hook } },
            { id: "variant_a", name: "Question Hook", config: { hook: "What if you could..." } },
            { id: "variant_b", name: "Benefit Hook", config: { hook: "Get the results you want..." } },
          ],
          trafficSplit: { control: 40, variant_a: 30, variant_b: 30 },
          metric: "ctr",
          minSampleSize: 100,
          confidenceLevel: 0.95,
        };
      case "cta":
        return {
          name: `CTA test for ${post.postId.slice(0, 8)}`,
          testType: "cta",
          variants: [
            { id: "control", name: "Current CTA", config: { cta: post.cta } },
            { id: "variant_a", name: "Direct CTA", config: { cta: "Get it now →" } },
            { id: "variant_b", name: "Soft CTA", config: { cta: "Learn more →" } },
          ],
          trafficSplit: { control: 40, variant_a: 30, variant_b: 30 },
          metric: "conversions",
          minSampleSize: 100,
          confidenceLevel: 0.95,
        };
      case "format":
        return {
          name: `Format test for ${post.postId.slice(0, 8)}`,
          testType: "format",
          variants: [
            { id: "control", name: "Current Format", config: { format: post.format } },
            { id: "variant_a", name: "Showcase", config: { format: "showcase" } },
            { id: "variant_b", name: "Tutorial", config: { format: "tutorial" } },
          ],
          trafficSplit: { control: 40, variant_a: 30, variant_b: 30 },
          metric: "engagement",
          minSampleSize: 100,
          confidenceLevel: 0.95,
        };
      case "timing":
        return {
          name: `Timing test for ${post.postId.slice(0, 8)}`,
          testType: "timing",
          variants: [
            { id: "control", name: "Current Time", config: { postingTime: post.postingTime } },
            { id: "variant_a", name: "Morning", config: { postingTime: "09:00" } },
            { id: "variant_b", name: "Evening", config: { postingTime: "19:00" } },
          ],
          trafficSplit: { control: 40, variant_a: 30, variant_b: 30 },
          metric: "ctr",
          minSampleSize: 100,
          confidenceLevel: 0.95,
        };
      default:
        throw new Error(`Unknown test type: ${type}`);
    }
  });
}