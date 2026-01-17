-- Migration: Create Unified Users View
-- Description: Provides a standard table-like interface for the 'User' ontology entities.

DROP VIEW IF EXISTS unified_users CASCADE;

CREATE OR REPLACE VIEW unified_users AS
SELECT 
    e.id, 
    e.display_name as username, 
    e.attributes->>'email' as email, 
    e.attributes->>'password_hash' as password_hash,
    e.attributes->>'mfa_secret' as mfa_secret,
    e.attributes->'backup_codes' as backup_codes,
    e.created_at,
    e.updated_at,
    e.attributes->>'last_login_ip' as last_login_ip,
    e.attributes->>'last_user_agent' as last_user_agent,
    (e.attributes->>'last_login_at')::timestamptz as last_login_at,
    e.attributes->'notification_preferences' as notification_preferences,
    e.tenant_id
FROM entities e
JOIN classes c ON e.class_id = c.id
WHERE c.name = 'User' AND e.deleted_at IS NULL;
