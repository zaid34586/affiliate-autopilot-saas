ALTER TABLE "posts" ADD COLUMN "mode" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "sandbox" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "auto_post_platform" text;