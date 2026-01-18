-- Add ontology classes for rate limiting (ontology-first approach)
-- This replaces the raw SQL tables with proper ontology entities

-- Create RateLimitRule class
INSERT INTO classes (name, description, version) VALUES
('RateLimitRule', 'Defines rate limiting rules for endpoints', 1);

-- Add properties to RateLimitRule class
INSERT INTO class_properties (class_id, name, data_type, required, description, version)
SELECT
    c.id,
    prop.name,
    prop.data_type,
    prop.required,
    prop.description,
    1
FROM classes c
CROSS JOIN (
    VALUES
        ('name', 'String', true, 'Unique rule name (e.g., auth-login)'),
        ('endpoint_pattern', 'String', true, 'URL pattern to match (e.g., /api/auth/login)'),
        ('max_requests', 'Integer', true, 'Maximum requests allowed in window'),
        ('window_seconds', 'Integer', true, 'Time window in seconds'),
        ('strategy', 'String', true, 'IP, User, or Global'),
        ('enabled', 'Boolean', true, 'Whether rule is active')
) AS prop(name, data_type, required, description)
WHERE c.name = 'RateLimitRule';

-- Create RateLimitAttempt class (for tracking attempts)
INSERT INTO classes (name, description, version) VALUES
('RateLimitAttempt', 'Tracks individual rate limit attempts', 1);

-- Add properties to RateLimitAttempt class
INSERT INTO class_properties (class_id, name, data_type, required, description, version)
SELECT
    c.id,
    prop.name,
    prop.data_type,
    prop.required,
    prop.description,
    1
FROM classes c
CROSS JOIN (
    VALUES
        ('rule_name', 'String', true, 'Rate limit rule name'),
        ('identifier', 'String', true, 'IP address or user ID'),
        ('endpoint', 'String', true, 'Actual endpoint accessed'),
        ('attempted_at', 'DateTime', true, 'When attempt occurred'),
        ('blocked', 'Boolean', true, 'Whether request was blocked')
) AS prop(name, data_type, required, description)
WHERE c.name = 'RateLimitAttempt';

-- Create BypassToken class
INSERT INTO classes (name, description, version) VALUES
('BypassToken', 'Tokens that bypass rate limiting', 1);

-- Add properties to BypassToken class
INSERT INTO class_properties (class_id, name, data_type, required, description, version)
SELECT
    c.id,
    prop.name,
    prop.data_type,
    prop.required,
    prop.description,
    1
FROM classes c
CROSS JOIN (
    VALUES
        ('token', 'String', true, 'The bypass token value'),
        ('description', 'String', false, 'Human-readable description'),
        ('expires_at', 'DateTime', false, 'Optional expiration date'),
        ('created_by', 'String', false, 'User who created token')
) AS prop(name, data_type, required, description)
WHERE c.name = 'BypassToken';

-- Seed initial rate limit rules as ontology entities
-- Auth endpoints with specific limits (CVE-004)
INSERT INTO entities (class_id, display_name, attributes)
SELECT
    c.id,
    'Rate Limit Rule: Auth Login',
    json_build_object(
        'name', 'auth-login',
        'endpoint_pattern', '/api/auth/login',
        'max_requests', 5,
        'window_seconds', 900,
        'strategy', 'IP',
        'enabled', true
    )
FROM classes c WHERE c.name = 'RateLimitRule'
UNION ALL
SELECT
    c.id,
    'Rate Limit Rule: Auth MFA Challenge',
    json_build_object(
        'name', 'auth-mfa-challenge',
        'endpoint_pattern', '/api/auth/mfa/challenge',
        'max_requests', 10,
        'window_seconds', 300,
        'strategy', 'IP',
        'enabled', true
    )
FROM classes c WHERE c.name = 'RateLimitRule'
UNION ALL
SELECT
    c.id,
    'Rate Limit Rule: Auth Forgot Password',
    json_build_object(
        'name', 'auth-forgot-password',
        'endpoint_pattern', '/api/auth/forgot-password',
        'max_requests', 3,
        'window_seconds', 3600,
        'strategy', 'IP',
        'enabled', true
    )
FROM classes c WHERE c.name = 'RateLimitRule'
UNION ALL
SELECT
    c.id,
    'Rate Limit Rule: Auth Register',
    json_build_object(
        'name', 'auth-register',
        'endpoint_pattern', '/api/auth/register',
        'max_requests', 3,
        'window_seconds', 3600,
        'strategy', 'IP',
        'enabled', true
    )
FROM classes c WHERE c.name = 'RateLimitRule'
UNION ALL
SELECT
    c.id,
    'Rate Limit Rule: Auth General',
    json_build_object(
        'name', 'auth-general',
        'endpoint_pattern', '/api/auth/*',
        'max_requests', 60,
        'window_seconds', 60,
        'strategy', 'User',
        'enabled', true
    )
FROM classes c WHERE c.name = 'RateLimitRule'
UNION ALL
SELECT
    c.id,
    'Rate Limit Rule: Admin Endpoints',
    json_build_object(
        'name', 'admin',
        'endpoint_pattern', '/api/admin/*',
        'max_requests', 50,
        'window_seconds', 60,
        'strategy', 'User',
        'enabled', true
    )
FROM classes c WHERE c.name = 'RateLimitRule';

-- Create initial bypass token for testing
INSERT INTO entities (class_id, display_name, attributes)
SELECT
    c.id,
    'Test Bypass Token',
    json_build_object(
        'token', 'test-bypass-token-12345',
        'description', 'Automated test bypass token - DO NOT DELETE',
        'created_by', 'system'
    )
FROM classes c WHERE c.name = 'BypassToken';