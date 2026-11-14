-- Phase 7: Audit Log + Feature Flags

-- ───────────────────────── AUDIT LOG ─────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_type TEXT NOT NULL DEFAULT 'user', -- user|ai|system
    actor_id TEXT, -- user ID, AI agent name, system component
    action TEXT NOT NULL, -- e.g., "post.created", "dm.sent", "campaign.launched"
    resource_type TEXT, -- e.g., "post", "campaign", "dm_message", "video"
    resource_id TEXT, -- ID of the affected resource
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}', -- IP, user agent, request ID, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ───────────────────────── FEATURE FLAGS ─────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE, -- e.g., "new_video_editor", "ai_copilot_v2"
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    rollout_percentage INTEGER NOT NULL DEFAULT 0, -- 0-100
    targeting JSONB DEFAULT '{}', -- { userIds: [], workspaceIds: [], roles: [] }
    variants JSONB DEFAULT '[]', -- [{ key: "control", weight: 50 }, { key: "variant_a", weight: 50 }]
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);

-- Feature flag evaluations (for analytics)
CREATE TABLE IF NOT EXISTS feature_flag_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key TEXT NOT NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    variant TEXT NOT NULL, -- "control" | "variant_a" | etc.
    matched BOOLEAN NOT NULL DEFAULT TRUE, -- false = fallback to control
    context JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ffe_flag ON feature_flag_evaluations(flag_key);
CREATE INDEX IF NOT EXISTS idx_ffe_workspace ON feature_flag_evaluations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ffe_created ON feature_flag_evaluations(created_at DESC);