-- Phase 2: comment idempotency for DM messages
-- Migration 0030 (after 0029_webhook_connection_fields.sql)

-- Source platform comment id (Instagram comment id / YouTube comment id).
-- Used to dedupe Meta/YouTube webhook retries: one comment -> one DM row.
ALTER TABLE dm_messages
ADD COLUMN IF NOT EXISTS source_comment_id TEXT;

-- NULLs are distinct in Postgres unique indexes, so rows without a source
-- comment id (manual sends, WhatsApp, etc.) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS dm_ws_platform_comment_uq
  ON dm_messages(workspace_id, platform, source_comment_id);

COMMENT ON COLUMN dm_messages.source_comment_id IS 'Platform comment id that produced this DM (webhook idempotency key)';
