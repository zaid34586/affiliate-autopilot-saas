-- Phase 6: Voice Clone - Add cloned voice ID to brand profiles
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS cloned_voice_id TEXT;
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS voice_clone_status TEXT DEFAULT 'none'; -- none|pending|completed|failed
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS voice_clone_error TEXT;
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS voice_clone_created_at TIMESTAMPTZ;