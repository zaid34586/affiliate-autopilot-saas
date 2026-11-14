CREATE TYPE "public"."funnel_step_type" AS ENUM('greet', 'pitch', 'link', 'followup');--> statement-breakpoint
CREATE TABLE "dm_blocklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"handle" text NOT NULL,
	"platform" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"funnel_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"recipient_handle" text NOT NULL,
	"current_step_index" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_sent_at" timestamp with time zone,
	"next_step_at" timestamp with time zone,
	"context" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_daily_caps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"day" date NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"limit" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_funnel_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"funnel_id" uuid NOT NULL,
	"step_type" "funnel_step_type" NOT NULL,
	"order" integer NOT NULL,
	"template" text NOT NULL,
	"delay_hours" integer DEFAULT 0 NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_funnels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_trigger_funnels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger_id" uuid NOT NULL,
	"funnel_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dm_blocklist" ADD CONSTRAINT "dm_blocklist_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_conversations" ADD CONSTRAINT "dm_conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_conversations" ADD CONSTRAINT "dm_conversations_funnel_id_dm_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."dm_funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_daily_caps" ADD CONSTRAINT "dm_daily_caps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_funnel_steps" ADD CONSTRAINT "dm_funnel_steps_funnel_id_dm_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."dm_funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_funnels" ADD CONSTRAINT "dm_funnels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_trigger_funnels" ADD CONSTRAINT "dm_trigger_funnels_trigger_id_dm_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."dm_triggers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_trigger_funnels" ADD CONSTRAINT "dm_trigger_funnels_funnel_id_dm_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."dm_funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dbl_ws_idx" ON "dm_blocklist" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dbl_ws_handle_platform_uq" ON "dm_blocklist" USING btree ("workspace_id","handle","platform");--> statement-breakpoint
CREATE INDEX "dc_ws_status_idx" ON "dm_conversations" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "dc_funnel_recipient_idx" ON "dm_conversations" USING btree ("funnel_id","recipient_handle");--> statement-breakpoint
CREATE UNIQUE INDEX "dc_funnel_recipient_uq" ON "dm_conversations" USING btree ("funnel_id","recipient_handle");--> statement-breakpoint
CREATE UNIQUE INDEX "ddc_ws_platform_day_uq" ON "dm_daily_caps" USING btree ("workspace_id","platform","day");--> statement-breakpoint
CREATE INDEX "dfs_funnel_idx" ON "dm_funnel_steps" USING btree ("funnel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dfs_funnel_order_uq" ON "dm_funnel_steps" USING btree ("funnel_id","order");--> statement-breakpoint
CREATE INDEX "df_ws_idx" ON "dm_funnels" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dtf_trigger_funnel_uq" ON "dm_trigger_funnels" USING btree ("trigger_id","funnel_id");