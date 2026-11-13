CREATE TYPE "public"."credits_reason" AS ENUM('video_render', 'ai_words', 'topup', 'refund', 'bonus');--> statement-breakpoint
CREATE TABLE "credits_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" "credits_reason" NOT NULL,
	"ref_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_hash" text NOT NULL,
	"provider" text NOT NULL,
	"prompt" text NOT NULL,
	"duration_sec" integer DEFAULT 6 NOT NULL,
	"aspect" text DEFAULT '9:16' NOT NULL,
	"storage_key" text NOT NULL,
	"cost_usd" numeric(8, 4) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_clips_prompt_hash_unique" UNIQUE("prompt_hash")
);
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "progress_pct" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credits_ledger" ADD CONSTRAINT "credits_ledger_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cl_ws_created_idx" ON "credits_ledger" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "vclip_provider_hash_idx" ON "video_clips" USING btree ("provider","prompt_hash");--> statement-breakpoint
CREATE INDEX "vid_ws_status_idx" ON "videos" USING btree ("workspace_id","render_status");