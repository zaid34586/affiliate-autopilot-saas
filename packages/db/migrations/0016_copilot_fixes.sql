-- Phase 6 Module C — Copilot & Optimizer DB Fixes
-- Fix posts status enum to include 'draft'
-- Add missing columns to copilot_messages
-- Fix posts workspace_id handling

-- Add 'draft' to post_status enum
ALTER TYPE post_status ADD VALUE IF NOT EXISTS 'draft';

-- Add missing columns to copilot_messages
ALTER TABLE copilot_messages 
ADD COLUMN IF NOT EXISTS at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS tool_calls JSONB,
ADD COLUMN IF NOT EXISTS tool_results JSONB;

-- Create index on copilot_messages for faster lookups
CREATE INDEX IF NOT EXISTS cm_conversation_at_idx ON copilot_messages(conversation_id, created_at DESC);