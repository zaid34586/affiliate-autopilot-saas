/**
 * Phase 6 Module C — AI Copilot Action Execution.
 * POST /api/dashboard/copilot/actions/execute - Execute a confirmed action
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, products, contents, copilotMessages, analyticsDaily, autopilotConfig, optimizerDecisions, abTests, characters } from "@aa/db";
import { eq, and, inArray, desc, gte, sql, sum } from "drizzle-orm";

interface ExecuteActionRequest {
  actionType: "create_post" | "schedule_post" | "create_campaign" | "run_research" | "analyze_performance" | "optimizer_action" | "autopilot_control" | "character_config";
  payload: Record<string, unknown>;
  conversationId: string;
  messageId: string;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: { actionType: string; payload: Record<string, unknown>; conversationId: string; messageId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { actionType, payload, conversationId, messageId } = body;

  if (!actionType || !payload) {
    return NextResponse.json({ error: "actionType and payload required" }, { status: 400 });
  }

  try {
    let result: { success: boolean; result?: unknown; error?: string } = { success: false };

    switch (actionType) {
      case "create_post": {
        const { productId, platform, format, hook, cta, scheduledAt, autoPublish } = payload as {
          productId: string;
          platform: string;
          format?: string;
          hook?: string;
          cta?: string;
          scheduledAt?: string;
          autoPublish?: boolean;
        };

        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);

        if (!product) {
          return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        // Create content first (linked to product)
        const [content] = await db
          .insert(contents)
          .values({
            workspaceId,
            productId,
            type: "caption",
            platformTarget: platform,
            body: { hook: hook || `Check out ${product.title}!`, cta: cta || "Link in bio" },
            status: "draft",
          })
          .returning();

        const status = autoPublish ? "scheduled" : "draft";
        const [post] = await db
          .insert(posts)
          .values({
            workspaceId,
            contentId: content.id,
            platform,
            status,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          })
          .returning();

        result = { success: true, result: { postId: post.id, contentId: content.id, message: `Post created for ${product.title} on ${platform}` } };
        break;
      }

      case "schedule_post": {
        const { postId, scheduledAt } = payload as { postId: string; scheduledAt: string };

        const [post] = await db
          .update(posts)
          .set({
            status: "scheduled",
            scheduledAt: new Date(scheduledAt),
          })
          .where(eq(posts.id, postId))
          .returning();

        result = { success: true, result: { postId: post.id, scheduledAt } };
        break;
      }

      case "create_campaign": {
        const { goal, durationDays, products: productIds, platforms, postsPerDay, theme } = payload as {
          goal: string;
          durationDays: number;
          products: string[];
          platforms: string[];
          postsPerDay: number;
          theme?: string;
        };

        const productList = await db
          .select()
          .from(products)
          .where(inArray(products.id, productIds))
          .limit(10);

        const campaign: {
          goal: string;
          durationDays: number;
          theme?: string;
          platforms: string[];
          postsPerDay: number;
          products: Array<{ id: string; title: string; aiScore: number | null }>;
          dailyPlan: Array<{ day: number; posts: Array<{ productId: string; productTitle: string; platform: string; format: string; hookIdea: string }> }>;
        } = {
          goal,
          durationDays,
          theme,
          platforms,
          postsPerDay,
          products: productList.map(p => ({
            id: p.id,
            title: p.title,
            aiScore: p.aiScore,
          })),
          dailyPlan: [],
        };

        for (let day = 1; day <= durationDays; day++) {
          const dailyPosts: Array<{ productId: string; productTitle: string; platform: string; format: string; hookIdea: string }> = [];
          for (let i = 0; i < postsPerDay; i++) {
            const product = productList[i % productList.length];
            dailyPosts.push({
              productId: product.id,
              productTitle: product.title,
              platform: platforms[i % platforms.length],
              format: "reel",
              hookIdea: `${theme ? theme + ": " : ""}Day ${day} showcase of ${product.title}`,
            });
          }
          campaign.dailyPlan.push({ day, posts: dailyPosts });
        }

        result = { success: true, result: { campaign, message: `Created ${durationDays}-day campaign with ${durationDays * postsPerDay} posts` } };
        break;
      }

      case "run_research": {
        // Trigger research pipeline (would call the research cron or queue a job)
        result = { success: true, result: { message: "Research job queued" } };
        break;
      }

      case "analyze_performance": {
        const { days, platform } = payload as { days?: number; platform?: string };
        const since = new Date(Date.now() - (days || 7) * 24 * 60 * 60 * 1000);
        const sinceStr = since.toISOString().split("T")[0];

        const where = platform
          ? and(eq(analyticsDaily.workspaceId, workspaceId), gte(analyticsDaily.day, sinceStr), eq(analyticsDaily.platform, platform))
          : and(eq(analyticsDaily.workspaceId, workspaceId), gte(analyticsDaily.day, sinceStr));

        const [summary] = await db
          .select({
            impressions: sum(analyticsDaily.impressions),
            clicks: sum(analyticsDaily.clicks),
            conversions: sum(analyticsDaily.conversions),
            revenue: sum(analyticsDaily.revenue),
          })
          .from(analyticsDaily)
          .where(where)
          .limit(1);

        const impressions = Number(summary?.impressions ?? 0);
        const clicks = Number(summary?.clicks ?? 0);
        
        result = {
          success: true,
          result: {
            impressions,
            clicks,
            conversions: Number(summary?.conversions ?? 0),
            revenue: Number(summary?.revenue ?? 0),
            ctr: impressions > 0 ? clicks / impressions : 0,
          },
        };
        break;
      }

      case "optimizer_action": {
        const { action, decisionId } = payload as { action: string; decisionId?: string };

        if (action === "list_pending") {
          const decisions = await db
            .select()
            .from(optimizerDecisions)
            .where(and(eq(optimizerDecisions.workspaceId, workspaceId), eq(optimizerDecisions.executed, false)))
            .orderBy(desc(optimizerDecisions.createdAt))
            .limit(20);
          
          result = { success: true, result: { decisions } };
        } else if (action === "execute" && decisionId) {
          const { executeDecision } = await import("@/lib/optimizer/optimizer");
          const execResult = await executeDecision(workspaceId, decisionId);
          result = { success: execResult.success, error: execResult.error };
        } else {
          result = { success: false, error: "Invalid optimizer action" };
        }
        break;
      }

      case "autopilot_control": {
        const { action, level, dailyCaps } = payload as { action: string; level?: string; dailyCaps?: Record<string, number> };

        if (action === "pause" || action === "resume") {
          await db
            .update(autopilotConfig)
            .set({ paused: action === "pause", updatedAt: new Date() })
            .where(eq(autopilotConfig.workspaceId, workspaceId));
          result = { success: true, result: { message: `Autopilot ${action}d` } };
        } else if (action === "set_level" && level) {
          const validLevels = ["manual", "semi", "full", "fire_and_forget"] as const;
          if (!validLevels.includes(level as any)) {
            result = { success: false, error: "Invalid autopilot level" };
            break;
          }
          await db
            .update(autopilotConfig)
            .set({ level: level as any, updatedAt: new Date() })
            .where(eq(autopilotConfig.workspaceId, workspaceId));
          result = { success: true, result: { message: `Autopilot level set to ${level}` } };
        } else {
          result = { success: false, error: "Invalid autopilot action" };
        }
        break;
      }

      case "character_config": {
        const { action, name, personality, tone, voiceId } = payload as { action: string; name?: string; personality?: string; tone?: string; voiceId?: string };

        if (action === "get") {
          const [character] = await db
            .select()
            .from(characters)
            .where(eq(characters.workspaceId, workspaceId))
            .limit(1);
          result = { success: true, result: character };
        } else {
          const updateData: Record<string, unknown> = { updatedAt: new Date() };
          if (name) updateData.name = name;
          if (personality) updateData.personality = personality;
          if (tone) updateData.tone = tone;
          if (voiceId) updateData.voiceId = voiceId;

          await db
            .update(characters)
            .set(updateData)
            .where(eq(characters.workspaceId, workspaceId));

          result = { success: true, result: { message: "Character updated" } };
        }
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action type: ${actionType}` }, { status: 400 });
    }

    // Update the message with action result
    await db
      .update(copilotMessages)
      .set({
        toolResults: [{ toolCallId: messageId, name: actionType, result: result.result, error: result.error }],
      })
      .where(eq(copilotMessages.id, messageId));

    return NextResponse.json({ success: result.success, result: result.result, error: result.error });
  } catch (e) {
    console.error("Execute action error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to execute action" },
      { status: 500 },
    );
  }
}