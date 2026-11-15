-- Phase 8: Add missing columns for Admin Panel

-- Subscriptions: add billing/revenue tracking columns
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS amount_cents INTEGER,
ADD COLUMN IF NOT EXISTS interval TEXT DEFAULT 'month',
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Connections: add tracking columns
ALTER TABLE connections
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Feature flags: add workspace_overrides column
ALTER TABLE feature_flags
ADD COLUMN IF NOT EXISTS workspace_overrides JSONB DEFAULT '{}';

-- Videos: the schema uses render_status and mode, not status/type
-- These already exist: render_status, mode

-- Audit log: check table name
-- The table is called audit_log (singular) based on imports