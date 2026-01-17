-- Migration: Unify MFA Ontology
-- Description: Ports MFA data to user entity attributes and updates unified_users view.

DO $$
BEGIN
    -- Port MFA data to user entity attributes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_mfa') THEN
        UPDATE entities e
        SET attributes = e.attributes || jsonb_build_object(
            'mfa_secret', m.secret_key,
            'backup_codes', m.backup_codes,
            'mfa_enabled', m.is_enabled,
            'mfa_verified', m.is_verified,
            'mfa_last_used_at', m.last_used_at
        )
        FROM user_mfa m
        WHERE e.id = m.user_id;
    END IF;

END $$;

-- Drop and recreate unified_users view to include full MFA status
DROP VIEW IF EXISTS unified_users CASCADE;

CREATE VIEW unified_users AS
SELECT 
    e.id,
    e.display_name AS username,
    e.attributes ->> 'email'::text AS email,
    e.attributes ->> 'password_hash'::text AS password_hash,
    e.attributes ->> 'mfa_secret'::text AS mfa_secret,
    e.attributes -> 'backup_codes'::text AS backup_codes,
    (e.attributes ->> 'mfa_enabled')::boolean AS mfa_enabled,
    (e.attributes ->> 'mfa_verified')::boolean AS mfa_verified,
    (e.attributes ->> 'mfa_last_used_at')::timestamptz AS mfa_last_used_at,
    e.created_at,
    e.updated_at,
    e.attributes ->> 'last_login_ip'::text AS last_login_ip,
    e.attributes ->> 'last_user_agent'::text AS last_user_agent,
    (e.attributes ->> 'last_login_at'::text)::timestamptz AS last_login_at,
    e.attributes -> 'notification_preferences'::text AS notification_preferences,
    e.tenant_id
FROM entities e
JOIN classes c ON e.class_id = c.id
WHERE c.name = 'User' AND e.deleted_at IS NULL;
