/**
 * Phase 6 — A/B Test API
 * GET /api/dashboard/optimizer/ab-tests - List A/B tests
 * POST /api/dashboard/optimizer/ab-tests - Create A/B test
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { abTests, abTestResults, optimizerDecisions, posts } from "@aa/db";
import { eq, and, desc, sum } from "drizzle-orm";
import {
  createAbTest,
  startAbTest,
  listAbTests,
  createAbTestsFromOptimizerDecisions,
} from "@/lib/optimizer/ab-test";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const testId = searchParams.get("id");

  try {
    // Single test detail with results
    if (testId) {
      const test = await db
        .select()
        .from(abTests)
        .where(and(eq(abTests.id, testId), eq(abTests.workspaceId, workspaceId)))
        .limit(1);

      if (!test[0]) {
        return NextResponse.json({ error: "Test not found" }, { status: 404 });
      }

      const results = await db
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

      return NextResponse.json({
        test: test[0],
        results: results.map(r => ({
          variantId: r.variantId,
          impressions: Number(r.impressions || 0),
          clicks: Number(r.clicks || 0),
          conversions: Number(r.conversions || 0),
          revenue: Number(r.revenue || 0),
          engagement: Number(r.engagement || 0),
        })),
      });
    }

    // List tests
    const tests = await listAbTests(workspaceId, status);
    return NextResponse.json({ tests });
  } catch (error) {
    console.error("List A/B tests error:", error);
    return NextResponse.json({ error: "Failed to list A/B tests" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: {
    name: string;
    testType: "hook" | "cta" | "format" | "timing";
    variants: { id: string; name: string; config: Record<string, unknown> }[];
    trafficSplit: Record<string, number>;
    metric: "ctr" | "conversions" | "revenue" | "engagement";
    minSampleSize?: number;
    confidenceLevel?: number;
    autoStart?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, testType, variants, trafficSplit, metric, minSampleSize, confidenceLevel, autoStart } = body;

  if (!name || !testType || !variants || !trafficSplit || !metric) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const test = await createAbTest({
      workspaceId,
      name,
      testType,
      variants,
      trafficSplit,
      metric,
      minSampleSize,
      confidenceLevel,
    });

    if (autoStart) {
      await startAbTest(workspaceId, test.id);
    }

    return NextResponse.json({ test }, { status: 201 });
  } catch (error) {
    console.error("Create A/B test error:", error);
    return NextResponse.json({ error: "Failed to create A/B test" }, { status: 500 });
  }
}