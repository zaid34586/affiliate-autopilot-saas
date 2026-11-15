-- Phase 7: Status Page (integration health monitoring)

-- ───────────────────────── INTEGRATION HEALTH ─────────────────────────
CREATE TABLE IF NOT EXISTS integration_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL UNIQUE,          -- instagram, tiktok, youtube, veo, stripe, razorpay, openai, gemini, ...
    display_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'integration', -- integration|ai|payment|platform
    status TEXT NOT NULL DEFAULT 'operational',   -- operational|degraded|down|maintenance|unknown
    uptime_30d NUMERIC(5,2) NOT NULL DEFAULT 100.00, -- %
    avg_latency_ms INTEGER,
    last_checked_at TIMESTAMPTZ,
    last_incident_at TIMESTAMPTZ,
    incident_message TEXT,
    -- Rolling counters for uptime calc
    checks_30d INTEGER NOT NULL DEFAULT 0,
    ok_30d INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_health_status ON integration_health(status);

-- ───────────────────────── STATUS CHECKS (history) ─────────────────────────
CREATE TABLE IF NOT EXISTS status_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    ok BOOLEAN NOT NULL,
    latency_ms INTEGER,
    status_code INTEGER,
    message TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_checks_provider_time ON status_checks(provider, checked_at);

-- ───────────────────────── INCIDENTS ─────────────────────────
CREATE TABLE IF NOT EXISTS status_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'minor',        -- minor|major|critical
    status TEXT NOT NULL DEFAULT 'investigating',  -- investigating|identified|monitoring|resolved
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    updates JSONB NOT NULL DEFAULT '[]',           -- [{at, status, message}]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_incidents_status ON status_incidents(status);
CREATE INDEX IF NOT EXISTS idx_status_incidents_started ON status_incidents(started_at);

-- ───────────────────────── SYSTEM-WIDE STATUS PAGE SNAPSHOT ─────────────────────────
-- Optional: public overall status cache
INSERT INTO integration_health (provider, display_name, category, status) VALUES
    ('instagram', 'Instagram API', 'integration', 'operational'),
    ('tiktok', 'TikTok API', 'integration', 'operational'),
    ('youtube', 'YouTube API', 'integration', 'operational'),
    ('veo', 'Google Veo (Video)', 'ai', 'operational'),
    ('openai', 'OpenAI (GPT)', 'ai', 'operational'),
    ('gemini', 'Google Gemini', 'ai', 'operational'),
    ('stripe', 'Stripe Payments', 'payment', 'operational'),
    ('razorpay', 'Razorpay Payments', 'payment', 'operational')
ON CONFLICT (provider) DO NOTHING;
