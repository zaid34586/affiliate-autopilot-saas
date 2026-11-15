-- Phase 7: Product Analytics (funnels, feature usage, retention, churn, MRR/AI cost)

-- ───────────────────────── PRODUCT EVENTS ─────────────────────────
-- Raw event stream for funnels + feature usage.
-- Canonical funnel events: signup, activation, trial_started, subscribed, churned
CREATE TABLE IF NOT EXISTS product_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event TEXT NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_events_ws_event ON product_events(workspace_id, event);
CREATE INDEX IF NOT EXISTS idx_product_events_ts ON product_events(ts);
CREATE INDEX IF NOT EXISTS idx_product_events_user ON product_events(user_id);

-- ───────────────────────── DAILY MRR / FINANCIAL SNAPSHOT ─────────────────────────
CREATE TABLE IF NOT EXISTS mrr_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day DATE NOT NULL UNIQUE,
    mrr_cents INTEGER NOT NULL DEFAULT 0,
    arr_cents BIGINT NOT NULL DEFAULT 0,
    paid_workspaces INTEGER NOT NULL DEFAULT 0,
    trial_workspaces INTEGER NOT NULL DEFAULT 0,
    new_paid INTEGER NOT NULL DEFAULT 0,
    churned_paid INTEGER NOT NULL DEFAULT 0,
    free_workspaces INTEGER NOT NULL DEFAULT 0,
    ai_cost_usd NUMERIC(12,4) NOT NULL DEFAULT 0,     -- total AI spend that day
    arpu_cents INTEGER NOT NULL DEFAULT 0,            -- MRR / paid workspaces
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_day ON mrr_snapshots(day);

-- ───────────────────────── FEATURE USAGE (daily rollup) ─────────────────────────
CREATE TABLE IF NOT EXISTS feature_usage_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day DATE NOT NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,                            -- video_render, dm_funnel, autopilot, ...
    usage_count INTEGER NOT NULL DEFAULT 0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (day, workspace_id, feature)
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_day ON feature_usage_daily(day);
CREATE INDEX IF NOT EXISTS idx_feature_usage_feature ON feature_usage_daily(feature, day);

-- ───────────────────────── CHURN SIGNALS ─────────────────────────
CREATE TABLE IF NOT EXISTS churn_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    signal TEXT NOT NULL,                             -- inactive_7d, inactive_14d, low_usage, plan_downgrade, payment_failed, trial_expired
    severity TEXT NOT NULL DEFAULT 'low',             -- low|medium|high
    score INTEGER NOT NULL DEFAULT 0,                 -- 0-100 churn risk
    details JSONB NOT NULL DEFAULT '{}',
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    UNIQUE (workspace_id, signal)
);

CREATE INDEX IF NOT EXISTS idx_churn_signals_ws ON churn_signals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_churn_signals_sev ON churn_signals(severity);
