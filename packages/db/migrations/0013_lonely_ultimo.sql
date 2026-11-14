CREATE TABLE "trend_remix_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"viral_post_id" uuid,
	"trending_hashtag_id" uuid,
	"trending_audio_id" uuid,
	"product_id" uuid,
	"suggested_format" text NOT NULL,
	"hook_idea" text NOT NULL,
	"script_outline" text,
	"confidence" integer DEFAULT 50 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trending_audio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"audio_id" text NOT NULL,
	"title" text,
	"artist" text,
	"usage_count" integer NOT NULL,
	"velocity" numeric(10, 2),
	"duration_sec" integer,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trending_hashtags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"hashtag" text NOT NULL,
	"volume" integer NOT NULL,
	"velocity" numeric(10, 2),
	"niche" text,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "viral_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"platform_post_id" text NOT NULL,
	"author_handle" text NOT NULL,
	"caption" text,
	"hashtags" jsonb DEFAULT '[]'::jsonb,
	"audio_id" text,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"engagement_rate" numeric(8, 4),
	"affiliate_links" jsonb DEFAULT '[]'::jsonb,
	"niche" text,
	"posted_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trend_remix_suggestions" ADD CONSTRAINT "trend_remix_suggestions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_remix_suggestions" ADD CONSTRAINT "trend_remix_suggestions_viral_post_id_viral_posts_id_fk" FOREIGN KEY ("viral_post_id") REFERENCES "public"."viral_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_remix_suggestions" ADD CONSTRAINT "trend_remix_suggestions_trending_hashtag_id_trending_hashtags_id_fk" FOREIGN KEY ("trending_hashtag_id") REFERENCES "public"."trending_hashtags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_remix_suggestions" ADD CONSTRAINT "trend_remix_suggestions_trending_audio_id_trending_audio_id_fk" FOREIGN KEY ("trending_audio_id") REFERENCES "public"."trending_audio"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_remix_suggestions" ADD CONSTRAINT "trend_remix_suggestions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trending_audio" ADD CONSTRAINT "trending_audio_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trending_hashtags" ADD CONSTRAINT "trending_hashtags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viral_posts" ADD CONSTRAINT "viral_posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trs_ws_status_idx" ON "trend_remix_suggestions" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "ta_ws_platform_idx" ON "trending_audio" USING btree ("workspace_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "ta_ws_platform_audio_idx" ON "trending_audio" USING btree ("workspace_id","platform","audio_id");--> statement-breakpoint
CREATE INDEX "th_ws_platform_idx" ON "trending_hashtags" USING btree ("workspace_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "th_ws_platform_hashtag_idx" ON "trending_hashtags" USING btree ("workspace_id","platform","hashtag");--> statement-breakpoint
CREATE INDEX "vp_ws_platform_idx" ON "viral_posts" USING btree ("workspace_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "vp_ws_platform_post_idx" ON "viral_posts" USING btree ("workspace_id","platform","platform_post_id");