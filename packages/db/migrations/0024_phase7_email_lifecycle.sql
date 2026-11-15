-- Phase 7: Email Lifecycle (welcome, activation, trial ending, winback)

-- ───────────────────────── EMAIL LOG ─────────────────────────
CREATE TABLE IF NOT EXISTS email_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    template TEXT NOT NULL,                    -- welcome|activation_nudge|trial_ending|winback|payment_failed
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',     -- queued|sent|failed|skipped
    provider_message_id TEXT,
    error TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_user ON email_log(user_id, template);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log(created_at);

-- ───────────────────────── UNSUBSCRIBES ─────────────────────────
CREATE TABLE IF NOT EXISTS email_unsubscribes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template TEXT,                              -- NULL = all lifecycle emails
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, template)
);

CREATE INDEX IF NOT EXISTS idx_email_unsub_user ON email_unsubscribes(user_id);
