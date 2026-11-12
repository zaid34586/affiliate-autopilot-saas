ALTER TYPE "public"."dm_status" ADD VALUE 'draft';--> statement-breakpoint
ALTER TYPE "public"."dm_status" ADD VALUE 'approved';--> statement-breakpoint
ALTER TABLE "dm_messages" ADD COLUMN "approval_mode" "dm_mode" DEFAULT 'semi' NOT NULL;