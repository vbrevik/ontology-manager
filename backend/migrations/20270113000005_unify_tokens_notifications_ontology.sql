-- Migration: Unify Tokens and Notifications Ontology
-- Description: Creates ontology classes for tokens and notifications, migrates data, and creates unified views.

DO $$
DECLARE
    v_sys_version_id UUID;
    v_rt_class_id UUID;
    v_prt_class_id UUID;
    v_notif_class_id UUID;
    v_security_root_class_id UUID;
BEGIN
    -- 1. Get System Version and Root Class (Security)
    SELECT id INTO v_sys_version_id FROM ontology_versions WHERE is_system = TRUE LIMIT 1;
    
    -- Using Resource or SecurityEvent as parent if appropriate, or just a generic root.
    -- Let's use 'SecurityEvent' as parent for tokens for now (or a new Session class).
    SELECT id INTO v_security_root_class_id FROM classes WHERE name = 'SecurityEvent' LIMIT 1;

    -- 2. Create Classes
    IF NOT EXISTS (SELECT 1 FROM classes WHERE name = 'RefreshToken') THEN
        INSERT INTO classes (id, name, description, parent_class_id, version_id)
        VALUES (gen_random_uuid(), 'RefreshToken', 'An active authentication session refresh token', v_security_root_class_id, v_sys_version_id)
        RETURNING id INTO v_rt_class_id;
    ELSE
        SELECT id INTO v_rt_class_id FROM classes WHERE name = 'RefreshToken';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM classes WHERE name = 'PasswordResetToken') THEN
        INSERT INTO classes (id, name, description, parent_class_id, version_id)
        VALUES (gen_random_uuid(), 'PasswordResetToken', 'A token for password reset flow', v_security_root_class_id, v_sys_version_id)
        RETURNING id INTO v_prt_class_id;
    ELSE
        SELECT id INTO v_prt_class_id FROM classes WHERE name = 'PasswordResetToken';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM classes WHERE name = 'Notification') THEN
        INSERT INTO classes (id, name, description, version_id)
        VALUES (gen_random_uuid(), 'Notification', 'A system notification for a user', v_sys_version_id)
        RETURNING id INTO v_notif_class_id;
    ELSE
        SELECT id INTO v_notif_class_id FROM classes WHERE name = 'Notification';
    END IF;

    -- 3. Port Data
    -- Refresh Tokens
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refresh_tokens') THEN
        INSERT INTO entities (id, class_id, display_name, attributes, created_at, tenant_id)
        SELECT 
            gen_random_uuid(), 
            v_rt_class_id, 
            'RefreshToken: ' || token_id, 
            jsonb_build_object(
                'token_id', token_id,
                'user_id', user_id,
                'expires_at', expires_at,
                'ip_address', ip_address,
                'user_agent', user_agent
            ),
            created_at,
            tenant_id
        FROM refresh_tokens
        ON CONFLICT DO NOTHING;
    END IF;

    -- Password Reset Tokens
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'password_reset_tokens') THEN
        INSERT INTO entities (id, class_id, display_name, attributes, created_at)
        SELECT 
            gen_random_uuid(), 
            v_prt_class_id, 
            'PasswordResetToken for ' || user_id, 
            jsonb_build_object(
                'user_id', user_id,
                'token_hash', token_hash,
                'expires_at', expires_at
            ),
            created_at
        FROM password_reset_tokens
        ON CONFLICT DO NOTHING;
    END IF;

    -- Notifications
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        INSERT INTO entities (id, class_id, display_name, attributes, created_at)
        SELECT 
            gen_random_uuid(), 
            v_notif_class_id, 
            'Notification: ' || LEFT(message, 20), 
            jsonb_build_object(
                'user_id', user_id,
                'message', message,
                'read', read
            ),
            created_at
        FROM notifications
        ON CONFLICT DO NOTHING;
    END IF;

END $$;

-- 4. Create Views
CREATE OR REPLACE VIEW unified_refresh_tokens AS
SELECT 
    e.id as entity_id,
    e.attributes->>'token_id' as token_id,
    (e.attributes->>'user_id')::uuid as user_id,
    e.tenant_id,
    (e.attributes->>'expires_at')::timestamptz as expires_at,
    e.attributes->>'ip_address' as ip_address,
    e.attributes->>'user_agent' as user_agent,
    e.created_at
FROM entities e
JOIN classes c ON e.class_id = c.id
WHERE c.name = 'RefreshToken' AND e.deleted_at IS NULL;

CREATE OR REPLACE VIEW unified_password_reset_tokens AS
SELECT 
    e.id as entity_id,
    (e.attributes->>'user_id')::uuid as user_id,
    e.attributes->>'token_hash' as token_hash,
    (e.attributes->>'expires_at')::timestamptz as expires_at,
    e.created_at
FROM entities e
JOIN classes c ON e.class_id = c.id
WHERE c.name = 'PasswordResetToken' AND e.deleted_at IS NULL;

CREATE OR REPLACE VIEW unified_notifications AS
SELECT 
    e.id as entity_id,
    (e.attributes->>'user_id')::uuid as user_id,
    e.attributes->>'message' as message,
    (e.attributes->>'read')::boolean as read,
    e.created_at
FROM entities e
JOIN classes c ON e.class_id = c.id
WHERE c.name = 'Notification' AND e.deleted_at IS NULL;
