/**
 * Phase 6 Module B — AI Reports Generation.
 * Generates daily/weekly/monthly AI reports with LLM.
 * "What happened / Why / What next"
 */
import { db } from "@/lib/db";
import {
  aiReports,
  reportSchedules as reportSchedulesTable,
  performanceEmbeddings,
  abTestWinners,
  abTests,
} from "@aa/db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { getAnalyticsDashboard } from "./sync";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export type ReportType = "daily" | "weekly" | "monthly";

export interface AIReport {
  id: string;
  workspaceId: string;
  reportType: ReportType;
  periodStart: Date;
  periodEnd: Date;
  title: string;
  summary: string; // What happened
  insights: string; // Why / Analysis
  recommendations: string; // What next
  metricsSnapshot: Record<string, unknown>;
  generatedBy: "llm" | "template";
  model?: string;
  status: "generating" | "generated" | "failed";
  error?: string;
  createdAt: Date;
}

export interface ReportSchedule {
  id: string;
  workspaceId: string;
  reportType: ReportType;
  enabled: boolean;
  sendTime: string; // HH:MM
  timezone: string;
  recipients: string[];
  format: "html" | "pdf" | "markdown";
  includeAiInsights: boolean;
  lastGeneratedAt?: Date;
  nextGenerationAt?: Date;
}

/** Generate AI report using LLM. */
export async function generateAIReport(
  workspaceId: string,
  reportType: ReportType,
  model: string = "gpt-4o-mini"
): Promise<AIReport> {
  const now = new Date();
  let periodStart: Date;
  let periodEnd = new Date(now);
  periodEnd.setHours(23, 59, 59, 999);

  switch (reportType) {
    case "daily":
      periodStart = new Date(now);
      periodStart.setHours(0, 0, 0, 0);
      break;
    case "weekly":
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      periodStart.setHours(0, 0, 0, 0);
      break;
    case "monthly":
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodStart.setHours(0, 0, 0, 0);
      break;
  }

  // Create report record in "generating" state
  const [report] = await db
    .insert(aiReports)
    .values({
      workspaceId,
      reportType,
      periodStart,
      periodEnd,
      title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
      summary: "",
      insights: "",
      recommendations: "",
      metricsSnapshot: {},
      generatedBy: "llm",
      model,
      status: "generating" as const,
    } as any)
    .returning();

  try {
    // Fetch analytics data for the period
    const days = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const analytics = await getAnalyticsDashboard(workspaceId, days);

    // Fetch optimizer decisions for the period
    const optimizerDecisions = await getOptimizerDecisionsForPeriod(workspaceId, periodStart, periodEnd);

    // Fetch A/B test results for the period
    const abTestResults = await getABTestResultsForPeriod(workspaceId, periodStart, periodEnd);

    // Fetch top performing content embeddings for context
    const topEmbeddings = await getTopPerformanceEmbeddings(workspaceId, periodStart, periodEnd);

    // Generate report using LLM
    const { summary, insights, recommendations } = await generateReportWithLLM(
      {
        reportType,
        periodStart,
        periodEnd,
        analytics,
        optimizerDecisions,
        abTestResults,
        topEmbeddings,
      },
      model
    );

    // Update report with generated content
    const [updatedReport] = await db
      .update(aiReports)
      .set({
        title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report (${formatDate(periodStart)} - ${formatDate(periodEnd)})`,
        summary,
        insights,
        recommendations,
        metricsSnapshot: {
          summary: analytics.summary,
          topPlatforms: analytics.byPlatform.slice(0, 3),
          topPosts: analytics.byPost.slice(0, 5),
          optimizerDecisionsCount: optimizerDecisions.length,
          abTestsCompleted: abTestResults.filter(r => r.decision === "winner").length,
        },
        status: "generated",
        generatedBy: "llm",
      })
      .where(eq(aiReports.id, report.id))
      .returning();

    return {
      ...updatedReport,
      periodStart: new Date(updatedReport.periodStart),
      periodEnd: new Date(updatedReport.periodEnd),
      createdAt: new Date(updatedReport.createdAt),
      reportType: updatedReport.reportType as ReportType,
      generatedBy: (updatedReport.generatedBy ?? "llm") as "llm" | "template",
      model: updatedReport.model ?? undefined,
      status: updatedReport.status as "generating" | "generated" | "failed",
      error: updatedReport.error ?? undefined,
      metricsSnapshot: updatedReport.metricsSnapshot ?? {},
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await db
      .update(aiReports)
      .set({
        status: "failed",
        error: errorMsg,
      })
      .where(eq(aiReports.id, report.id));
    throw error;
  }
}

/** Generate report content using LLM. */
async function generateReportWithLLM(
  data: {
    reportType: ReportType;
    periodStart: Date;
    periodEnd: Date;
    analytics: Awaited<ReturnType<typeof getAnalyticsDashboard>>;
    optimizerDecisions: any[];
    abTestResults: any[];
    topEmbeddings: any[];
  },
  model: string
): Promise<{ summary: string; insights: string; recommendations: string }> {
  const { reportType, periodStart, periodEnd, analytics, optimizerDecisions, abTestResults, topEmbeddings } = data;

  const periodLabel = reportType.charAt(0).toUpperCase() + reportType.slice(1);

  const prompt = `You are an AI marketing analyst for an affiliate automation SaaS. Generate a ${reportType} report for the period ${formatDate(periodStart)} to ${formatDate(periodEnd)}.

DATA:
- Total Impressions: ${analytics.summary.totalImpressions.toLocaleString()}
- Total Clicks: ${analytics.summary.totalClicks.toLocaleString()}
- Total Conversions: ${analytics.summary.totalConversions.toLocaleString()}
- Total Revenue: $${analytics.summary.totalRevenue.toFixed(2)}
- Overall CTR: ${(analytics.summary.ctr * 100).toFixed(2)}%

Top Platforms:
${analytics.byPlatform.slice(0, 5).map(p => `- ${p.platform}: ${p.impressions.toLocaleString()} impressions, ${p.clicks.toLocaleString()} clicks, $${p.revenue.toFixed(2)} revenue, ${(p.ctr * 100).toFixed(2)}% CTR`).join("\n")}

Top Posts by Revenue:
${analytics.byPost.slice(0, 5).map(p => `- "${p.title}" (${p.platform}): $${p.revenue.toFixed(2)}, ${(p.ctr * 100).toFixed(2)}% CTR`).join("\n")}

Optimizer Decisions (${optimizerDecisions.length}):
${optimizerDecisions.slice(0, 5).map(d => `- ${d.decisionType} on ${d.targetType} ${d.targetId.slice(0, 8)}: ${d.reason} (${d.confidence}% confidence)`).join("\n") || "No optimizer decisions this period"}

A/B Test Results (${abTestResults.length}):
${abTestResults.slice(0, 5).map(r => `- ${r.decision}: ${r.winnerVariantId} (${r.confidence}% confidence, ${r.lift ? r.lift + "% lift" : "no lift"})`).join("\n") || "No A/B tests completed this period"}

Performance Patterns (from vector memory):
${topEmbeddings.slice(0, 3).map(e => `- ${e.contentType}: ${e.contentText.slice(0, 100)}...`).join("\n") || "No pattern data available"}

Generate a structured report with three sections:
1. SUMMARY (What happened): 3-4 sentences highlighting key metrics, wins, and losses
2. INSIGHTS (Why): 3-4 bullet points explaining the "why" behind the numbers - root causes, patterns, anomalies
3. RECOMMENDATIONS (What next): 3-4 actionable, specific recommendations for the next period

Format as JSON with keys: summary, insights, recommendations`;

  try {
    const result = await generateText({
      model: openai(model),
      prompt,
      temperature: 0.3,
      maxOutputTokens: 1500,
    });

    const text = result.text;
    let parsed;
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      // Fallback: parse manually
      parsed = parseManualReport(text);
    }

    return {
      summary: parsed.summary || "Report generated successfully.",
      insights: parsed.insights || "Insights generated.",
      recommendations: parsed.recommendations || "Recommendations provided.",
    };
  } catch (error) {
    console.error("LLM report generation failed, using template:", error);
    return generateTemplateReport(data);
  }
}

/** Fallback template-based report generation. */
function generateTemplateReport(data: {
  reportType: ReportType;
  analytics: Awaited<ReturnType<typeof getAnalyticsDashboard>>;
  optimizerDecisions: any[];
  abTestResults: any[];
}): { summary: string; insights: string; recommendations: string } {
  const { reportType, analytics, optimizerDecisions, abTestResults } = data;
  const periodLabel = reportType.charAt(0).toUpperCase() + reportType.slice(1);

  const summary = `${periodLabel} report: Generated $${analytics.summary.totalRevenue.toFixed(2)} from ${analytics.summary.totalConversions} conversions (${analytics.summary.totalImpressions.toLocaleString()} impressions, ${(analytics.summary.ctr * 100).toFixed(2)}% CTR). ${optimizerDecisions.length} optimizer decisions made. ${abTestResults.filter(r => r.decision === "winner").length} A/B tests found winners.`;

  const insights = [
    `Best platform: ${analytics.byPlatform.sort((a, b) => b.revenue - a.revenue)[0]?.platform ?? "N/A"} with $${analytics.byPlatform.sort((a, b) => b.revenue - a.revenue)[0]?.revenue.toFixed(2) ?? "0"} revenue.`,
    analytics.summary.ctr < 0.01 ? "Overall CTR below 1% — hooks need improvement." : "CTR is healthy.",
    optimizerDecisions.filter(d => d.decisionType === "boost").length > 0 ? `${optimizerDecisions.filter(d => d.decisionType === "boost").length} posts boosted for high performance.` : "No posts boosted this period.",
    abTestResults.filter(r => r.decision === "winner").length > 0 ? `${abTestResults.filter(r => r.decision === "winner").length} A/B tests found significant winners.` : "No conclusive A/B test results.",
  ].filter(Boolean).join(" ");

  const recommendations = [
    "Focus content on top-performing product categories.",
    "Test 2 new hooks for the best-selling product.",
    "Increase posting frequency on best platform by 20%.",
    "Review and pause underperforming posts (CTR < 0.5%).",
  ].join(" ");

  return { summary, insights, recommendations };
}

/** Parse manually if JSON parsing fails. */
function parseManualReport(text: string): { summary: string; insights: string; recommendations: string } {
  const summaryMatch = text.match(/(?:SUMMARY|What happened)[:\s]*([\s\S]*?)(?:\n\s*(?:INSIGHTS|Why|RECOMMENDATIONS|What next)|$)/i);
  const insightsMatch = text.match(/(?:INSIGHTS|Why)[:\s]*([\s\S]*?)(?:\n\s*(?:RECOMMENDATIONS|What next)|$)/i);
  const recommendationsMatch = text.match(/(?:RECOMMENDATIONS|What next)[:\s]*([\s\S]*?)$/i);

  return {
    summary: summaryMatch?.[1]?.trim() || "Summary generated.",
    insights: insightsMatch?.[1]?.trim() || "Insights generated.",
    recommendations: recommendationsMatch?.[1]?.trim() || "Recommendations provided.",
  };
}

/** Get optimizer decisions for a period. */
async function getOptimizerDecisionsForPeriod(workspaceId: string, start: Date, end: Date) {
  const { optimizerDecisions } = await import("@aa/db");
  return db
    .select()
    .from(optimizerDecisions)
    .where(and(
      eq(optimizerDecisions.workspaceId, workspaceId),
      gte(optimizerDecisions.createdAt, start),
      lte(optimizerDecisions.createdAt, end)
    ))
    .orderBy(desc(optimizerDecisions.createdAt))
    .limit(20);
}

/** Get A/B test results for a period. */
async function getABTestResultsForPeriod(workspaceId: string, start: Date, end: Date) {
  const winners = await db
    .select()
    .from(abTestWinners)
    .innerJoin(abTests, eq(abTestWinners.abTestId, abTests.id))
    .where(and(
      eq(abTests.workspaceId, workspaceId),
      gte(abTestWinners.createdAt, start),
      lte(abTestWinners.createdAt, end)
    ))
    .orderBy(desc(abTestWinners.createdAt))
    .limit(20);

  return winners.map(w => ({
    ...w.ab_test_winners,
    decision: w.ab_test_winners.decision as "winner" | "inconclusive" | "no_winner",
  }));
}

/** Get top performance embeddings for context. */
async function getTopPerformanceEmbeddings(workspaceId: string, start: Date, end: Date) {
  return db
    .select()
    .from(performanceEmbeddings)
    .where(and(
      eq(performanceEmbeddings.workspaceId, workspaceId),
      gte(performanceEmbeddings.createdAt, start),
      lte(performanceEmbeddings.createdAt, end)
    ))
    .orderBy(desc(performanceEmbeddings.createdAt))
    .limit(10);
}

/** Format date as YYYY-MM-DD. */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/** Get pending scheduled reports that need generation. */
export async function getPendingReportSchedules(): Promise<ReportSchedule[]> {
  const now = new Date();
  const schedules = await db
    .select()
    .from(reportSchedulesTable)
    .where(and(
      eq(reportSchedulesTable.enabled, true),
      lte(reportSchedulesTable.nextGenerationAt, now)
    ))
    .orderBy(reportSchedulesTable.nextGenerationAt);

  return schedules.map(s => ({
    ...s,
    reportType: s.reportType as ReportType,
    sendTime: s.sendTime ?? "09:00",
    timezone: (s.timezone ?? "UTC") as "UTC" | string,
    format: (s.format ?? "html") as "html" | "pdf" | "markdown",
    recipients: s.recipients ?? [],
    lastGeneratedAt: s.lastGeneratedAt ?? undefined,
    nextGenerationAt: s.nextGenerationAt ?? undefined,
  }));
}

/** Update schedule after generation. */
export async function updateScheduleAfterGeneration(scheduleId: string): Promise<void> {
  const [schedule] = await db
    .select()
    .from(reportSchedulesTable)
    .where(eq(reportSchedulesTable.id, scheduleId))
    .limit(1);

  if (!schedule) return;

  const now = new Date();
  let nextGen = new Date(now);

  switch (schedule.reportType) {
    case "daily":
      nextGen.setDate(nextGen.getDate() + 1);
      break;
    case "weekly":
      nextGen.setDate(nextGen.getDate() + 7);
      break;
    case "monthly":
      nextGen.setMonth(nextGen.getMonth() + 1);
      break;
  }

  // Set to send time
  const [hours, minutes] = (schedule.sendTime ?? "09:00").split(":").map(Number);
  nextGen.setHours(hours, minutes, 0, 0);

  await db
    .update(reportSchedulesTable)
    .set({
      lastGeneratedAt: now,
      nextGenerationAt: nextGen,
      updatedAt: now,
    })
    .where(eq(reportSchedulesTable.id, scheduleId));
}

/** Create default report schedule for workspace. */
export async function createDefaultReportSchedule(workspaceId: string, reportType: ReportType = "weekly"): Promise<void> {
  const now = new Date();
  let nextGen = new Date(now);

  switch (reportType) {
    case "daily":
      nextGen.setDate(nextGen.getDate() + 1);
      break;
    case "weekly":
      nextGen.setDate(nextGen.getDate() + 7);
      break;
    case "monthly":
      nextGen.setMonth(nextGen.getMonth() + 1);
      break;
  }

  nextGen.setHours(9, 0, 0, 0);

  await db.insert(reportSchedulesTable).values({
    workspaceId,
    reportType,
    enabled: true,
    sendTime: "09:00",
    timezone: "UTC",
    recipients: [],
    format: "html",
    includeAiInsights: true,
    nextGenerationAt: nextGen,
  }).onConflictDoNothing();
}

/** Store performance embedding for vector memory. */
export async function storePerformanceEmbedding(
  workspaceId: string,
  contentType: "post" | "video" | "hook" | "cta" | "niche_summary",
  contentId: string | null,
  contentText: string,
  embedding: number[],
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await db.insert(performanceEmbeddings).values({
    workspaceId,
    contentType,
    contentId: contentId ? contentId : null,
    contentText,
    embedding,
    metadata,
  });
}

/** Search similar performance patterns using vector similarity. */
export async function searchSimilarPerformance(
  workspaceId: string,
  queryEmbedding: number[],
  limit: number = 5,
  threshold: number = 0.7
): Promise<Array<{ contentType: string; contentText: string; metadata: Record<string, unknown>; similarity: number }>> {
  const results = await db
    .select({
      contentType: performanceEmbeddings.contentType,
      contentText: performanceEmbeddings.contentText,
      metadata: performanceEmbeddings.metadata,
      similarity: sql<number>`1 - (${performanceEmbeddings.embedding} <=> ${queryEmbedding}::vector)`,
    })
    .from(performanceEmbeddings)
    .where(and(
      eq(performanceEmbeddings.workspaceId, workspaceId),
      sql`1 - (${performanceEmbeddings.embedding} <=> ${queryEmbedding}::vector) > ${threshold}`
    ))
    .orderBy(sql`1 - (${performanceEmbeddings.embedding} <=> ${queryEmbedding}::vector)`)
    .limit(limit);

  return results.map(r => ({
    contentType: r.contentType,
    contentText: r.contentText,
    metadata: r.metadata ?? {},
    similarity: r.similarity,
  }));
}

/** Record A/B test winner. */
export async function recordABTestWinner(
  abTestId: string,
  winnerVariantId: string,
  confidence: number,
  pValue: number | null,
  lift: number | null,
  sampleSize: number,
  decision: "winner" | "inconclusive" | "no_winner",
  metrics: Record<string, unknown>
): Promise<void> {
  await db.insert(abTestWinners).values({
    abTestId,
    winnerVariantId,
    confidence: String(confidence),
    pValue: pValue ? String(pValue) : null,
    lift: lift ? String(lift) : null,
    sampleSize,
    decision,
    metrics,
    autoApplied: false,
  });
}

/** Auto-apply A/B test winner (e.g., update post with winning variant). */
export async function autoApplyABTestWinner(abTestId: string): Promise<void> {
  const [winner] = await db
    .select()
    .from(abTestWinners)
    .where(eq(abTestWinners.abTestId, abTestId))
    .orderBy(desc(abTestWinners.createdAt))
    .limit(1);

  if (!winner || winner.decision !== "winner" || winner.autoApplied) return;

  // TODO: Apply winning variant to live post/campaign
  // This would update the post with the winning hook/CTA/format

  await db
    .update(abTestWinners)
    .set({
      autoApplied: true,
      appliedAt: new Date(),
    })
    .where(eq(abTestWinners.id, winner.id));
}