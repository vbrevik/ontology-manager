-- ================================================================
-- RATE LIMITING ONTOLOGY: Classes for CVE-004 Rate Limiting
-- Created: 2026-01-20
-- Purpose: Add RateLimitRule and BypassToken classes for rate limiting
-- CVE-004: Prevent brute force attacks on authentication endpoints
-- ================================================================

DO $$
DECLARE
    v_version_id UUID;
    v_rate_limit_rule_class_id UUID;
    v_bypass_token_class_id UUID;
    v_rate_limit_attempt_class_id UUID;
BEGIN
    -- ================================================================
    -- PHASE 1: Get System Version
    -- ================================================================
    
    SELECT id INTO v_version_id FROM ontology_versions WHERE is_system = TRUE LIMIT 1;
    
    IF v_version_id IS NULL THEN
        -- Fallback to current version if no system version
        SELECT id INTO v_version_id FROM ontology_versions WHERE is_current = TRUE LIMIT 1;
    END IF;
    
    IF v_version_id IS NULL THEN
        RAISE EXCEPTION 'No ontology version found';
    END IF;
    
    -- ================================================================
    -- PHASE 2: Create RateLimitRule Class
    -- ================================================================
    
    -- RateLimitRule Class
    -- Defines rate limiting policies for API endpoints
    INSERT INTO classes (id, name, description, is_abstract, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000001',
        'RateLimitRule',
        'Rate limiting rule to protect endpoints from abuse',
        FALSE,
        v_version_id
    ) ON CONFLICT (id) DO NOTHING;
    
    SELECT id INTO v_rate_limit_rule_class_id FROM classes WHERE name = 'RateLimitRule';
    
    -- ================================================================
    -- PHASE 3: Define Properties for RateLimitRule
    -- ================================================================
    
    INSERT INTO properties (class_id, name, data_type, is_required, description, version_id)
    VALUES
        (v_rate_limit_rule_class_id, 'name', 'string', TRUE, 'Human-readable rule name', v_version_id),
        (v_rate_limit_rule_class_id, 'endpoint_pattern', 'string', TRUE, 'Endpoint pattern to match (e.g., /api/auth/login)', v_version_id),
        (v_rate_limit_rule_class_id, 'max_requests', 'integer', TRUE, 'Maximum requests allowed in window', v_version_id),
        (v_rate_limit_rule_class_id, 'window_seconds', 'integer', TRUE, 'Time window in seconds', v_version_id),
        (v_rate_limit_rule_class_id, 'strategy', 'string', TRUE, 'Limiting strategy: IP, User, or Global', v_version_id),
        (v_rate_limit_rule_class_id, 'enabled', 'boolean', TRUE, 'Whether rule is active', v_version_id),
        (v_rate_limit_rule_class_id, 'description', 'text', FALSE, 'Detailed description of rule purpose', v_version_id),
        (v_rate_limit_rule_class_id, 'created_at', 'datetime', FALSE, 'Rule creation timestamp', v_version_id),
        (v_rate_limit_rule_class_id, 'updated_at', 'datetime', FALSE, 'Rule last update timestamp', v_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;
    
    -- ================================================================
    -- PHASE 4: Create BypassToken Class
    -- ================================================================
    
    -- BypassToken Class
    -- Tokens that bypass rate limiting (for testing, monitoring, etc.)
    INSERT INTO classes (id, name, description, is_abstract, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000002',
        'BypassToken',
        'Token that bypasses rate limiting for authorized use',
        FALSE,
        v_version_id
    ) ON CONFLICT (id) DO NOTHING;
    
    SELECT id INTO v_bypass_token_class_id FROM classes WHERE name = 'BypassToken';
    
    -- ================================================================
    -- PHASE 5: Define Properties for BypassToken
    -- ================================================================
    
    INSERT INTO properties (class_id, name, data_type, is_required, is_sensitive, description, version_id)
    VALUES
        (v_bypass_token_class_id, 'token', 'string', TRUE, TRUE, 'Secret bypass token', v_version_id),
        (v_bypass_token_class_id, 'description', 'text', FALSE, FALSE, 'Purpose of this bypass token', v_version_id),
        (v_bypass_token_class_id, 'created_by', 'uuid', FALSE, FALSE, 'User who created the token', v_version_id),
        (v_bypass_token_class_id, 'expires_at', 'datetime', FALSE, FALSE, 'Token expiration timestamp', v_version_id),
        (v_bypass_token_class_id, 'created_at', 'datetime', FALSE, FALSE, 'Token creation timestamp', v_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;
    
    -- ================================================================
    -- PHASE 6: Create RateLimitAttempt Class (for logging)
    -- ================================================================
    
    -- RateLimitAttempt Class
    -- Logs rate limit checks and violations
    INSERT INTO classes (id, name, description, is_abstract, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000003',
        'RateLimitAttempt',
        'Log of rate limit check or violation',
        FALSE,
        v_version_id
    ) ON CONFLICT (id) DO NOTHING;
    
    SELECT id INTO v_rate_limit_attempt_class_id FROM classes WHERE name = 'RateLimitAttempt';
    
    -- ================================================================
    -- PHASE 7: Define Properties for RateLimitAttempt
    -- ================================================================
    
    INSERT INTO properties (class_id, name, data_type, is_required, description, version_id)
    VALUES
        (v_rate_limit_attempt_class_id, 'rule_id', 'string', TRUE, 'ID of the rate limit rule', v_version_id),
        (v_rate_limit_attempt_class_id, 'identifier', 'string', TRUE, 'IP address or user ID', v_version_id),
        (v_rate_limit_attempt_class_id, 'endpoint', 'string', FALSE, 'Endpoint that was accessed', v_version_id),
        (v_rate_limit_attempt_class_id, 'blocked', 'boolean', TRUE, 'Whether request was blocked', v_version_id),
        (v_rate_limit_attempt_class_id, 'timestamp', 'datetime', TRUE, 'When the attempt occurred', v_version_id),
        (v_rate_limit_attempt_class_id, 'metadata', 'json', FALSE, 'Additional context', v_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;
    
    -- ================================================================
    -- PHASE 8: Seed CVE-004 Rate Limit Rules
    -- ================================================================
    
    -- Login: 5 attempts per 15 minutes
    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000011'::uuid,
        v_rate_limit_rule_class_id,
        'Login Rate Limit',
        jsonb_build_object(
            'name', 'auth-login',
            'endpoint_pattern', '/api/auth/login',
            'max_requests', 5,
            'window_seconds', 900, -- 15 minutes
            'strategy', 'IP',
            'enabled', true,
            'description', 'CVE-004: Limit login attempts to prevent brute force attacks',
            'created_at', NOW(),
            'updated_at', NOW()
        ),
        'APPROVED'::approval_status
    ) ON CONFLICT (id) DO UPDATE 
    SET attributes = EXCLUDED.attributes,
        updated_at = NOW();
    
    -- MFA Challenge: 10 attempts per 5 minutes
    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000012'::uuid,
        v_rate_limit_rule_class_id,
        'MFA Challenge Rate Limit',
        jsonb_build_object(
            'name', 'auth-mfa-challenge',
            'endpoint_pattern', '/api/auth/mfa/challenge',
            'max_requests', 10,
            'window_seconds', 300, -- 5 minutes
            'strategy', 'IP',
            'enabled', true,
            'description', 'CVE-004: Limit MFA attempts to prevent brute force of TOTP codes',
            'created_at', NOW(),
            'updated_at', NOW()
        ),
        'APPROVED'::approval_status
    ) ON CONFLICT (id) DO UPDATE 
    SET attributes = EXCLUDED.attributes,
        updated_at = NOW();
    
    -- Password Reset: 3 requests per hour
    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000013'::uuid,
        v_rate_limit_rule_class_id,
        'Password Reset Rate Limit',
        jsonb_build_object(
            'name', 'auth-forgot-password',
            'endpoint_pattern', '/api/auth/forgot-password',
            'max_requests', 3,
            'window_seconds', 3600, -- 1 hour
            'strategy', 'IP',
            'enabled', true,
            'description', 'CVE-004: Limit password reset requests to prevent abuse',
            'created_at', NOW(),
            'updated_at', NOW()
        ),
        'APPROVED'::approval_status
    ) ON CONFLICT (id) DO UPDATE 
    SET attributes = EXCLUDED.attributes,
        updated_at = NOW();
    
    -- Registration: 3 accounts per hour
    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000014'::uuid,
        v_rate_limit_rule_class_id,
        'Registration Rate Limit',
        jsonb_build_object(
            'name', 'auth-register',
            'endpoint_pattern', '/api/auth/register',
            'max_requests', 3,
            'window_seconds', 3600, -- 1 hour
            'strategy', 'IP',
            'enabled', true,
            'description', 'CVE-004: Limit account creation to prevent abuse',
            'created_at', NOW(),
            'updated_at', NOW()
        ),
        'APPROVED'::approval_status
    ) ON CONFLICT (id) DO UPDATE 
    SET attributes = EXCLUDED.attributes,
        updated_at = NOW();
    
    RAISE NOTICE 'Rate limiting ontology created successfully';
    RAISE NOTICE 'Created classes: RateLimitRule, BypassToken, RateLimitAttempt';
    RAISE NOTICE 'Seeded 4 CVE-004 rate limit rules';
    
END $$;
