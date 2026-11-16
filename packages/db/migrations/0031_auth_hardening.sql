-- Phase 4 — Auth/RBAC hardening
--
-- 1) users: email verification + account status + session token version.
-- 2) workspace_members: owner memberships were inserted with the column
--    default ('pending') — owners must always be 'active'.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 1;

-- Existing users predate the verification flow: treat them as verified so
-- enabling REQUIRE_EMAIL_VERIFICATION later does not lock out the user base.
UPDATE users
SET email_verified = true,
    email_verified_at = COALESCE(email_verified_at, created_at)
WHERE email_verified = false;

-- Owners are always active in their own workspace.
UPDATE workspace_members wm
SET status = 'active'
FROM workspaces w
WHERE wm.workspace_id = w.id
  AND wm.user_id = w.owner_user_id
  AND wm.status <> 'active';
