-- Two-Factor Authentication (MFA) Support
-- TOTP-based 2FA with backup codes

CREATE TABLE IF NOT EXISTS user_mfa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- TOTP Secret (base32 encoded)
    secret_key TEXT NOT NULL,
    
    -- Status
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE, -- User has verified setup with a code
    
    -- Backup codes (8 single-use codes, stored as hashes)
    backup_codes TEXT[] NOT NULL DEFAULT '{}',
    backup_codes_remaining INT NOT NULL DEFAULT 0,
    
    -- Audit
    enabled_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_mfa_user_id ON user_mfa(user_id);

-- Helper function to check MFA status (for use in auth flow)
CREATE OR REPLACE FUNCTION is_mfa_required(p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT COALESCE(
        (SELECT is_enabled AND is_verified FROM user_mfa WHERE user_id = p_user_id),
        FALSE
    );
$$ LANGUAGE SQL STABLE;
