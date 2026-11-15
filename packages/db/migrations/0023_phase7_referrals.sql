-- Phase 7: Referral Program (20% recurring commission / credit bonus)

-- ───────────────────────── REFERRALS ─────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,                 -- referral code (short, shareable)
    referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referrer_workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clicks INTEGER NOT NULL DEFAULT 0,
    signups INTEGER NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,     -- referred users who paid
    total_earned_cents INTEGER NOT NULL DEFAULT 0,
    UNIQUE (referrer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(code);
CREATE INDEX IF NOT EXISTS idx_referrals_user ON referrals(referrer_user_id);

-- Referred users attribution
CREATE TABLE IF NOT EXISTS referral_attributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    referred_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signed_up_at TIMESTAMPTZ,
    first_paid_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'clicked',     -- clicked|signed_up|paid
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_attr_referral ON referral_attributions(referral_id);
CREATE INDEX IF NOT EXISTS idx_ref_attr_referred ON referral_attributions(referred_user_id);

-- ───────────────────────── COMMISSION PAYOUTS ─────────────────────────
-- 20% recurring commission on each payment by referred customer,
-- credited as workspace credits (or cash payout when configured).
CREATE TABLE IF NOT EXISTS referral_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    referred_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    amount_cents INTEGER NOT NULL,              -- 20% of payment
    source_payment_cents INTEGER NOT NULL,      -- original payment
    kind TEXT NOT NULL DEFAULT 'recurring',     -- recurring|credit_bonus|first_payment
    status TEXT NOT NULL DEFAULT 'pending',     -- pending|credited|paid_out
    period_start DATE,
    period_end DATE,
    credited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (referral_id, source_payment_cents, period_end) -- idempotent per billing period
);

CREATE INDEX IF NOT EXISTS idx_ref_comm_referral ON referral_commissions(referral_id);
CREATE INDEX IF NOT EXISTS idx_ref_comm_status ON referral_commissions(status);

-- ───────────────────────── REFERRAL SETTINGS ─────────────────────────
CREATE TABLE IF NOT EXISTS referral_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    commission_pct INTEGER NOT NULL DEFAULT 20,          -- percent recurring
    credit_bonus_cents INTEGER NOT NULL DEFAULT 1000,    -- $10 bonus for referrer on first conversion
    referred_credit_cents INTEGER NOT NULL DEFAULT 500,  -- $5 bonus for referred user
    min_payout_cents INTEGER NOT NULL DEFAULT 5000,      -- $50 min payout
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO referral_settings (enabled, commission_pct, credit_bonus_cents, referred_credit_cents, min_payout_cents)
VALUES (TRUE, 20, 1000, 500, 5000)
ON CONFLICT DO NOTHING;
