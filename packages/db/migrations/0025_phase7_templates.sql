-- Phase 7: Templates Library (niche-wise content templates)

CREATE TABLE IF NOT EXISTS content_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,                -- stable key, e.g. "fitness-reel-hooks-1" (builtins) / "ws:<uuid>:<n>" (custom)
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,  -- NULL = builtin (all workspaces)
    niche TEXT NOT NULL,                     -- fitness|beauty|tech|finance|home|food|fashion|travel|saas|generic
    format TEXT NOT NULL,                    -- reel_script|hook|caption|dm_sequence|carousel|email
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    body TEXT NOT NULL,                      -- may contain {{variables}}
    variables JSONB NOT NULL DEFAULT '[]',   -- ["product","benefit",...]
    tags JSONB NOT NULL DEFAULT '[]',
    builtin BOOLEAN NOT NULL DEFAULT FALSE,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_templates_niche ON content_templates(niche, format);
CREATE INDEX IF NOT EXISTS idx_content_templates_ws ON content_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_builtin ON content_templates(builtin, usage_count DESC);
