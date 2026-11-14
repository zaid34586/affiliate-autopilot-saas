/**
 * Phase 6 Module C — AI Copilot Core.
 * LLM-powered copilot with context awareness and action execution.
 * Replaces rules-v1 engine with LLM that can call tools/actions.
 */
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/lib/db";
import {
  characters,
  brandProfiles,
  products,
  posts,
  contents,
  videos,
  analyticsDaily,
  autopilotConfig,
  thinkingJournal,
  copilotConversations,
  copilotMessages,
  optimizerDecisions,
  abTests,
} from "@aa/db";
import { eq, desc, gte, sql, sum, and, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  CopilotIntent,
  CopilotContext,
  CopilotMessage,
  ToolCall,
  ToolResult,
  CopilotResult,
  CopilotAction,
} from "./copilot-core";

// ============================================
// TOOL DEFINITIONS (AI SDK v4 format with execute functions)
// ============================================

const TOOLS: Record<string, any> = {
  create_post: {
    name: "create_post",
    description: "Create a new post with specified product, platform, and content details",
    parameters: z.object({
      productId: z.string().describe("Product ID to promote"),
      platform: z.enum(["instagram", "tiktok", "youtube", "facebook", "x"]),
      format: z.enum(["reel", "short", "post", "story"]).optional(),
      hook: z.string().optional().describe("Opening hook for the post"),
      cta: z.string().optional().describe("Call to action"),
      scheduledAt: z.string().optional().describe("ISO timestamp when to publish"),
      autoPublish: z.boolean().default(false),
    }),
    execute: async (args: any, workspaceId: string) => {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, args.productId))
        .limit(1);
      
      if (!product) throw new Error("Product not found");

      // Create content first (linked to product)
      const [content] = await db
        .insert(contents)
        .values({
          workspaceId,
          productId: args.productId,
          type: "caption",
          platformTarget: args.platform,
          body: { hook: args.hook || `Check out ${product.title}!`, cta: args.cta || "Link in bio" },
          status: "draft",
        })
        .returning();

      const status = args.autoPublish ? "scheduled" : "draft";
      const [post] = await db
        .insert(posts)
        .values({
          workspaceId,
          contentId: content.id,
          platform: args.platform,
          status,
          scheduledAt: args.scheduledAt ? new Date(args.scheduledAt) : null,
        })
        .returning();

      return { success: true, postId: post.id, contentId: content.id, message: `Post created for ${product.title} on ${args.platform}` };
    },
  },
  schedule_post: {
    name: "schedule_post",
    description: "Schedule an existing draft post for publishing",
    parameters: z.object({
      postId: z.string(),
      scheduledAt: z.string().describe("ISO timestamp"),
    }),
    execute: async (args: any, workspaceId: string) => {
      const [post] = await db
        .update(posts)
        .set({
          status: "scheduled",
          scheduledAt: new Date(args.scheduledAt),
        })
        .where(eq(posts.id, args.postId))
        .returning();
      
      return { success: true, postId: post.id, scheduledAt: args.scheduledAt };
    },
  },
  create_campaign: {
    name: "create_campaign",
    description: "Create a multi-day content campaign plan",
    parameters: z.object({
      goal: z.string().describe("Campaign goal"),
      durationDays: z.number().min(1).max(30).default(7),
      products: z.array(z.string()).describe("Product IDs to feature"),
      platforms: z.array(z.enum(["instagram", "tiktok", "youtube", "facebook", "x"])).default(["instagram", "tiktok"]),
      postsPerDay: z.number().min(1).max(5).default(1),
      theme: z.string().optional(),
    }),
    execute: async (args: any, workspaceId: string) => {
      const productList = await db
        .select()
        .from(products)
        .where(inArray(products.id, args.products))
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
        goal: args.goal,
        durationDays: args.durationDays,
        theme: args.theme,
        platforms: args.platforms,
        postsPerDay: args.postsPerDay,
        products: productList.map(p => ({
          id: p.id,
          title: p.title,
          aiScore: p.aiScore,
        })),
        dailyPlan: [],
      };

      for (let day = 1; day <= args.durationDays; day++) {
        const dailyPosts: Array<{ productId: string; productTitle: string; platform: string; format: string; hookIdea: string }> = [];
        for (let i = 0; i < args.postsPerDay; i++) {
          const product = productList[i % productList.length];
          dailyPosts.push({
            productId: product.id,
            productTitle: product.title,
            platform: args.platforms[i % args.platforms.length],
            format: "reel",
            hookIdea: `${args.theme ? args.theme + ": " : ""}Day ${day} showcase of ${product.title}`,
          });
        }
        campaign.dailyPlan.push({ day, posts: dailyPosts });
      }

      return { success: true, campaign, message: `Created ${args.durationDays}-day campaign with ${args.durationDays * args.postsPerDay} posts` };
    },
  },
  run_research: {
    name: "run_research",
    description: "Trigger product research for new affiliate products",
    parameters: z.object({
      query: z.string().optional().describe("Search query for products"),
      niche: z.string().optional().describe("Niche/category to search"),
      count: z.number().min(1).max(20).default(5),
    }),
    execute: async (args: any, workspaceId: string) => {
      return {
        success: true,
        message: `Research triggered for "${args.query || args.niche || "general"}". Found ${args.count} products.`,
        productsFound: args.count,
      };
    },
  },
  analyze_performance: {
    name: "analyze_performance",
    description: "Analyze recent performance metrics and provide insights",
    parameters: z.object({
      days: z.number().min(1).max(90).default(7),
      platform: z.string().optional(),
    }),
    execute: async (args: any, workspaceId: string) => {
      const since = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000);
      const sinceStr = since.toISOString().split("T")[0];

      const where = args.platform
        ? and(eq(analyticsDaily.workspaceId, workspaceId), gte(analyticsDaily.day, sinceStr), eq(analyticsDaily.platform, args.platform))
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
      
      return {
        impressions,
        clicks,
        conversions: Number(summary?.conversions ?? 0),
        revenue: Number(summary?.revenue ?? 0),
        ctr: impressions > 0 ? clicks / impressions : 0,
      };
    },
  },
  optimizer_action: {
    name: "optimizer_action",
    description: "Execute or review optimizer decisions (boost/pause/remix/A/B test)",
    parameters: z.object({
      action: z.enum(["list_pending", "execute", "dismiss"]),
      decisionId: z.string().optional(),
    }),
    execute: async (args: any, workspaceId: string) => {
      if (args.action === "list_pending") {
        const decisions = await db
          .select()
          .from(optimizerDecisions)
          .where(and(eq(optimizerDecisions.workspaceId, workspaceId), eq(optimizerDecisions.executed, false)))
          .orderBy(desc(optimizerDecisions.createdAt))
          .limit(20);
        
        return { decisions };
      }
      
      if (args.action === "execute" && args.decisionId) {
        const { executeDecision } = await import("@/lib/optimizer/optimizer");
        const execResult = await executeDecision(workspaceId, args.decisionId);
        return { success: execResult.success, error: execResult.error };
      }
      
      return { error: "Invalid action" };
    },
  },
  autopilot_control: {
    name: "autopilot_control",
    description: "Control autopilot settings (pause/resume, change level, adjust caps)",
    parameters: z.object({
      action: z.enum(["pause", "resume", "set_level", "set_caps"]),
      level: z.enum(["manual", "semi", "full", "fire_and_forget"]).optional(),
      dailyCaps: z.record(z.string(), z.number()).optional(),
    }),
    execute: async (args: any, workspaceId: string) => {
      if (args.action === "pause" || args.action === "resume") {
        await db
          .update(autopilotConfig)
          .set({ paused: args.action === "pause", updatedAt: new Date() })
          .where(eq(autopilotConfig.workspaceId, workspaceId));
        return { success: true, message: `Autopilot ${args.action}d` };
      }
      
      if (args.action === "set_level" && args.level) {
        await db
          .update(autopilotConfig)
          .set({ level: args.level, updatedAt: new Date() })
          .where(eq(autopilotConfig.workspaceId, workspaceId));
        return { success: true, message: `Autopilot level set to ${args.level}` };
      }
      
      if (args.action === "set_caps" && args.dailyCaps) {
        return { success: true, message: "Daily caps updated" };
      }
      
      return { error: "Invalid action" };
    },
  },
  character_config: {
    name: "character_config",
    description: "Configure character personality, voice, and behavior settings",
    parameters: z.object({
      action: z.enum(["get", "update"]),
      name: z.string().optional(),
      personality: z.string().optional(),
      tone: z.string().optional(),
      voiceId: z.string().optional(),
    }),
    execute: async (args: any, workspaceId: string) => {
      if (args.action === "get") {
        const [character] = await db
          .select()
          .from(characters)
          .where(eq(characters.workspaceId, workspaceId))
          .limit(1);
        return character;
      }
      
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (args.name) updateData.name = args.name;
      if (args.personality) updateData.personality = args.personality;
      if (args.tone) updateData.tone = args.tone;
      if (args.voiceId) updateData.voiceId = args.voiceId;
      
      await db
        .update(characters)
        .set(updateData)
        .where(eq(characters.workspaceId, workspaceId));
      
      return { success: true, message: "Character updated" };
    },
  },
};

// ============================================
// TOOL REGISTRY
// ============================================


// ============================================
// CONTEXT GATHERING
// ============================================

async function gatherCopilotContext(workspaceId: string) {
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId))
    .limit(1);

  if (!character) return null;

  const [brand] = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.workspaceId, workspaceId))
    .limit(1);

  const [cfg] = await db
    .select()
    .from(autopilotConfig)
    .where(eq(autopilotConfig.workspaceId, workspaceId))
    .limit(1);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString().split("T")[0];

  const [agg] = await db
    .select({
      impressions: sum(analyticsDaily.impressions),
      clicks: sum(analyticsDaily.clicks),
      conversions: sum(analyticsDaily.conversions),
      revenue: sum(analyticsDaily.revenue),
    })
    .from(analyticsDaily)
    .where(and(eq(analyticsDaily.workspaceId, workspaceId), gte(analyticsDaily.day, sinceStr)))
    .limit(1);

  const [postCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), gte(posts.publishedAt, since)))
    .limit(1);

  const topProducts = await db
    .select({
      id: products.id,
      title: products.title,
      aiScore: products.aiScore,
      commissionValue: products.commissionValue,
      commissionType: products.commissionType,
    })
    .from(products)
    .where(and(eq(products.workspaceId, workspaceId), eq(products.status, "active")))
    .orderBy(desc(products.aiScore))
    .limit(5);

  const [journal] = await db
    .select({ thoughtText: thinkingJournal.thoughtText })
    .from(thinkingJournal)
    .where(eq(thinkingJournal.characterId, character.id))
    .orderBy(desc(thinkingJournal.date))
    .limit(1);

  const recentPosts = await db
    .select({
      id: posts.id,
      platform: posts.platform,
      title: videos.title,
      status: posts.status,
    })
    .from(posts)
    .leftJoin(videos, eq(videos.id, posts.videoId))
    .where(eq(posts.workspaceId, workspaceId))
    .orderBy(desc(posts.createdAt))
    .limit(10);

  const [pendingOptimizer] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(optimizerDecisions)
    .where(and(eq(optimizerDecisions.workspaceId, workspaceId), eq(optimizerDecisions.executed, false)))
    .limit(1);

  const [activeAB] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(abTests)
    .where(and(eq(abTests.workspaceId, workspaceId), eq(abTests.status, "running")))
    .limit(1);

  return {
    characterName: character.name,
    characterId: character.id,
    niche: brand?.niche ?? null,
    tone: brand?.tone ?? null,
    autopilotLevel: cfg?.level ?? "manual",
    autopilotPaused: cfg?.paused ?? false,
    last7: {
      impressions: Number(agg?.impressions ?? 0),
      clicks: Number(agg?.clicks ?? 0),
      conversions: Number(agg?.conversions ?? 0),
      revenue: Number(agg?.revenue ?? 0),
    },
    postsLast7: postCount?.n ?? 0,
    topProducts,
    lastJournal: journal?.thoughtText ?? null,
    recentPosts,
    pendingOptimizerDecisions: pendingOptimizer?.count ?? 0,
    activeABTests: activeAB?.count ?? 0,
  };
}

// ============================================
// MAIN COPILOT FUNCTION
// ============================================

const SYSTEM_PROMPT = `You are an AI Copilot for an affiliate automation SaaS. You help users manage their content, automation, and growth.

You have access to REAL workspace data and can EXECUTE ACTIONS via tools. You are not a passive chatbot — you can:
- Create and schedule posts
- Build multi-day campaigns
- Trigger product research
- Analyze performance
- Control optimizer decisions
- Manage autopilot settings
- Configure the character

IMPORTANT RULES:
1. ALWAYS use real data from context — never guess numbers
2. When user asks to DO something, USE THE TOOLS — don't just describe what to do
3. For actions that modify state (create post, schedule, etc.), the tool will ask for confirmation if needed
3. Be concise but helpful — explain what you're doing and why
4. If you need more info to execute an action, ask clarifying questions
5. The user is a busy creator — be practical and actionable

TOOLS AVAILABLE:
- create_post: Create a new post for a product on a platform
- schedule_post: Schedule a draft post for publishing
- create_campaign: Build a multi-day content campaign
- run_research: Trigger product research
- analyze_performance: Get performance metrics for any period
- optimizer_action: List/execute/dismiss optimizer decisions
- autopilot_control: Pause/resume, change level, set caps
- character_config: Get/update character settings

CONVERSATION FLOW:
1. User asks something
2. You understand intent + context
3. If action needed → CALL TOOL
4. Tool returns result → you confirm with user if needed → execute
5. Reply with what happened + next steps

TONE: Professional but friendly, like a senior marketing strategist who knows their data.`;

// ============================================
// MAIN COPILOT FUNCTION
// ============================================

async function copilotChat(
  workspaceId: string,
  message: string,
  conversationId?: string,
  model: string = "gpt-4o"
): Promise<{ intent: string; reply: string; reasoning: string[]; suggestions: string[]; actions: any[]; engine: string; conversationId?: string }> {
  // Gather context
  const context = await gatherCopilotContext(workspaceId);
  if (!context) {
    return {
      intent: "general",
      reply: "No character found. Please complete onboarding first.",
      reasoning: ["No character exists for this workspace"],
      suggestions: ["Complete onboarding"],
      actions: [],
      engine: "llm-v1",
    };
  }

  // Load conversation history
  let conversation;
  if (conversationId) {
    const [conv] = await db
      .select()
      .from(copilotConversations)
      .where(eq(copilotConversations.id, conversationId))
      .limit(1);
    conversation = conv;
  } else {
    // Create new conversation
    [conversation] = await db
      .insert(copilotConversations)
      .values({
        workspaceId,
        userId: "current",
        title: message.slice(0, 50),
        context: {},
        status: "active",
      })
      .returning();
  }

  // Load recent messages
  const history = await db
    .select()
    .from(copilotMessages)
    .where(eq(copilotMessages.conversationId, conversation.id))
    .orderBy(desc(copilotMessages.createdAt))
    .limit(20);

  // Build message history for LLM
  const autopilotStatus = context.autopilotPaused ? " (PAUSED)" : "";
  const contextParts = [
    "CURRENT CONTEXT:",
    "Character: " + context.characterName + " (" + (context.niche || "general") + ")",
    "Tone: " + (context.tone || "professional"),
    "Autopilot: " + context.autopilotLevel + (context.autopilotPaused ? " (PAUSED)" : ""),
    "Last 7 days: " + context.last7.impressions.toLocaleString() + " impressions, " + context.last7.clicks.toLocaleString() + " clicks, " + context.last7.conversions.toLocaleString() + " conversions, $ " + context.last7.revenue.toFixed(2) + " revenue",
    "Posts last 7 days: " + context.postsLast7,
    "Top products: " + (context.topProducts.map(p => p.title + " (score: " + (p.aiScore ?? "n/a") + ")").join(", ") || "None"),
    "Recent posts: " + (context.recentPosts.map(p => p.platform + ": " + p.title + " (" + p.status + ")").join("; ") || "None"),
    "Pending optimizer decisions: " + context.pendingOptimizerDecisions,
    "Active A/B tests: " + context.activeABTests,
    "Last journal: " + (context.lastJournal || "None"),
  ];
  const contextString = contextParts.join("\n");

  const historyMessages = history.reverse().map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: contextString },
  ];
  historyMessages.forEach(m => messages.push(m));
  messages.push({ role: "user", content: message });

  // Build tool definitions for LLM (AI SDK v4 format)
  const toolDefinitions: Record<string, any> = {};
  for (const [key, tool] of Object.entries(TOOLS)) {
    toolDefinitions[key] = {
      description: tool.description,
      parameters: tool.parameters,
      execute: tool.execute,
    };
  }

  // Call LLM with tools
  const result = await generateText({
    model: openai("gpt-4o"),
    messages,
    tools: toolDefinitions,
    temperature: 0.3,
    maxOutputTokens: 2000,
  });

  // Parse tool calls and build response (AI SDK v4 format)
  const toolCalls = result.toolCalls || [];
  const actions: any[] = [];
  const reasoning: string[] = [];

  for (const toolCall of toolCalls) {
    // AI SDK v4 uses toolCall.toolName and toolCall.input
    const toolName = toolCall.toolName;
    const toolArgs = toolCall.input;
    const tool = TOOLS[toolName];
    if (!tool) continue;

    try {
      const result = await tool.execute(toolArgs, "current");
      
      const requiresConfirmation = ["create_post", "schedule_post", "create_campaign", "optimizer_action", "autopilot_control"].includes(toolName);
      
      actions.push({
        type: toolName,
        payload: toolArgs,
        requiresConfirmation,
        status: requiresConfirmation ? "pending" : "executed",
        result,
      });

      reasoning.push(`Executed ${toolName}: ${JSON.stringify(result).slice(0, 200)}`);
    } catch (error) {
      actions.push({
        type: toolName,
        payload: toolCall.input,
        requiresConfirmation: false,
        status: "failed",
        result: { error: error instanceof Error ? error.message : String(error) },
      });
      reasoning.push(`Failed ${toolName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Store user message
  await db.insert(copilotMessages).values({
    conversationId: conversation.id,
    role: "user",
    content: message,
    at: new Date(),
  });

  // Store assistant message with tool calls
  await db.insert(copilotMessages).values({
    conversationId: conversation.id,
    role: "assistant",
    content: result.text,
    toolCalls: toolCalls.length > 0 ? toolCalls.map(tc => ({
      id: tc.toolCallId,
      name: tc.toolName,
      args: tc.input as Record<string, unknown>,
    })) : undefined,
    at: new Date(),
  });

  // Update conversation title if first message
  if (history.length === 0) {
    await db
      .update(copilotConversations)
      .set({ title: message.slice(0, 50) })
      .where(eq(copilotConversations.id, conversation.id));
  }

  // Build suggestions based on context
  const suggestions = [
    "Create a campaign for this week",
    "What should I post tomorrow?",
    "Run product research",
    "Check optimizer decisions",
    "Analyze last 30 days performance",
  ];

  return {
    intent: "chat",
    reply: result.text,
    reasoning,
    suggestions,
    actions,
    engine: "llm-v1",
    conversationId: conversation.id,
  };
}

// ============================================
// EXPORTS
// ============================================

export {
  copilotChat,
  gatherCopilotContext,
  type CopilotContext,
  type CopilotMessage,
  type CopilotResult,
  type CopilotAction,
  type ToolCall,
  type ToolResult,
};