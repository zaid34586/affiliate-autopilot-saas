ALTER TABLE "copilot_messages" ADD COLUMN "tool_calls" jsonb;--> statement-breakpoint
ALTER TABLE "copilot_messages" ADD COLUMN "tool_results" jsonb;--> statement-breakpoint
ALTER TABLE "copilot_messages" ADD COLUMN "at" timestamp with time zone DEFAULT now() NOT NULL;