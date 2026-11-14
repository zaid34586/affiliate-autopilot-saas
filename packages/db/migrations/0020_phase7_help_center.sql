-- Phase 7: Help Center + Documentation + Changelog

-- ───────────────────────── HELP CENTER ARTICLES ─────────────────────────
CREATE TABLE IF NOT EXISTS help_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL = global article
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content_md TEXT NOT NULL, -- Markdown content
    content_html TEXT, -- Rendered HTML (cached)
    category TEXT NOT NULL, -- getting_started, billing, video, dm_engine, troubleshooting, api, guides
    tags TEXT[] DEFAULT '{}',
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    helpful_count INTEGER NOT NULL DEFAULT 0,
    not_helpful_count INTEGER NOT NULL DEFAULT 0,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    seo_title TEXT,
    seo_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_help_articles_workspace ON help_articles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_help_articles_category ON help_articles(category);
CREATE INDEX IF NOT EXISTS idx_help_articles_published ON help_articles(is_published, published_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_help_articles_slug_workspace ON help_articles(slug, workspace_id);

-- Article feedback
CREATE TABLE IF NOT EXISTS help_article_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES help_articles(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_helpful BOOLEAN NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_feedback_article ON help_article_feedback(article_id);

-- ───────────────────────── CHANGELOG ─────────────────────────
CREATE TABLE IF NOT EXISTS changelog_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL, -- e.g., "v1.2.0"
    title TEXT NOT NULL,
    description TEXT,
    release_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    categories JSONB DEFAULT '[]', -- ["feature", "fix", "improvement", "breaking", "security"]
    items JSONB NOT NULL DEFAULT '[]', -- [{"type": "feature", "title": "...", "description": "..."}]
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changelog_published ON changelog_entries(is_published, release_date);

-- ───────────────────────── IN-APP ANNOUNCEMENTS ─────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL = global
    title TEXT NOT NULL,
    body_md TEXT NOT NULL,
    body_html TEXT,
    type TEXT NOT NULL DEFAULT 'info', -- info, warning, success, maintenance, feature
    priority INTEGER NOT NULL DEFAULT 0, -- Higher = shown first
    target_roles TEXT[] DEFAULT '{}', -- Empty = all roles
    target_workspaces UUID[] DEFAULT '{}', -- Empty = all workspaces
    start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_at TIMESTAMPTZ,
    is_dismissible BOOLEAN NOT NULL DEFAULT TRUE,
    cta_text TEXT,
    cta_url TEXT,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_workspace ON announcements(workspace_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_published, start_at, end_at);

-- Announcement dismissals
CREATE TABLE IF NOT EXISTS announcement_dismissals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (announcement_id, workspace_id, user_id)
);

-- ───────────────────────── SUPPORT TICKETS ─────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description_md TEXT NOT NULL,
    category TEXT NOT NULL, -- technical, billing, feature_request, bug_report, general
    priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
    status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, waiting_customer, resolved, closed
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    satisfaction_rating INTEGER, -- 1-5
    satisfaction_feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_workspace ON support_tickets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON support_tickets(priority);

-- Ticket messages
CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL = system message
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    body_md TEXT NOT NULL,
    body_html TEXT,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE, -- Internal notes only visible to staff
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);