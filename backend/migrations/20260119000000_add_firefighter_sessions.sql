-- Migration to add firefighter mode (break-glass access)

CREATE TABLE IF NOT EXISTS firefighter_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    elevated_role_id UUID NOT NULL REFERENCES entities(id),
    justification TEXT NOT NULL,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    deactivated_at TIMESTAMPTZ,
    deactivated_by UUID REFERENCES users(id),
    deactivation_reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    
    CONSTRAINT valid_expiry CHECK (expires_at > activated_at)
);

CREATE INDEX IF NOT EXISTS idx_firefighter_sessions_user ON firefighter_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_firefighter_sessions_active ON firefighter_sessions(user_id, expires_at) 
    WHERE deactivated_at IS NULL;
