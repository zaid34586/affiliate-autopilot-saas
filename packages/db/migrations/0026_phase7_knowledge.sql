-- Phase 7: Knowledge Base (user PDFs/docs/URLs -> AI uses them)

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL,                -- pdf|docx|text|markdown|url
    source_url TEXT,                          -- set when source_type = url
    content TEXT NOT NULL DEFAULT '',         -- extracted plain text
    status TEXT NOT NULL DEFAULT 'ready',     -- processing|ready|failed
    error TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    char_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_docs_ws ON knowledge_documents(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_docs_status ON knowledge_documents(status);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON knowledge_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_ws ON knowledge_chunks(workspace_id);
