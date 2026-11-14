CREATE TABLE "whatsapp_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"whatsapp_link_id" uuid,
	"event_type" text NOT NULL,
	"from_number" text,
	"to_number" text,
	"message_body" text,
	"status" text,
	"raw_payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dm_funnels" ADD COLUMN "quiet_hours_start" integer DEFAULT 22;--> statement-breakpoint
ALTER TABLE "dm_funnels" ADD COLUMN "quiet_hours_end" integer DEFAULT 8;--> statement-breakpoint
ALTER TABLE "dm_funnels" ADD COLUMN "skip_negative_sentiment" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_webhook_events" ADD CONSTRAINT "whatsapp_webhook_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_webhook_events" ADD CONSTRAINT "whatsapp_webhook_events_whatsapp_link_id_whatsapp_links_id_fk" FOREIGN KEY ("whatsapp_link_id") REFERENCES "public"."whatsapp_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wwe_ws_idx" ON "whatsapp_webhook_events" USING btree ("workspace_id");