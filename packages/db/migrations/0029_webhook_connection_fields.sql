-- Phase 2: Webhook fields for connections table
-- Migration 0029 (after 0028_oauth_connections_unique.sql)

-- Add webhook-related columns
ALTER TABLE connections
ADD COLUMN IF NOT EXISTS phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS meta_verify_token TEXT;

-- Index for WhatsApp phone number lookup
CREATE INDEX IF NOT EXISTS conn_phone_number_idx ON connections(phone_number_id);

-- Comment for documentation
COMMENT ON COLUMN connections.phone_number_id IS 'WhatsApp Business phone number ID for webhook routing';
COMMENT ON COLUMN connections.meta_verify_token IS 'Per-connection verify token for Meta (Instagram/WhatsApp) webhooks';