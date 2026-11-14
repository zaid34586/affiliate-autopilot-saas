/**
 * Phase 6 — Command Center Core (pure logic).
 *
 * Proactive AI recommendations engine:
 * - Analyzes workspace state + performance memory
 * - Generates actionable "what should I do next" recommendations
 * - Prioritizes by impact score
 * - Feeds into Copilot for conversational follow-up
 */

export type RecommendationType = 
  | "create_content"           // Create posts/videos for trending products
  | "optimize_existing"        // Boost/pause/remix under/over performing content
  | "run_research"             // Find new products in niche
  | "launch_campaign"          // Multi-day campaign for upcoming period
  | "fix_issues"               // Fix broken links, failed posts, compliance
  | "scale_winners"            // Scale high-performing content/products
  | "test_variants"            // A/B test hooks, CTAs, formats
  | "engage_audience"          // Reply to comments, DMs, run contests
  | "adjust_autopilot"         // Change level, caps, quiet hours
  | "review_analytics";        // Deep dive into metrics

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export interface CommandCenterContext {
  workspaceId: string;
  characterName: string;
  characterId: string;
  niche?: string;
  tone?: string;
  autopilotLevel: string;
  autopilotPaused: boolean;
  last7Days: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  };
  postsLast7: number;
  topProducts: Array<{
    id: string;
    title: string;
    aiScore: number | null;
    commissionValue: string | null;
    commissionType: string | null;
  }>;
  recentPosts: Array<{
    id: string;
    platform: string;
    title: string;
    status: string;
  }>;
  pendingOptimizerDecisions: number;
  activeABTests: number;
  lastJournal?: string;
  performanceMemory?: {
    bestHooks: string[];
    bestCtAs: string[];
    bestPlatforms: string[];
    bestFormats: string[];
    avgMetrics: { ctr: number; conversionRate: number; revenue: number };
  };
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  priority: RecommendationPriority;
  impactScore: number; // 0-100
  reasoning: string[];
  suggestedActions: Array<{
    type: string;
    payload: Record<string, unknown>;
    label: string;
  }>;
  estimatedEffort: "low" | "medium" | "high";
  estimatedImpact: "low" | "medium" | "high";
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface CommandCenterResult {
  recommendations: Recommendation[];
  summary: {
    totalOpportunities: number;
    criticalCount: number;
    highCount: number;
    estimatedRevenueImpact: number;
    topPriority: Recommendation | null;
  };
  generatedAt: Date;
}

/**
 * Generate all recommendations for a workspace
 */
export function generateRecommendations(context: CommandCenterContext): CommandCenterResult {
  const recommendations: Recommendation[] = [];
  let recId = 0;

  const nextId = () => `rec_${Date.now()}_${recId++}`;

  // 1. CREATE CONTENT - If low post volume or trending products without content
  if (context.postsLast7 < 3 && context.topProducts.length > 0) {
    const topProduct = context.topProducts[0];
    recommendations.push({
      id: nextId(),
      type: "create_content",
      title: `Create content for "${topProduct.title}"`,
      description: `Top-scoring product (${topProduct.aiScore || "N/A"}/100) has no recent posts. Create a post to capture demand.`,
      priority: "high",
      impactScore: 85,
      reasoning: [
        `Only ${context.postsLast7} posts in last 7 days`,
        `Top product "${topProduct.title}" has AI score ${topProduct.aiScore}`,
        "No content created for this product recently",
      ],
      suggestedActions: [
        {
          type: "create_post",
          payload: { productId: topProduct.id, platform: "instagram", format: "reel", autoPublish: false },
          label: "Create Instagram Reel",
        },
        {
          type: "create_post",
          payload: { productId: topProduct.id, platform: "tiktok", format: "short", autoPublish: false },
          label: "Create TikTok",
        },
        {
          type: "create_campaign",
          payload: { goal: `Promote ${topProduct.title}`, durationDays: 7, products: [topProduct.id], platforms: ["instagram", "tiktok"], postsPerDay: 1 },
          label: "Create 7-day Campaign",
        },
      ],
      estimatedEffort: "low",
      estimatedImpact: "high",
      metadata: { productId: topProduct.id },
    });
  }

  // 2. OPTIMIZE EXISTING - If optimizer has pending decisions
  if (context.pendingOptimizerDecisions > 0) {
    recommendations.push({
      id: nextId(),
      type: "optimize_existing",
      title: `${context.pendingOptimizerDecisions} optimizer decisions need review`,
      description: "Auto-optimizer found opportunities to boost, pause, or remix content. Review and execute.",
      priority: "critical",
      impactScore: 90,
      reasoning: [
        `${context.pendingOptimizerDecisions} pending optimizer decisions`,
        "Auto-optimizer runs daily and identifies high/low performers",
        "Delayed action = missed revenue or wasted spend",
      ],
      suggestedActions: [
        {
          type: "optimizer_action",
          payload: { action: "list_pending" },
          label: "View Pending Decisions",
        },
      ],
      estimatedEffort: "low",
      estimatedImpact: "high",
      metadata: { count: context.pendingOptimizerDecisions },
    });
  }

  // 3. RUN RESEARCH - If few products or stale product library
  if (context.topProducts.length < 5) {
    recommendations.push({
      id: nextId(),
      type: "run_research",
      title: "Run product research to expand library",
      description: `Only ${context.topProducts.length} products in library. Research new affiliate products in your niche.`,
      priority: "medium",
      impactScore: 70,
      reasoning: [
        `Product library has only ${context.topProducts.length} products`,
        "More products = more content opportunities = more revenue",
        "Research finds trending products with high commission",
      ],
      suggestedActions: [
        {
          type: "run_research",
          payload: { niche: context.niche, count: 10 },
          label: "Research 10 New Products",
        },
      ],
      estimatedEffort: "low",
      estimatedImpact: "medium",
      metadata: { currentCount: context.topProducts.length },
    });
  }

  // 4. LAUNCH CAMPAIGN - If no active campaigns and weekend approaching
  const dayOfWeek = new Date().getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Fri/Sat
  if (isWeekend && context.postsLast7 > 0) {
    recommendations.push({
      id: nextId(),
      type: "launch_campaign",
      title: "Launch weekend campaign for higher engagement",
      description: "Weekend typically has 20-30% higher engagement. Schedule a campaign for Sat-Sun.",
      priority: "medium",
      impactScore: 75,
      reasoning: [
        "Weekend engagement is typically 20-30% higher",
        "Users have more time to browse and click",
        "Schedule posts for peak hours (10AM, 2PM, 7PM)",
      ],
      suggestedActions: [
        {
          type: "create_campaign",
          payload: { goal: "Weekend engagement boost", durationDays: 2, products: context.topProducts.slice(0, 3).map(p => p.id), platforms: ["instagram", "tiktok"], postsPerDay: 2 },
          label: "Create 2-Day Weekend Campaign",
        },
      ],
      estimatedEffort: "medium",
      estimatedImpact: "medium",
      metadata: { days: 2 },
    });
  }

  // 5. FIX ISSUES - Check for failed posts, broken links
  const failedPosts = context.recentPosts.filter(p => p.status === "failed").length;
  if (failedPosts > 0) {
    recommendations.push({
      id: nextId(),
      type: "fix_issues",
      title: `${failedPosts} failed posts need attention`,
      description: "Failed posts mean lost impressions and revenue. Retry or investigate errors.",
      priority: "high",
      impactScore: 80,
      reasoning: [
        `${failedPosts} posts in failed status`,
        "Each failed post = 0 impressions, 0 revenue",
        "Common causes: API rate limits, media upload errors, compliance",
      ],
      suggestedActions: [
        {
          type: "optimizer_action",
          payload: { action: "list_pending" },
          label: "Check Failed Posts",
        },
      ],
      estimatedEffort: "low",
      estimatedImpact: "high",
      metadata: { failedCount: failedPosts },
    });
  }

  // 6. SCALE WINNERS - Use performance memory insights
  if (context.performanceMemory && context.performanceMemory.bestHooks.length > 0) {
    const avgCtr = context.performanceMemory.avgMetrics.ctr;
    const currentCtr = context.last7Days.impressions > 0 
      ? context.last7Days.clicks / context.last7Days.impressions 
      : 0;
    
    if (currentCtr < avgCtr * 0.8 && context.postsLast7 > 0) {
      recommendations.push({
        id: nextId(),
        type: "scale_winners",
        title: "CTR below niche average - apply winning patterns",
        description: `Your CTR (${(currentCtr * 100).toFixed(2)}%) is below niche average (${(avgCtr * 100).toFixed(2)}%). Use proven hooks/CTAs from top performers.`,
        priority: "high",
        impactScore: 82,
        reasoning: [
          `Current CTR: ${(currentCtr * 100).toFixed(2)}% vs Niche avg: ${(avgCtr * 100).toFixed(2)}%`,
          `Top hooks: ${context.performanceMemory.bestHooks.slice(0, 2).join(", ")}`,
          `Top CTAs: ${context.performanceMemory.bestCtAs.slice(0, 2).join(", ")}`,
        ],
        suggestedActions: [
          {
            type: "create_post",
            payload: { 
              productId: context.topProducts[0]?.id, 
              platform: context.performanceMemory.bestPlatforms[0] || "instagram", 
              format: context.performanceMemory.bestFormats[0] || "reel",
              hook: context.performanceMemory.bestHooks[0],
              cta: context.performanceMemory.bestCtAs[0],
              autoPublish: false 
            },
            label: "Create Post with Winning Pattern",
          },
        ],
        estimatedEffort: "low",
        estimatedImpact: "high",
        metadata: { currentCtr, nicheAvgCtr: avgCtr },
      });
    }
  }

  // 7. TEST VARIANTS - If active A/B tests exist or high traffic posts without tests
  if (context.activeABTests === 0 && context.postsLast7 > 5) {
    recommendations.push({
      id: nextId(),
      type: "test_variants",
      title: "Start A/B tests on high-traffic posts",
      description: "No active A/B tests. Test hooks, CTAs, or formats on your best posts to optimize conversion.",
      priority: "medium",
      impactScore: 65,
      reasoning: [
        "0 active A/B tests but 5+ posts published recently",
        "A/B testing can improve CTR by 15-30%",
        "Test one element at a time: hook, CTA, format, or timing",
      ],
      suggestedActions: [
        {
          type: "optimizer_action",
          payload: { action: "list_pending" },
          label: "View Optimizer Suggestions",
        },
      ],
      estimatedEffort: "medium",
      estimatedImpact: "medium",
    });
  }

  // 8. ENGAGE AUDIENCE - If DM inbox has unread or comments pending
  // (This would need actual DM/comment data - placeholder for now)
  if (context.last7Days.conversions > 0 && context.postsLast7 > 0) {
    recommendations.push({
      id: nextId(),
      type: "engage_audience",
      title: "Engage with audience on converting posts",
      description: `${context.last7Days.conversions} conversions from ${context.postsLast7} posts. Reply to comments/DMs to build trust and increase LTV.`,
      priority: "medium",
      impactScore: 60,
      reasoning: [
        `${context.last7Days.conversions} conversions = engaged audience`,
        "Comment replies increase algorithm visibility",
        "DM follow-ups can recover abandoned carts",
      ],
      suggestedActions: [
        {
          type: "optimizer_action",
          payload: { action: "list_pending" },
          label: "Check DM Inbox",
        },
      ],
      estimatedEffort: "low",
      estimatedImpact: "medium",
    });
  }

  // 9. ADJUST AUTOPILOT - If autopilot paused or in manual mode with high volume
  if (context.autopilotPaused || context.autopilotLevel === "manual") {
    recommendations.push({
      id: nextId(),
      type: "adjust_autopilot",
      title: `Autopilot is ${context.autopilotPaused ? "paused" : "in manual mode"}`,
      description: `Autopilot ${context.autopilotPaused ? "paused" : "set to manual"} - missing automated content creation and publishing.`,
      priority: context.autopilotPaused ? "critical" : "medium",
      impactScore: context.autopilotPaused ? 88 : 60,
      reasoning: [
        context.autopilotPaused 
          ? "Autopilot paused = zero automated posts, research, publishing"
          : "Manual mode requires you to approve every action",
        "Semi/Full mode saves 10+ hours/week",
        "Can always pause specific actions if needed",
      ],
      suggestedActions: [
        {
          type: "autopilot_control",
          payload: { action: context.autopilotPaused ? "resume" : "set_level", level: "semi" },
          label: context.autopilotPaused ? "Resume Autopilot" : "Switch to Semi-Auto",
        },
      ],
      estimatedEffort: "low",
      estimatedImpact: "high",
      metadata: { currentLevel: context.autopilotLevel, paused: context.autopilotPaused },
    });
  }

  // 10. REVIEW ANALYTICS - Weekly deep dive
  const daysSinceMonday = (new Date().getDay() + 6) % 7; // 0=Mon, 6=Sun
  if (daysSinceMonday === 0) { // Monday
    recommendations.push({
      id: nextId(),
      type: "review_analytics",
      title: "Weekly analytics review - Monday deep dive",
      description: "Monday is the best day to review last week's performance and plan this week's content.",
      priority: "medium",
      impactScore: 70,
      reasoning: [
        "Weekly review identifies trends before they become problems",
        "Plan content based on what worked last week",
        "Adjust autopilot caps based on revenue trends",
      ],
      suggestedActions: [
        {
          type: "analyze_performance",
          payload: { days: 7 },
          label: "View Last 7 Days Analytics",
        },
        {
          type: "analyze_performance",
          payload: { days: 30 },
          label: "View Last 30 Days Analytics",
        },
      ],
      estimatedEffort: "medium",
      estimatedImpact: "medium",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires tomorrow
    });
  }

  // Sort by priority and impact score
  const priorityOrder: Record<RecommendationPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  recommendations.sort((a, b) => {
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.impactScore - a.impactScore;
  });

  // Filter out expired
  const now = new Date();
  const validRecommendations = recommendations.filter(r => !r.expiresAt || r.expiresAt > now);

  // Calculate summary
  const criticalCount = validRecommendations.filter(r => r.priority === "critical").length;
  const highCount = validRecommendations.filter(r => r.priority === "high").length;
  const estimatedRevenueImpact = validRecommendations.reduce((sum, r) => {
    const baseImpact = r.estimatedImpact === "high" ? 500 : r.estimatedImpact === "medium" ? 200 : 50;
    return sum + baseImpact * (r.impactScore / 100);
  }, 0);

  return {
    recommendations: validRecommendations.slice(0, 10), // Top 10
    summary: {
      totalOpportunities: validRecommendations.length,
      criticalCount,
      highCount,
      estimatedRevenueImpact: Math.round(estimatedRevenueImpact),
      topPriority: validRecommendations[0] || null,
    },
    generatedAt: new Date(),
  };
}