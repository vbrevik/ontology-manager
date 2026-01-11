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

-- Seed default rate limit rules
INSERT INTO rate_limit_rules (name, endpoint_pattern, max_requests, window_seconds, strategy, enabled) VALUES
    ('Auth - Login/Register', '/api/auth/(login|register)', 5, 900, 'IP', TRUE),
    ('Auth - General', '/api/auth/*', 60, 60, 'User', TRUE),
    ('API - Read Operations', '/api/*/GET', 100, 60, 'User', TRUE),
    ('API - Write Operations', '/api/*/POST|PUT|DELETE', 30, 60, 'User', TRUE),
    ('Admin Endpoints', '/api/admin/*', 50, 60, 'User', TRUE);

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
    (md5(random()::text), 'Initial test bypass token');
