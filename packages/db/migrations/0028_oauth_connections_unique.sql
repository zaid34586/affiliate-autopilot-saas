-- Phase 1: OAuth connections - unique constraint and deduplication
-- Migration 0028 (next after 0027_phase8_admin_schema.sql)

-- First, de-duplicate existing connections: keep the newest per workspace+provider
WITH ranked AS (
  SELECT id,
         workspace_id,
         provider,
         ROW_NUMBER() OVER (PARTITION BY workspace_id, provider ORDER BY created_at DESC) as rn
  FROM connections
)
DELETE FROM connections
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- Create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS conn_ws_provider_uq ON connections(workspace_id, provider);

-- Drop the old non-unique index
DROP INDEX IF EXISTS conn_ws_provider_idx;

-- Keep the workspace index
CREATE INDEX IF NOT EXISTS conn_ws_idx ON connections(workspace_id);