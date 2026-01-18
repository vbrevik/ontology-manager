-- Add rate limit configuration tables
CREATE TABLE IF NOT EXISTS rate_limit_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    endpoint_pattern VARCHAR(255) NOT NULL,
    max_requests INTEGER NOT NULL,
    window_seconds INTEGER NOT NULL,
    strategy VARCHAR(50) NOT NULL CHECK(strategy IN ('IP', 'User', 'Global')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on endpoint_pattern for faster lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_rules_pattern ON rate_limit_rules(endpoint_pattern);
CREATE INDEX IF NOT EXISTS idx_rate_limit_rules_enabled ON rate_limit_rules(enabled);

-- Seed default rate limit rules for CVE-004
INSERT INTO rate_limit_rules (name, endpoint_pattern, max_requests, window_seconds, strategy, enabled) VALUES
    -- Auth endpoints with specific limits (CVE-004)
    ('auth-login', '/api/auth/login', 5, 900, 'IP', TRUE),           -- 5 attempts per 15 minutes per IP
    ('auth-mfa-challenge', '/api/auth/mfa/challenge', 10, 300, 'IP', TRUE), -- 10 attempts per 5 minutes per IP
    ('auth-forgot-password', '/api/auth/forgot-password', 3, 3600, 'IP', TRUE), -- 3 requests per hour per IP
    ('auth-register', '/api/auth/register', 3, 3600, 'IP', TRUE),    -- 3 registrations per hour per IP

    -- General auth endpoints
    ('auth-general', '/api/auth/*', 60, 60, 'User', TRUE),

    -- API endpoints
    ('api-read', '/api/*/GET', 100, 60, 'User', TRUE),
    ('api-write', '/api/*/POST|PUT|DELETE', 30, 60, 'User', TRUE),
    ('admin', '/api/admin/*', 50, 60, 'User', TRUE);

-- Create rate limit bypass tokens table
CREATE TABLE IF NOT EXISTS rate_limit_bypass_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_by UUID,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_bypass_tokens_token ON rate_limit_bypass_tokens(token);

-- Generate initial bypass token for testing
INSERT INTO rate_limit_bypass_tokens (token, description) VALUES
    ('test-bypass-token-12345', 'Automated test bypass token - DO NOT DELETE');
