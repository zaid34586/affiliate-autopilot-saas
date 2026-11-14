import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  numeric,
  date,
  pgEnum,
  uniqueIndex,
  index,
  vector,
} from "drizzle-orm/pg-core";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
}

// ───────────────────────── ENUMS ─────────────────────────
export const roleEnum = pgEnum("role", ["owner", "admin", "editor", "analyst", "viewer"]);
export const planEnum = pgEnum("plan", ["free", "starter", "pro", "agency"]);
export const connectionStatusEnum = pgEnum("connection_status", ["active", "expired", "revoked"]);
export const autopilotLevelEnum = pgEnum("autopilot_level", ["manual", "semi", "full", "fire_and_forget"]);
export const contentStatusEnum = pgEnum("content_status", ["draft", "approved", "scheduled", "published", "failed"]);
export const postStatusEnum = pgEnum("post_status", ["scheduled", "publishing", "published", "failed", "draft"]);
export const renderStatusEnum = pgEnum("render_status", ["queued", "rendering", "done", "failed"]);
export const productStatusEnum = pgEnum("product_status", ["active", "archived"]);
export const dmModeEnum = pgEnum("dm_mode", ["manual", "semi", "auto"]);
export const dmStatusEnum = pgEnum("dm_status", ["queued", "sent", "failed", "blocked", "draft", "approved"]);
export const channelEnum = pgEnum("channel", ["comment_reply", "dm", "whatsapp", "inapp_chat"]);
export const creditsReasonEnum = pgEnum("credits_reason", [
  "video_render",
  "ai_words",
  "topup",
  "refund",
  "bonus",
]);

// ───────────────────────── AUTH / WORKSPACE ─────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"), // credentials login (NULL for OAuth-only users)
  authProvider: text("auth_provider").notNull().default("google"),
  timezone: text("timezone").default("Asia/Kolkata"),
  language: text("language").default("en"),
  onboardingDone: boolean("onboarding_done").notNull().default(false),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id),
  plan: planEnum("plan").notNull().default("free"),
  creditsBalance: integer("credits_balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("viewer"),
    status: text("status").notNull().default("pending"), // pending | active
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wm_ws_user_uq").on(t.workspaceId, t.userId)],
);

// ───────────────────────── CONNECTIONS (OAuth + BYOK) ─────────────────────────
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // instagram|tiktok|youtube|x|pinterest|facebook|linkedin|gemini_byok|amazon_pa|clickbank|digistore|shareasale|impact|cj|stripe
    accountId: text("account_id"),
    accountName: text("account_name"),
    accountAvatar: text("account_avatar"),
    accessTokenEnc: text("access_token_enc"), // AES-256 encrypted — never returned to client
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    apiKeyEnc: text("api_key_enc"), // BYOK: user ki apni Gemini/GCP key (optional)
    scopes: jsonb("scopes").$type<string[]>(),
    status: connectionStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conn_ws_provider_idx").on(t.workspaceId, t.provider)],
);

// ───────────────────────── BRAND / CHARACTER ─────────────────────────
export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  niche: text("niche").notNull(),
  audienceDesc: text("audience_desc"),
  tone: text("tone").default("friendly"),
  languages: jsonb("languages").$type<string[]>().default(["en"]),
  bannedWords: jsonb("banned_words").$type<string[]>().default([]),
  voiceSampleRef: text("voice_sample_ref"),
  clonedVoiceId: text("cloned_voice_id"),
  voiceCloneStatus: text("voice_clone_status").default("none"), // none|pending|completed|failed
  voiceCloneError: text("voice_clone_error"),
  voiceCloneCreatedAt: timestamp("voice_clone_created_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // = primary social handle
  aliases: jsonb("aliases").$type<string[]>().default([]), // other connected handles
  avatarKey: text("avatar_key"),
  bio: text("bio"),
  toneConfig: jsonb("tone_config").$type<Record<string, unknown>>().default({}),
  memory: jsonb("memory").$type<Record<string, unknown>>().default({}),
  discussSettings: jsonb("discuss_settings").$type<Record<string, unknown>>().default({
    comments: "semi",
    dm: "off",
  }),
  guardrails: jsonb("guardrails").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const thinkingJournal = pgTable(
  "thinking_journal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    thoughtText: text("thought_text").notNull(),
    reasoning: jsonb("reasoning").$type<Record<string, unknown>>().default({}),
    decision: text("decision"),
    confidence: integer("confidence"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tj_char_date_uq").on(t.characterId, t.date)],
);

// ───────────────────────── PRODUCTS & LINKS ─────────────────────────
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // amazon|clickbank|digistore|shareasale|impact|cj|custom
    sourceId: text("source_id"),
    title: text("title").notNull(),
    imageUrl: text("image_url"),
    price: numeric("price", { precision: 12, scale: 2 }),
    currency: text("currency").default("USD"),
    commissionType: text("commission_type"), // percentage|flat
    commissionValue: numeric("commission_value", { precision: 8, scale: 2 }),
    category: text("category"),
    rating: numeric("rating", { precision: 3, scale: 2 }),
    reviewCount: integer("review_count"),
    trendScore: numeric("trend_score", { precision: 8, scale: 2 }),
    aiScore: integer("ai_score"), // 0–100
    aiScoreBreakdown: jsonb("ai_score_breakdown").$type<Record<string, unknown>>(),
    status: productStatusEnum("status").notNull().default("active"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
  },
  (t) => [
    index("prod_ws_status_idx").on(t.workspaceId, t.status),
    uniqueIndex("prod_ws_source_id_uq").on(t.workspaceId, t.source, t.sourceId),
  ],
);

export const affiliateLinks = pgTable(
  "affiliate_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    rawUrl: text("raw_url").notNull(),
    deepLink: text("deep_link"),
    shortCode: text("short_code").notNull().unique(),
    utm: jsonb("utm").$type<Record<string, string>>().default({}),
    geoRules: jsonb("geo_rules").$type<Record<string, string>>().default({}),
    health: text("health").default("ok"), // ok|broken
    clicksTotal: integer("clicks_total").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("al_ws_product_idx").on(t.workspaceId, t.productId)],
);

// ───────────────────────── CONTENT & VIDEO ─────────────────────────
export const contents = pgTable(
  "contents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    type: text("type").notNull(), // caption|ad_copy|script|video|image|email
    platformTarget: text("platform_target"),
    variantNumber: integer("variant_number").default(1),
    body: jsonb("body").$type<Record<string, unknown>>().notNull(),
    language: text("language").default("en"),
    status: contentStatusEnum("status").notNull().default("draft"),
    aiModelUsed: text("ai_model_used"),
    costCredits: integer("cost_credits").default(0),
    complianceOk: boolean("compliance_ok").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("content_ws_status_idx").on(t.workspaceId, t.status)],
);

export const videos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title"),
    mode: text("mode").notNull(), // showcase|listicle|ugc|testimonial|comparison
    aspect: text("aspect").default("9:16"),
    provider: text("provider").default("platform_pool"), // platform_pool|byok
    renderStatus: renderStatusEnum("render_status").notNull().default("queued"),
    progressPct: integer("progress_pct").notNull().default(0), // 0–100 (render queue progress bar)
    failureReason: text("failure_reason"), // set when renderStatus = failed
    retryCount: integer("retry_count").notNull().default(0),
    storageKey: text("storage_key"),
    thumbnailKey: text("thumbnail_key"),
    durationSec: integer("duration_sec"),
    costUsd: numeric("cost_usd", { precision: 8, scale: 4 }),
    renderLog: jsonb("render_log").$type<Record<string, unknown>>(),
    /** Auto-post target picked at enqueue: instagram|youtube|null (off). */
    autoPostPlatform: text("auto_post_platform"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("vid_ws_status_idx").on(t.workspaceId, t.renderStatus)],
);

// ───────────────────────── VIDEO ENGINE (Phase 4) ─────────────────────────
// Clip cache: same product/prompt ke clips reuse ho — re-render cost na lage.
export const videoClips = pgTable(
  "video_clips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promptHash: text("prompt_hash").notNull().unique(), // sha256(provider|prompt|duration|aspect)
    provider: text("provider").notNull(), // veo|kling|pika|runway|mock
    prompt: text("prompt").notNull(),
    durationSec: integer("duration_sec").notNull().default(6),
    aspect: text("aspect").notNull().default("9:16"),
    storageKey: text("storage_key").notNull(),
    costUsd: numeric("cost_usd", { precision: 8, scale: 4 }).default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("vclip_provider_hash_idx").on(t.provider, t.promptHash)],
);

// Credits ledger: top-up packs, video render usage, refunds (plan.md §7).
export const creditsLedger = pgTable(
  "credits_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(), // +add / −consume
    reason: creditsReasonEnum("reason").notNull(), // video_render|ai_words|topup|refund|bonus
    refId: uuid("ref_id"), // e.g. videos.id when reason = video_render
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cl_ws_created_idx").on(t.workspaceId, t.createdAt)],
);

// ───────────────────────── POSTS ─────────────────────────
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contentId: uuid("content_id").references(() => contents.id, { onDelete: "set null" }),
    videoId: uuid("video_id").references(() => videos.id, { onDelete: "set null" }),
    connectionId: uuid("connection_id").references(() => connections.id, { onDelete: "set null" }),
    platform: text("platform").notNull(),
    platformPostId: text("platform_post_id"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    status: postStatusEnum("status").notNull().default("scheduled"),
    /** How the post was created: auto (after render) or manual (button). */
    mode: text("mode").notNull().default("manual"),
    /** true = simulated publish (no real platform call) — never labeled as live. */
    sandbox: boolean("sandbox").notNull().default(false),
    error: text("error"),
    retryCount: integer("retry_count").default(0),
    permalink: text("permalink"),
    firstCommentText: text("first_comment_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Status-change clock: enables atomic claims + stale 'publishing' recovery. */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("post_ws_status_idx").on(t.workspaceId, t.status)],
);

// ───────────────────────── ANALYTICS ─────────────────────────
export const clickEvents = pgTable(
  "click_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shortCode: text("short_code").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    ipHash: text("ip_hash"),
    geo: text("geo"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    postId: uuid("post_id"),
    productId: uuid("product_id"),
  },
  (t) => [index("click_code_idx").on(t.shortCode, t.ts)],
);

export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    platform: text("platform"),
    postId: uuid("post_id"),
    impressions: integer("impressions").default(0),
    likes: integer("likes").default(0),
    comments: integer("comments").default(0),
    shares: integer("shares").default(0),
    clicks: integer("clicks").default(0),
    conversions: integer("conversions").default(0),
    revenue: numeric("revenue", { precision: 12, scale: 2 }).default("0"),
  },
  (t) => [uniqueIndex("ad_ws_day_platform_post_uq").on(t.workspaceId, t.day, t.platform, t.postId)],
);

export const conversions = pgTable("conversions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  network: text("network").notNull(),
  productId: uuid("product_id"),
  orderId: text("order_id"),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  commission: numeric("commission", { precision: 12, scale: 2 }),
  currency: text("currency").default("USD"),
  status: text("status").default("pending"), // pending|approved|reversed
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
});

// ───────────────────────── DM ENGINE ─────────────────────────
export const commentStatusEnum = pgEnum("comment_status", [
  "pending",
  "approved",
  "replied",
  "dismissed",
]);
 
// Platform-specific trigger configs (TikTok, X, Facebook have different APIs)
export const triggerPlatformEnum = pgEnum("trigger_platform", [
  "instagram",
  "youtube",
  "tiktok",
  "facebook",
  "x",
  "whatsapp",
]);
 
export const triggerSourceEnum = pgEnum("trigger_source", [
  "comment",
  "dm",
  "mention",
  "hashtag",
  "story_reply",
]);
 
export const dmTriggers = pgTable("dm_triggers", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  postId: uuid("post_id"),
  platform: triggerPlatformEnum("platform").notNull().default("instagram"),
  source: triggerSourceEnum("source").notNull().default("comment"),
  keywords: jsonb("keywords").$type<{ set: string[]; semantic: boolean }>().default({
    set: ["link", "price", "buy", "dm"],
    semantic: true,
  }),
  replyTemplate: text("reply_template"),
  mode: dmModeEnum("mode").notNull().default("semi"),
  cooldownHours: integer("cooldown_hours").default(24),
  dailyCap: integer("daily_cap").default(100),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dmMessages = pgTable(
  "dm_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    characterId: uuid("character_id").references(() => characters.id, { onDelete: "set null" }),
    platform: text("platform").notNull(),
    channel: channelEnum("channel").notNull(),
    recipientHandle: text("recipient_handle").notNull(),
    triggerKeyword: text("trigger_keyword"),
    postId: uuid("post_id"),
    productId: uuid("product_id"),
    body: text("body").notNull(),
    uniqueLinkCode: text("unique_link_code"),
    status: dmStatusEnum("status").notNull().default("queued"),
    approvalMode: dmModeEnum("approval_mode").notNull().default("semi"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    clickAt: timestamp("click_at", { withTimezone: true }),
    conversionId: uuid("conversion_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("dm_ws_status_idx").on(t.workspaceId, t.status)],
);

// ───────────────────────── DM FUNNELS (auto-funnel sequences) ─────────────────────────
export const funnelStepTypeEnum = pgEnum("funnel_step_type", [
  "greet",
  "pitch",
  "link",
  "followup",
]);

export const dmFunnels = pgTable(
  "dm_funnels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(true),
    // Quiet hours (UTC) - no DMs sent during this window
    quietHoursStart: integer("quiet_hours_start").default(22), // 0-23 UTC
    quietHoursEnd: integer("quiet_hours_end").default(8), // 0-23 UTC
    // Sentiment skip - don't send to negative sentiment users
    skipNegativeSentiment: boolean("skip_negative_sentiment").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("df_ws_idx").on(t.workspaceId)],
);

export const dmFunnelSteps = pgTable(
  "dm_funnel_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    funnelId: uuid("funnel_id")
      .notNull()
      .references(() => dmFunnels.id, { onDelete: "cascade" }),
    stepType: funnelStepTypeEnum("step_type").notNull(),
    order: integer("order").notNull(),
    template: text("template").notNull(), // can use {{product}}, {{link}}, {{name}}
    delayHours: integer("delay_hours").notNull().default(0), // wait before this step
    conditions: jsonb("conditions").$type<Record<string, unknown>>().default({}), // e.g., { sentiment: "positive" }
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("dfs_funnel_idx").on(t.funnelId),
    uniqueIndex("dfs_funnel_order_uq").on(t.funnelId, t.order),
  ],
);

// Link triggers to funnels (a trigger can start a funnel instead of single reply)
export const dmTriggerFunnels = pgTable(
  "dm_trigger_funnels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    triggerId: uuid("trigger_id")
      .notNull()
      .references(() => dmTriggers.id, { onDelete: "cascade" }),
    funnelId: uuid("funnel_id")
      .notNull()
      .references(() => dmFunnels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("dtf_trigger_funnel_uq").on(t.triggerId, t.funnelId)],
);

// Conversation state per recipient in a funnel
export const dmConversations = pgTable(
  "dm_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    funnelId: uuid("funnel_id")
      .notNull()
      .references(() => dmFunnels.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    recipientHandle: text("recipient_handle").notNull(),
    currentStepIndex: integer("current_step_index").notNull().default(0),
    status: text("status").notNull().default("active"), // active | completed | paused | blocked
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    nextStepAt: timestamp("next_step_at", { withTimezone: true }),
    context: jsonb("context").$type<Record<string, unknown>>().default({}), // productId, postId, etc.
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("dc_ws_status_idx").on(t.workspaceId, t.status),
    index("dc_funnel_recipient_idx").on(t.funnelId, t.recipientHandle),
    uniqueIndex("dc_funnel_recipient_uq").on(t.funnelId, t.recipientHandle),
  ],
);

// Anti-spam: blocklist per workspace
export const dmBlocklist = pgTable(
  "dm_blocklist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(), // @handle or handle
    platform: text("platform"), // null = all platforms
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("dbl_ws_idx").on(t.workspaceId),
    uniqueIndex("dbl_ws_handle_platform_uq").on(t.workspaceId, t.handle, t.platform),
  ],
);

// Anti-spam: daily caps per platform per workspace (in addition to trigger dailyCap)
export const dmDailyCaps = pgTable(
  "dm_daily_caps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    day: date("day").notNull(),
    sentCount: integer("sent_count").notNull().default(0),
    limit: integer("limit").notNull().default(50),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ddc_ws_platform_day_uq").on(t.workspaceId, t.platform, t.day),
  ],
);
 
// WhatsApp Click-to-Chat link generator (for bio, posts, stories)
export const whatsappLinks = pgTable(
  "whatsapp_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "Main bio link", "Product X promo"
    phoneNumber: text("phone_number").notNull(), // full number with country code, e.g., "919876543210"
    defaultMessage: text("default_message"), // pre-filled message
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    clicks: integer("clicks").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wl_ws_idx").on(t.workspaceId)],
);
 
// WhatsApp webhook events (for Phase 6 bot integration)
export const whatsappWebhookEvents = pgTable(
  "whatsapp_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    whatsappLinkId: uuid("whatsapp_link_id").references(() => whatsappLinks.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(), // message|status|template
    fromNumber: text("from_number"),
    toNumber: text("to_number"),
    messageBody: text("message_body"),
    status: text("status"), // sent|delivered|read|failed
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull(),
    processed: boolean("processed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wwe_ws_idx").on(t.workspaceId)],
);
 
// ───────────────────────── COMMENTS (audience se discuss) ─────────────────────────
export const postComments = pgTable(
  "post_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    characterId: uuid("character_id").references(() => characters.id, {
      onDelete: "set null",
    }),
    platform: text("platform").notNull(), // instagram|youtube|tiktok|facebook|x
    authorHandle: text("author_handle").notNull(),
    body: text("body").notNull(),
    sentiment: text("sentiment"), // positive|neutral|negative
    suggestedReply: text("suggested_reply"),
    status: commentStatusEnum("status").notNull().default("pending"),
    approvalMode: dmModeEnum("approval_mode").notNull().default("semi"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("pc_ws_status_idx").on(t.workspaceId, t.status)],
);

// ───────────────────────── AUTOPILOT / OPS ─────────────────────────
export const autopilotConfig = pgTable("autopilot_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  level: autopilotLevelEnum("level").notNull().default("manual"),
  dailyPostLimits: jsonb("daily_post_limits").$type<Record<string, number>>().default({}),
  activePlatforms: jsonb("active_platforms").$type<string[]>().default([]),
  quietHours: jsonb("quiet_hours").$type<{ from: string; to: string }>().default({
    from: "22:00",
    to: "08:00",
  }),
  paused: boolean("paused").notNull().default(false),
  circuitBreakers: jsonb("circuit_breakers").$type<{
    maxErrorsPerHour: number;
    maxRetries: number;
    pauseOnRateLimit: boolean;
  }>().default({
    maxErrorsPerHour: 10,
    maxRetries: 3,
    pauseOnRateLimit: true,
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobsAudit = pgTable(
  "jobs_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id"),
    jobType: text("job_type").notNull(), // research|script|video|publish|analytics|optimizer|report
    status: text("status").notNull(), // running|success|failed
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    input: jsonb("input"),
    output: jsonb("output"),
    error: text("error"),
    costUsd: numeric("cost_usd", { precision: 8, scale: 4 }),
  },
  (t) => [index("job_type_status_idx").on(t.jobType, t.status)],
);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // stripe|razorpay
  providerSubId: text("provider_sub_id"),
  plan: planEnum("plan").notNull().default("free"),
  status: text("status").default("active"), // active|past_due|canceled
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  meteredUsage: jsonb("metered_usage").$type<Record<string, number>>().default({}),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notif_ws_read_idx").on(t.workspaceId, t.readAt)],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    emailPrefs: jsonb("email_prefs").$type<{
      dailyReport: boolean;
      weeklyReport: boolean;
      autopilotErrors: boolean;
      billingAlerts: boolean;
      newFeatures: boolean;
    }>().default({
      dailyReport: true,
      weeklyReport: true,
      autopilotErrors: true,
      billingAlerts: true,
      newFeatures: false,
    }),
    inAppPrefs: jsonb("in_app_prefs").$type<{
      autopilotStatus: boolean;
      dmReplies: boolean;
      conversionAlerts: boolean;
    }>().default({
      autopilotStatus: true,
      dmReplies: true,
      conversionAlerts: true,
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);
 
// ───────────────────────── TREND MINER (Module E) ─────────────────────────
export const trendingHashtags = pgTable(
  "trending_hashtags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(), // instagram|youtube|tiktok|facebook|x
    hashtag: text("hashtag").notNull(),
    volume: integer("volume").notNull(), // posts using this hashtag
    velocity: numeric("velocity", { precision: 10, scale: 2 }), // growth rate %
    niche: text("niche"), // fitness|beauty|tech|etc.
    source: text("source").notNull(), // api|scrape|manual
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("th_ws_platform_idx").on(t.workspaceId, t.platform),
    uniqueIndex("th_ws_platform_hashtag_idx").on(t.workspaceId, t.platform, t.hashtag),
  ],
);
 
export const trendingAudio = pgTable(
  "trending_audio",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(), // instagram|tiktok|youtube
    audioId: text("audio_id").notNull(), // platform's audio ID
    title: text("title"),
    artist: text("artist"),
    usageCount: integer("usage_count").notNull(),
    velocity: numeric("velocity", { precision: 10, scale: 2 }),
    durationSec: integer("duration_sec"),
    source: text("source").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ta_ws_platform_idx").on(t.workspaceId, t.platform),
    uniqueIndex("ta_ws_platform_audio_idx").on(t.workspaceId, t.platform, t.audioId),
  ],
);
 
export const viralPosts = pgTable(
  "viral_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    platformPostId: text("platform_post_id").notNull(),
    authorHandle: text("author_handle").notNull(),
    caption: text("caption"),
    hashtags: jsonb("hashtags").$type<string[]>().default([]),
    audioId: text("audio_id"),
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    engagementRate: numeric("engagement_rate", { precision: 8, scale: 4 }),
    affiliateLinks: jsonb("affiliate_links").$type<string[]>().default([]),
    niche: text("niche"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("vp_ws_platform_idx").on(t.workspaceId, t.platform),
    uniqueIndex("vp_ws_platform_post_idx").on(t.workspaceId, t.platform, t.platformPostId),
  ],
);
 
export const trendRemixSuggestions = pgTable(
  "trend_remix_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    viralPostId: uuid("viral_post_id").references(() => viralPosts.id, { onDelete: "set null" }),
    trendingHashtagId: uuid("trending_hashtag_id").references(() => trendingHashtags.id, { onDelete: "set null" }),
    trendingAudioId: uuid("trending_audio_id").references(() => trendingAudio.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    suggestedFormat: text("suggested_format").notNull(), // remix|reaction|tutorial|showcase
    hookIdea: text("hook_idea").notNull(),
    scriptOutline: text("script_outline"),
    confidence: integer("confidence").notNull().default(50), // 0-100
    status: text("status").notNull().default("pending"), // pending|approved|rejected|created
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("trs_ws_status_idx").on(t.workspaceId, t.status)],
);
 
// ───────────────────────── PHASE 6: INTELLIGENCE (Auto-Optimizer + A/B Testing) ─────────────────────────
export const abTests = pgTable(
  "ab_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"), // draft|running|completed|paused
    testType: text("test_type").notNull(), // hook|format|timing|cta
    variants: jsonb("variants").$type<{ id: string; name: string; config: Record<string, unknown> }[]>().notNull(),
    trafficSplit: jsonb("traffic_split").$type<Record<string, number>>().notNull(), // variant_id -> percentage
    metric: text("metric").notNull(), // ctr|conversions|revenue|engagement
    minSampleSize: integer("min_sample_size").default(100),
    confidenceLevel: numeric("confidence_level", { precision: 3, scale: 2 }).default("95"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    winnerVariantId: text("winner_variant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("abt_ws_status_idx").on(t.workspaceId, t.status)],
);
 
export const abTestResults = pgTable(
  "ab_test_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    abTestId: uuid("ab_test_id")
      .notNull()
      .references(() => abTests.id, { onDelete: "cascade" }),
    variantId: text("variant_id").notNull(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    revenue: numeric("revenue", { precision: 12, scale: 2 }).default("0"),
    engagement: numeric("engagement", { precision: 8, scale: 4 }).default("0"),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("abtr_test_idx").on(t.abTestId)],
);
 
export const optimizerState = pgTable(
  "optimizer_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    mode: text("mode").notNull().default("conservative"), // conservative|balanced|aggressive
    minCtrThreshold: numeric("min_ctr_threshold", { precision: 5, scale: 4 }).default("0.005"), // 0.5%
    minConversionRate: numeric("min_conversion_rate", { precision: 5, scale: 4 }).default("0.001"), // 0.1%
    boostThreshold: numeric("boost_threshold", { precision: 5, scale: 4 }).default("0.02"), // 2% above average
    pauseThreshold: numeric("pause_threshold", { precision: 5, scale: 4 }).default("0.001"), // 0.1% below average
    lookbackDays: integer("lookback_days").default(7),
    minPostsForDecision: integer("min_posts_for_decision").default(5),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastDecision: jsonb("last_decision").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("opt_ws_idx").on(t.workspaceId)],
);
 
export const postPerformance = pgTable(
  "post_performance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    videoId: uuid("video_id").references(() => videos.id, { onDelete: "set null" }),
    platform: text("platform").notNull(),
    format: text("format"), // reel|short|post|story
    hook: text("hook"),
    cta: text("cta"),
    postingTime: timestamp("posting_time", { withTimezone: true }),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    revenue: numeric("revenue", { precision: 12, scale: 2 }).default("0"),
    engagementRate: numeric("engagement_rate", { precision: 8, scale: 4 }),
    ctr: numeric("ctr", { precision: 8, scale: 4 }),
    conversionRate: numeric("conversion_rate", { precision: 8, scale: 4 }),
    roi: numeric("roi", { precision: 8, scale: 4 }),
    abTestId: uuid("ab_test_id").references(() => abTests.id, { onDelete: "set null" }),
    variantId: text("variant_id"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pp_ws_platform_idx").on(t.workspaceId, t.platform),
    index("pp_post_idx").on(t.postId),
    index("pp_abtest_idx").on(t.abTestId),
  ],
);
 
export const optimizerDecisions = pgTable(
  "optimizer_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    decisionType: text("decision_type").notNull(), // boost|pause|remix|ab_test
    targetId: uuid("target_id").notNull(), // post_id or video_id
    targetType: text("target_type").notNull(), // post|video
    reason: text("reason").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(), // 0-100
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    executed: boolean("executed").notNull().default(false),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    result: jsonb("result").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("od_ws_idx").on(t.workspaceId)],
);
 
export const copilotConversations = pgTable(
  "copilot_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title"),
    context: jsonb("context").$type<Record<string, unknown>>().default({}), // workspace snapshot
    status: text("status").notNull().default("active"), // active|archived
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cc_ws_idx").on(t.workspaceId)],
);
 
export const copilotMessages = pgTable(
  "copilot_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => copilotConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user|assistant|system|tool
    content: text("content").notNull(),
    toolCalls: jsonb("tool_calls").$type<ToolCall[]>(),
    toolResults: jsonb("tool_results").$type<ToolResult[]>(),
    actions: jsonb("actions").$type<{ type: string; payload: Record<string, unknown> }[]>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cm_conv_idx").on(t.conversationId)],
);

// ───────────────────────── PHASE 6 Module B: Analytics & Reports (pgvector + AI Reports) ─────────────────────────
export const performanceEmbeddings = pgTable(
  "performance_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    contentId: uuid("content_id"),
    contentText: text("content_text").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pe_workspace_idx").on(t.workspaceId),
    index("pe_content_type_idx").on(t.contentType),
    index("pe_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const aiReports = pgTable(
  "ai_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    reportType: text("report_type").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    insights: text("insights").notNull(),
    recommendations: text("recommendations").notNull(),
    metricsSnapshot: jsonb("metrics_snapshot").$type<Record<string, unknown>>().default({}),
    generatedBy: text("generated_by").default("llm"),
    model: text("model"),
    status: text("status").default("generated").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ar_workspace_idx").on(t.workspaceId),
    index("ar_type_period_idx").on(t.reportType, t.periodStart, t.periodEnd),
    index("ar_created_idx").on(t.createdAt),
  ],
);

export const abTestWinners = pgTable(
  "ab_test_winners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    abTestId: uuid("ab_test_id")
      .notNull()
      .references(() => abTests.id, { onDelete: "cascade" }),
    winnerVariantId: text("winner_variant_id").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
    pValue: numeric("p_value", { precision: 10, scale: 8 }),
    lift: numeric("lift", { precision: 10, scale: 4 }),
    sampleSize: integer("sample_size").notNull(),
    decision: text("decision").notNull(),
    metrics: jsonb("metrics").$type<Record<string, unknown>>().default({}),
    autoApplied: boolean("auto_applied").default(false).notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("abtw_test_idx").on(t.abTestId)],
);

export const reportSchedules = pgTable(
  "report_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    reportType: text("report_type").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    sendTime: text("send_time").default("09:00"),
    timezone: text("timezone").default("UTC"),
    recipients: jsonb("recipients").$type<string[]>().default([]),
    format: text("format").default("html"),
    includeAiInsights: boolean("include_ai_insights").default(true).notNull(),
    lastGeneratedAt: timestamp("last_generated_at", { withTimezone: true }),
    nextGenerationAt: timestamp("next_generation_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rs_workspace_idx").on(t.workspaceId),
    index("rs_next_gen_idx").on(t.nextGenerationAt),
  ],
);
