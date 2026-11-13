/**
 * Phase 5 Module A — AI Product Scoring Engine.
 * Calculates 0-100 score for each product based on multiple signals.
 * Runs daily after research job (04:30 UTC).
 */
import { db } from "@/lib/db";
import { products } from "@aa/db";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";

export interface ScoreBreakdown {
  trend: number;        // 0-25: trending velocity
  commission: number;   // 0-25: earnings potential
  contentFit: number;   // 0-25: how well it fits video content
  engagement: number;   // 0-25: social proof (ratings, reviews)
}

/** Weights for each component (must sum to 100). */
const WEIGHTS = {
  trend: 25,
  commission: 25,
  contentFit: 25,
  engagement: 25,
} as const;

/** Normalize a value to 0-1 range using min/max clamping. */
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/** Calculate trend score from product's trendScore field and recency. */
function calculateTrendScore(product: {
  trendScore: string | null;
  firstSeenAt: Date | null;
}): number {
  const trendScore = product.trendScore ? Number(product.trendScore) : 0;
  const recency = product.firstSeenAt
    ? Math.max(0, 1 - (Date.now() - new Date(product.firstSeenAt).getTime()) / (30 * 24 * 60 * 60 * 1000))
    : 0.5;

  // Combine trend score (0-100) with recency (0-1)
  const normalizedTrend = normalize(trendScore, 0, 100);
  return Math.round((normalizedTrend * 0.7 + recency * 0.3) * 100);
}

/** Calculate commission score from commission type/value and price. */
function calculateCommissionScore(product: {
  price: string | null;
  currency: string | null;
  commissionType: string | null;
  commissionValue: string | null;
}): number {
  const price = product.price ? Number(product.price) : 0;
  const commissionType = product.commissionType;
  const commissionValue = product.commissionValue ? Number(product.commissionValue) : 0;

  if (!commissionType || commissionValue <= 0) return 20; // baseline

  let earningsPerSale = 0;
  if (commissionType === "percentage") {
    earningsPerSale = price * (commissionValue / 100);
  } else if (commissionType === "flat") {
    earningsPerSale = commissionValue;
  }

  // Normalize: $0 = 0, $50+ = 100
  return Math.min(100, Math.round((earningsPerSale / 50) * 100));
}

/** Calculate content fit score — how well the product fits video content. */
function calculateContentFitScore(product: {
  category: string | null;
  imageUrl: string | null;
  rating: string | null;
}): number {
  let score = 50; // baseline

  // Visual products (electronics, fashion, beauty) score higher
  const visualCategories = ["electronics", "fashion", "beauty", "home", "kitchen", "fitness", "tech", "gadgets", "skincare", "makeup"];
  if (product.category && visualCategories.some(c => product.category!.toLowerCase().includes(c))) {
    score += 20;
  }

  // Has image = better for video
  if (product.imageUrl) score += 15;

  // Has rating = can mention in script
  if (product.rating && Number(product.rating) >= 4) score += 15;

  return Math.min(100, score);
}

/** Calculate engagement score from ratings/reviews. */
function calculateEngagementScore(product: {
  rating: string | null;
  reviewCount: number | null;
}): number {
  let score = 30; // baseline

  const rating = product.rating ? Number(product.rating) : 0;
  const reviews = product.reviewCount ?? 0;

  if (rating >= 4.5) score += 30;
  else if (rating >= 4) score += 20;
  else if (rating >= 3.5) score += 10;

  if (reviews >= 1000) score += 25;
  else if (reviews >= 100) score += 15;
  else if (reviews >= 10) score += 10;

  return Math.min(100, score);
}

/** Calculate full AI score for a single product. */
export function calculateAIScore(product: {
  trendScore: string | null;
  firstSeenAt: Date | null;
  price: string | null;
  currency: string | null;
  commissionType: string | null;
  commissionValue: string | null;
  category: string | null;
  imageUrl: string | null;
  rating: string | null;
  reviewCount: number | null;
}): { score: number; breakdown: ScoreBreakdown } {
  const trend = calculateTrendScore({ trendScore: product.trendScore, firstSeenAt: product.firstSeenAt });
  const commission = calculateCommissionScore({ price: product.price, currency: product.currency, commissionType: product.commissionType, commissionValue: product.commissionValue });
  const contentFit = calculateContentFitScore({ category: product.category, imageUrl: product.imageUrl, rating: product.rating });
  const engagement = calculateEngagementScore({ rating: product.rating, reviewCount: product.reviewCount });

  const breakdown: ScoreBreakdown = { trend, commission, contentFit, engagement };

  const weightedScore =
    (trend * WEIGHTS.trend +
      commission * WEIGHTS.commission +
      contentFit * WEIGHTS.contentFit +
      engagement * WEIGHTS.engagement) / 100;

  return { score: Math.round(weightedScore), breakdown };
}

/** Run AI scoring for all active products in a workspace. */
export async function runAIScoring(workspaceId: string): Promise<{ scored: number; updated: number }> {
  const productRows = await db
    .select()
    .from(products)
    .where(and(eq(products.workspaceId, workspaceId), eq(products.status, "active")))
    .orderBy(desc(products.firstSeenAt));

  let scored = 0;
  let updated = 0;

  for (const product of productRows) {
    const { score, breakdown } = calculateAIScore(product);

    // Only update if score changed significantly (>5 points)
    if (product.aiScore === null || Math.abs((product.aiScore ?? 0) - score) > 5) {
      await db
        .update(products)
        .set({
          aiScore: score,
          aiScoreBreakdown: breakdown as any,
          lastAnalyzedAt: new Date(),
        })
        .where(eq(products.id, product.id));
      updated++;
    }
    scored++;
  }

  return { scored, updated };
}

/** Get top N products by AI score for script/video generation. */
export async function getTopProducts(workspaceId: string, limit: number = 10, minScore: number = 40) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.workspaceId, workspaceId), eq(products.status, "active"), gte(products.aiScore, minScore)))
    .orderBy(desc(products.aiScore))
    .limit(limit);
}