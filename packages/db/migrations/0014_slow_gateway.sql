CREATE TABLE "ab_test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ab_test_id" uuid NOT NULL,
	"variant_id" text NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(12, 2) DEFAULT '0',
	"engagement" numeric(8, 4) DEFAULT '0',
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ab_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"test_type" text NOT NULL,
	"variants" jsonb NOT NULL,
	"traffic_split" jsonb NOT NULL,
	"metric" text NOT NULL,
	"min_sample_size" integer DEFAULT 100,
	"confidence_level" numeric(3, 2) DEFAULT '95',
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"winner_variant_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"title" text,
	"context" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"actions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "optimizer_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"decision_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"reason" text NOT NULL,
	"confidence" numeric(5, 2) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"executed" boolean DEFAULT false NOT NULL,
	"executed_at" timestamp with time zone,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "optimizer_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"mode" text DEFAULT 'conservative' NOT NULL,
	"min_ctr_threshold" numeric(5, 4) DEFAULT '0.005',
	"min_conversion_rate" numeric(5, 4) DEFAULT '0.001',
	"boost_threshold" numeric(5, 4) DEFAULT '0.02',
	"pause_threshold" numeric(5, 4) DEFAULT '0.001',
	"lookback_days" integer DEFAULT 7,
	"min_posts_for_decision" integer DEFAULT 5,
	"last_run_at" timestamp with time zone,
	"last_decision" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "optimizer_state_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "post_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"post_id" uuid,
	"video_id" uuid,
	"platform" text NOT NULL,
	"format" text,
	"hook" text,
	"cta" text,
	"posting_time" timestamp with time zone,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(12, 2) DEFAULT '0',
	"engagement_rate" numeric(8, 4),
	"ctr" numeric(8, 4),
	"conversion_rate" numeric(8, 4),
	"roi" numeric(8, 4),
	"ab_test_id" uuid,
	"variant_id" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ab_test_results" ADD CONSTRAINT "ab_test_results_ab_test_id_ab_tests_id_fk" FOREIGN KEY ("ab_test_id") REFERENCES "public"."ab_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_tests" ADD CONSTRAINT "ab_tests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_conversations" ADD CONSTRAINT "copilot_conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_conversations" ADD CONSTRAINT "copilot_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_conversation_id_copilot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."copilot_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimizer_decisions" ADD CONSTRAINT "optimizer_decisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimizer_state" ADD CONSTRAINT "optimizer_state_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_performance" ADD CONSTRAINT "post_performance_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_performance" ADD CONSTRAINT "post_performance_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_performance" ADD CONSTRAINT "post_performance_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_performance" ADD CONSTRAINT "post_performance_ab_test_id_ab_tests_id_fk" FOREIGN KEY ("ab_test_id") REFERENCES "public"."ab_tests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abtr_test_idx" ON "ab_test_results" USING btree ("ab_test_id");--> statement-breakpoint
CREATE INDEX "abt_ws_status_idx" ON "ab_tests" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "cc_ws_idx" ON "copilot_conversations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "cm_conv_idx" ON "copilot_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "od_ws_idx" ON "optimizer_decisions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "opt_ws_idx" ON "optimizer_state" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "pp_ws_platform_idx" ON "post_performance" USING btree ("workspace_id","platform");--> statement-breakpoint
CREATE INDEX "pp_post_idx" ON "post_performance" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "pp_abtest_idx" ON "post_performance" USING btree ("ab_test_id");