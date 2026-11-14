CREATE TYPE "public"."comment_status" AS ENUM('pending', 'approved', 'replied', 'dismissed');--> statement-breakpoint
CREATE TABLE "post_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"post_id" uuid,
	"character_id" uuid,
	"platform" text NOT NULL,
	"author_handle" text NOT NULL,
	"body" text NOT NULL,
	"sentiment" text,
	"suggested_reply" text,
	"status" "comment_status" DEFAULT 'pending' NOT NULL,
	"approval_mode" "dm_mode" DEFAULT 'semi' NOT NULL,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pc_ws_status_idx" ON "post_comments" USING btree ("workspace_id","status");