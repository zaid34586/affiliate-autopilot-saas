CREATE TABLE "ab_test_winners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ab_test_id" uuid NOT NULL,
	"winner_variant_id" text NOT NULL,
	"confidence" numeric(5, 2) NOT NULL,
	"p_value" numeric(10, 8),
	"lift" numeric(10, 4),
	"sample_size" integer NOT NULL,
	"decision" text NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb,
	"auto_applied" boolean DEFAULT false NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"report_type" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"insights" text NOT NULL,
	"recommendations" text NOT NULL,
	"metrics_snapshot" jsonb DEFAULT '{}'::jsonb,
	"generated_by" text DEFAULT 'llm',
	"model" text,
	"status" text DEFAULT 'generated' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"content_id" uuid,
	"content_text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"report_type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"send_time" text DEFAULT '09:00',
	"timezone" text DEFAULT 'UTC',
	"recipients" jsonb DEFAULT '[]'::jsonb,
	"format" text DEFAULT 'html',
	"include_ai_insights" boolean DEFAULT true NOT NULL,
	"last_generated_at" timestamp with time zone,
	"next_generation_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ab_test_winners" ADD CONSTRAINT "ab_test_winners_ab_test_id_ab_tests_id_fk" FOREIGN KEY ("ab_test_id") REFERENCES "public"."ab_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_embeddings" ADD CONSTRAINT "performance_embeddings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abtw_test_idx" ON "ab_test_winners" USING btree ("ab_test_id");--> statement-breakpoint
CREATE INDEX "ar_workspace_idx" ON "ai_reports" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ar_type_period_idx" ON "ai_reports" USING btree ("report_type","period_start","period_end");--> statement-breakpoint
CREATE INDEX "ar_created_idx" ON "ai_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pe_workspace_idx" ON "performance_embeddings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "pe_content_type_idx" ON "performance_embeddings" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "pe_embedding_idx" ON "performance_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "rs_workspace_idx" ON "report_schedules" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "rs_next_gen_idx" ON "report_schedules" USING btree ("next_generation_at");