/**
 * Phase 6 — Performance Memory Core (pure logic).
 *
 * Vector-based performance memory using pgvector:
 * - Embed content + performance metrics
 * - Semantic search for "what works in this niche"
 * - Pattern extraction from high-performing content
 * - Niche-specific insights
 */

export interface PerformanceEntry {
  contentType: "post" | "video" | "campaign" | "dm" | "comment_reply";
  contentId: string;
  contentText: string;
  platform?: string;
  format?: string;
  niche?: string;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    conversionRate: number;
    roi?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface SimilarContentResult {
  id: string;
  contentType: string;
  contentText: string;
  platform?: string;
  format?: string;
  niche?: string;
  metrics: PerformanceEntry["metrics"];
  similarity: number; // 0-1 cosine similarity
  metadata?: Record<string, unknown>;
}

export interface NicheInsight {
  niche: string;
  topPatterns: Array<{
    pattern: string;
    count: number;
    avgCtr: number;
    avgConversionRate: number;
    avgRevenue: number;
    examples: string[];
  }>;
  bestPlatforms: Array<{ platform: string; avgCtr: number; count: number }>;
  bestFormats: Array<{ format: string; avgCtr: number; count: number }>;
  bestHooks: Array<{ hook: string; avgCtr: number; count: number }>;
  bestCtAs: Array<{ cta: string; avgConversionRate: number; count: number }>;
  totalSamples: number;
}

/**
 * Extract text for embedding from performance entry
 */
export function buildEmbeddingText(entry: PerformanceEntry): string {
  const parts = [
    `Type: ${entry.contentType}`,
    entry.platform ? `Platform: ${entry.platform}` : "",
    entry.format ? `Format: ${entry.format}` : "",
    entry.niche ? `Niche: ${entry.niche}` : "",
    `Content: ${entry.contentText}`,
    `CTR: ${(entry.metrics.ctr * 100).toFixed(2)}%`,
    `ConvRate: ${(entry.metrics.conversionRate * 100).toFixed(2)}%`,
    `Revenue: $${entry.metrics.revenue.toFixed(2)}`,
  ];
  return parts.filter(Boolean).join(" | ");
}

/**
 * Calculate performance tier
 */
export function getPerformanceTier(ctr: number, conversionRate: number, revenue: number): "viral" | "high" | "medium" | "low" {
  if (ctr > 0.05 && conversionRate > 0.02 && revenue > 100) return "viral";
  if (ctr > 0.03 && conversionRate > 0.01 && revenue > 50) return "high";
  if (ctr > 0.015 && conversionRate > 0.005 && revenue > 10) return "medium";
  return "low";
}

/**
 * Extract hooks from content text (simple heuristic)
 */
export function extractHooks(text: string): string[] {
  const hooks: string[] = [];
  // First sentence
  const firstSentence = text.split(/[.!?]/)[0]?.trim();
  if (firstSentence && firstSentence.length > 10 && firstSentence.length < 200) {
    hooks.push(firstSentence);
  }
  // Lines that look like hooks
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 15 && trimmed.length < 150 && 
        (trimmed.endsWith("?") || trimmed.includes("how to") || 
         trimmed.includes("secret") || trimmed.includes("why") ||
         trimmed.match(/^\d+\./))) {
      hooks.push(trimmed);
    }
  }
  return [...new Set(hooks)].slice(0, 3);
}

/**
 * Extract CTAs from content text
 */
export function extractCtAs(text: string): string[] {
  const ctas: string[] = [];
  const ctaPatterns = [
    /link in bio/gi,
    /click the link/gi,
    /check it out/gi,
    /get yours/gi,
    /buy now/gi,
    /learn more/gi,
    /shop now/gi,
    /tap to shop/gi,
    /swipe up/gi,
    /dm me/gi,
    /comment below/gi,
  ];
  for (const pattern of ctaPatterns) {
    const matches = text.match(pattern);
    if (matches) ctas.push(...matches);
  }
  return [...new Set(ctas)].slice(0, 3);
}

/**
 * Generate niche insight summary from similar content
 */
export function generateNicheInsight(
  niche: string,
  results: SimilarContentResult[],
): NicheInsight {
  if (results.length === 0) {
    return {
      niche,
      topPatterns: [],
      bestPlatforms: [],
      bestFormats: [],
      bestHooks: [],
      bestCtAs: [],
      totalSamples: 0,
    };
  }

  // Aggregate by platform
  const platformStats = new Map<string, { ctrSum: number; count: number }>();
  for (const r of results) {
    if (!r.platform) continue;
    const existing = platformStats.get(r.platform) || { ctrSum: 0, count: 0 };
    existing.ctrSum += r.metrics.ctr;
    existing.count += 1;
    platformStats.set(r.platform, existing);
  }
  const bestPlatforms = Array.from(platformStats.entries())
    .map(([platform, stats]) => ({ platform, avgCtr: stats.ctrSum / stats.count, count: stats.count }))
    .sort((a, b) => b.avgCtr - a.avgCtr)
    .slice(0, 3);

  // Aggregate by format
  const formatStats = new Map<string, { ctrSum: number; count: number }>();
  for (const r of results) {
    if (!r.format) continue;
    const existing = formatStats.get(r.format) || { ctrSum: 0, count: 0 };
    existing.ctrSum += r.metrics.ctr;
    existing.count += 1;
    formatStats.set(r.format, existing);
  }
  const bestFormats = Array.from(formatStats.entries())
    .map(([format, stats]) => ({ format, avgCtr: stats.ctrSum / stats.count, count: stats.count }))
    .sort((a, b) => b.avgCtr - a.avgCtr)
    .slice(0, 3);

  // Extract hooks from top performers
  const topPerformers = results
    .filter(r => r.metrics.ctr > 0.02)
    .slice(0, 10);
  const hookCounts = new Map<string, { ctrSum: number; count: number; examples: string[] }>();
  for (const r of topPerformers) {
    const hooks = extractHooks(r.contentText);
    for (const hook of hooks) {
      const existing = hookCounts.get(hook) || { ctrSum: 0, count: 0, examples: [] };
      existing.ctrSum += r.metrics.ctr;
      existing.count += 1;
      existing.examples.push(r.contentText.slice(0, 100));
      hookCounts.set(hook, existing);
    }
  }
  const bestHooks = Array.from(hookCounts.entries())
    .map(([hook, stats]) => ({ hook, avgCtr: stats.ctrSum / stats.count, count: stats.count }))
    .sort((a, b) => b.avgCtr - a.avgCtr)
    .slice(0, 5);

  // Extract CTAs from converters
  const converters = results
    .filter(r => r.metrics.conversions > 0)
    .slice(0, 10);
  const ctaCounts = new Map<string, { convSum: number; count: number }>();
  for (const r of converters) {
    const ctas = extractCtAs(r.contentText);
    for (const cta of ctas) {
      const existing = ctaCounts.get(cta) || { convSum: 0, count: 0 };
      existing.convSum += r.metrics.conversionRate;
      existing.count += 1;
      ctaCounts.set(cta, existing);
    }
  }
  const bestCtAs = Array.from(ctaCounts.entries())
    .map(([cta, stats]) => ({ cta, avgConversionRate: stats.convSum / stats.count, count: stats.count }))
    .sort((a, b) => b.avgConversionRate - a.avgConversionRate)
    .slice(0, 5);

  // Pattern detection (simplified)
  const tierCounts = new Map<string, number>();
  for (const r of results) {
    const tier = getPerformanceTier(r.metrics.ctr, r.metrics.conversionRate, r.metrics.revenue);
    tierCounts.set(tier, (tierCounts.get(tier) || 0) + 1);
  }
  const topPatterns = Array.from(tierCounts.entries())
    .map(([pattern, count]) => ({ pattern, count, avgCtr: 0, avgConversionRate: 0, avgRevenue: 0, examples: [] }))
    .sort((a, b) => b.count - a.count);

  return {
    niche,
    topPatterns,
    bestPlatforms,
    bestFormats,
    bestHooks,
    bestCtAs,
    totalSamples: results.length,
  };
}