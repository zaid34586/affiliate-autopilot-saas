CREATE TYPE "public"."autopilot_level" AS ENUM('manual', 'semi', 'full', 'fire_and_forget');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('comment_reply', 'dm', 'whatsapp', 'inapp_chat');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'approved', 'scheduled', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."dm_mode" AS ENUM('manual', 'semi', 'auto');--> statement-breakpoint
CREATE TYPE "public"."dm_status" AS ENUM('queued', 'sent', 'failed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'starter', 'pro', 'agency');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('scheduled', 'publishing', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."render_status" AS ENUM('queued', 'rendering', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'admin', 'editor', 'analyst', 'viewer');--> statement-breakpoint
CREATE TABLE "affiliate_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"raw_url" text NOT NULL,
	"deep_link" text,
	"short_code" text NOT NULL,
	"utm" jsonb DEFAULT '{}'::jsonb,
	"geo_rules" jsonb DEFAULT '{}'::jsonb,
	"health" text DEFAULT 'ok',
	"clicks_total" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_links_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "analytics_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"day" date NOT NULL,
	"platform" text,
	"post_id" uuid,
	"impressions" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"conversions" integer DEFAULT 0,
	"revenue" numeric(12, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "autopilot_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"level" "autopilot_level" DEFAULT 'manual' NOT NULL,
	"daily_post_limits" jsonb DEFAULT '{}'::jsonb,
	"active_platforms" jsonb DEFAULT '[]'::jsonb,
	"quiet_hours" jsonb DEFAULT '{"from":"22:00","to":"08:00"}'::jsonb,
	"paused" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "autopilot_config_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "brand_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"niche" text NOT NULL,
	"audience_desc" text,
	"tone" text DEFAULT 'friendly',
	"languages" jsonb DEFAULT '["en"]'::jsonb,
	"banned_words" jsonb DEFAULT '[]'::jsonb,
	"voice_sample_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_profiles_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb,
	"avatar_key" text,
	"bio" text,
	"tone_config" jsonb DEFAULT '{}'::jsonb,
	"memory" jsonb DEFAULT '{}'::jsonb,
	"discuss_settings" jsonb DEFAULT '{"comments":"semi","dm":"off"}'::jsonb,
	"guardrails" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "characters_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "click_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"short_code" text NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text,
	"geo" text,
	"user_agent" text,
	"referrer" text,
	"post_id" uuid,
	"product_id" uuid
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"account_id" text,
	"account_name" text,
	"account_avatar" text,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"api_key_enc" text,
	"scopes" jsonb,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid,
	"type" text NOT NULL,
	"platform_target" text,
	"variant_number" integer DEFAULT 1,
	"body" jsonb NOT NULL,
	"language" text DEFAULT 'en',
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"ai_model_used" text,
	"cost_credits" integer DEFAULT 0,
	"compliance_ok" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"network" text NOT NULL,
	"product_id" uuid,
	"order_id" text,
	"amount" numeric(12, 2),
	"commission" numeric(12, 2),
	"currency" text DEFAULT 'USD',
	"status" text DEFAULT 'pending',
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"character_id" uuid,
	"platform" text NOT NULL,
	"channel" "channel" NOT NULL,
	"recipient_handle" text NOT NULL,
	"trigger_keyword" text,
	"post_id" uuid,
	"product_id" uuid,
	"body" text NOT NULL,
	"unique_link_code" text,
	"status" "dm_status" DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp with time zone,
	"click_at" timestamp with time zone,
	"conversion_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"post_id" uuid,
	"keywords" jsonb DEFAULT '{"set":["link","price","buy","dm"],"semantic":true}'::jsonb,
	"reply_template" text,
	"mode" "dm_mode" DEFAULT 'semi' NOT NULL,
	"cooldown_hours" integer DEFAULT 24,
	"daily_cap" integer DEFAULT 100,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"job_type" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"cost_usd" numeric(8, 4)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_id" uuid,
	"video_id" uuid,
	"connection_id" uuid,
	"platform" text NOT NULL,
	"platform_post_id" text,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"status" "post_status" DEFAULT 'scheduled' NOT NULL,
	"error" text,
	"retry_count" integer DEFAULT 0,
	"permalink" text,
	"first_comment_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"title" text NOT NULL,
	"image_url" text,
	"price" numeric(12, 2),
	"currency" text DEFAULT 'USD',
	"commission_type" text,
	"commission_value" numeric(8, 2),
	"category" text,
	"rating" numeric(3, 2),
	"review_count" integer,
	"trend_score" numeric(8, 2),
	"ai_score" integer,
	"ai_score_breakdown" jsonb,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_analyzed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_sub_id" text,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active',
	"current_period_end" timestamp with time zone,
	"metered_usage" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "subscriptions_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "thinking_journal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"date" date NOT NULL,
	"thought_text" text NOT NULL,
	"reasoning" jsonb DEFAULT '{}'::jsonb,
	"decision" text,
	"confidence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"auth_provider" text DEFAULT 'google' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata',
	"language" text DEFAULT 'en',
	"onboarding_done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"aspect" text DEFAULT '9:16',
	"provider" text DEFAULT 'platform_pool',
	"render_status" "render_status" DEFAULT 'queued' NOT NULL,
	"storage_key" text,
	"thumbnail_key" text,
	"duration_sec" integer,
	"cost_usd" numeric(8, 4),
	"render_log" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role" DEFAULT 'viewer' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"credits_balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_config" ADD CONSTRAINT "autopilot_config_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_triggers" ADD CONSTRAINT "dm_triggers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thinking_journal" ADD CONSTRAINT "thinking_journal_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "al_ws_product_idx" ON "affiliate_links" USING btree ("workspace_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_ws_day_platform_post_uq" ON "analytics_daily" USING btree ("workspace_id","day","platform","post_id");--> statement-breakpoint
CREATE INDEX "click_code_idx" ON "click_events" USING btree ("short_code","ts");--> statement-breakpoint
CREATE INDEX "conn_ws_provider_idx" ON "connections" USING btree ("workspace_id","provider");--> statement-breakpoint
CREATE INDEX "content_ws_status_idx" ON "contents" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "dm_ws_status_idx" ON "dm_messages" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "job_type_status_idx" ON "jobs_audit" USING btree ("job_type","status");--> statement-breakpoint
CREATE INDEX "notif_ws_read_idx" ON "notifications" USING btree ("workspace_id","read_at");--> statement-breakpoint
CREATE INDEX "post_ws_status_idx" ON "posts" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "prod_ws_status_idx" ON "products" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "prod_ws_source_id_uq" ON "products" USING btree ("workspace_id","source","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tj_char_date_uq" ON "thinking_journal" USING btree ("character_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "wm_ws_user_uq" ON "workspace_members" USING btree ("workspace_id","user_id");