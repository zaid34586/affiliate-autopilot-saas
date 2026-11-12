CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email_prefs" jsonb DEFAULT '{"dailyReport":true,"weeklyReport":true,"autopilotErrors":true,"billingAlerts":true,"newFeatures":false}'::jsonb,
	"in_app_prefs" jsonb DEFAULT '{"autopilotStatus":true,"dmReplies":true,"conversionAlerts":true}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;