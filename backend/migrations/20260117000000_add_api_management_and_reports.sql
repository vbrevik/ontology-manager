-- API Keys for external access
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    hash TEXT NOT NULL, -- Store hashed key (argon2 or similar, but for now maybe just sha256 for speed/simplicity in MVP)
    scopes TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active', -- active, revoked
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Webhook endpoints
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active', -- active, inactive, failing
    secret TEXT NOT NULL, -- Signing secret to sign payloads
    failure_count INT NOT NULL DEFAULT 0,
    last_delivery_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generated Reports metadata
CREATE TABLE IF NOT EXISTS generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    report_type TEXT NOT NULL, -- ACCESS_AUDIT, USER_ACTIVITY, SYSTEM_HEALTH
    status TEXT NOT NULL DEFAULT 'PROCESSING', -- PROCESSING, COMPLETED, FAILED
    file_url TEXT, -- URL to download
    size_bytes BIGINT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);
