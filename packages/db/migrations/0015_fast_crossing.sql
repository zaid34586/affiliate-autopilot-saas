-- Phase 6 Module B — Performance Memory (pgvector) + AI Reports
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Performance memory embeddings for "is niche mein kya kaam karta hai"
CREATE TABLE "performance_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
	"content_type" text NOT NULL, -- 'post' | 'video' | 'hook' | 'cta' | 'niche_summary'
	"content_id" uuid, -- reference to post/video/product
	"content_text" text NOT NULL, -- the text content to embed
	"embedding" vector(1536) NOT NULL, -- OpenAI embedding dimension
	"metadata" jsonb DEFAULT '{}'::jsonb, -- niche, platform, format, performance metrics
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "pe_workspace_idx" ON "performance_embeddings" USING btree ("workspace_id");
CREATE INDEX "pe_content_type_idx" ON "performance_embeddings" USING btree ("content_type");
CREATE INDEX "pe_embedding_idx" ON "performance_embeddings" USING hnsw ("embedding" vector_cosine_ops);

-- AI Reports storage
CREATE TABLE "ai_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
	"report_type" text NOT NULL, -- 'daily' | 'weekly' | 'monthly'
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL, -- What happened
	"insights" text NOT NULL, -- Why / Analysis
	"recommendations" text NOT NULL, -- What next
	"metrics_snapshot" jsonb DEFAULT '{}'::jsonb, -- key metrics for the period
	"generated_by" text DEFAULT 'llm', -- 'llm' | 'template'
	"model" text, -- e.g., 'gpt-4o', 'gpt-4o-mini'
	"status" text DEFAULT 'generated' NOT NULL, -- 'generating' | 'generated' | 'failed'
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "ar_workspace_idx" ON "ai_reports" USING btree ("workspace_id");
CREATE INDEX "ar_type_period_idx" ON "ai_reports" USING btree ("report_type", "period_start", "period_end");
CREATE INDEX "ar_created_idx" ON "ai_reports" USING btree ("created_at");

-- A/B Test Engine: Auto-winner selection and management
CREATE TABLE "ab_test_winners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ab_test_id" uuid NOT NULL REFERENCES "ab_tests"("id") ON DELETE cascade,
	"winner_variant_id" text NOT NULL,
	"confidence" numeric(5, 2) NOT NULL, -- 0-100
	"p_value" numeric(10, 8), -- statistical significance
	"lift" numeric(10, 4), -- percentage improvement
	"sample_size" integer NOT NULL,
	"decision" text NOT NULL, -- 'winner' | 'inconclusive' | 'no_winner'
	"metrics" jsonb DEFAULT '{}'::jsonb, -- detailed metrics per variant
	"auto_applied" boolean DEFAULT false NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "abtw_test_idx" ON "ab_test_winners" USING btree ("ab_test_id");

-- Report subscriptions / scheduling
CREATE TABLE "report_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
	"report_type" text NOT NULL, -- 'daily' | 'weekly' | 'monthly'
	"enabled" boolean DEFAULT true NOT NULL,
	"send_time" text DEFAULT '09:00', -- HH:MM in workspace timezone
	"timezone" text DEFAULT 'UTC',
	"recipients" jsonb DEFAULT '[]'::jsonb, -- array of user IDs or emails
	"format" text DEFAULT 'html', -- 'html' | 'pdf' | 'markdown'
	"include_ai_insights" boolean DEFAULT true NOT NULL,
	"last_generated_at" timestamp with time zone,
	"next_generation_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "rs_workspace_idx" ON "report_schedules" USING btree ("workspace_id");
CREATE INDEX "rs_next_gen_idx" ON "report_schedules" USING btree ("next_generation_at");