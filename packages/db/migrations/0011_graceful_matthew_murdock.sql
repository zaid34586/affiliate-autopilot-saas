CREATE TYPE "public"."trigger_platform" AS ENUM('instagram', 'youtube', 'tiktok', 'facebook', 'x', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."trigger_source" AS ENUM('comment', 'dm', 'mention', 'hashtag', 'story_reply');--> statement-breakpoint
CREATE TABLE "whatsapp_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone_number" text NOT NULL,
	"default_message" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dm_triggers" ADD COLUMN "platform" "trigger_platform" DEFAULT 'instagram' NOT NULL;--> statement-breakpoint
ALTER TABLE "dm_triggers" ADD COLUMN "source" "trigger_source" DEFAULT 'comment' NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_links" ADD CONSTRAINT "whatsapp_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wl_ws_idx" ON "whatsapp_links" USING btree ("workspace_id");