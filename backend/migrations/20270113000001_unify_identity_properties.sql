-- Migration: Unify Identity Properties
-- Description: Adds password and security properties to the 'User' class in the system ontology.

DO $$
DECLARE
    v_user_class_id UUID;
    v_sys_version_id UUID;
BEGIN
    -- 1. Get metadata
    SELECT id INTO v_user_class_id FROM classes WHERE name = 'User' LIMIT 1;
    SELECT id INTO v_sys_version_id FROM ontology_versions WHERE version = 'system-v1' LIMIT 1;

    IF v_user_class_id IS NOT NULL AND v_sys_version_id IS NOT NULL THEN
        -- 2. Add missing properties
        INSERT INTO properties (name, description, class_id, data_type, is_required, is_unique, is_sensitive, version_id)
        VALUES 
            ('password_hash', 'Hashed user password', v_user_class_id, 'string', true, false, true, v_sys_version_id),
            ('mfa_secret', 'MFA TOTP secret', v_user_class_id, 'string', false, false, true, v_sys_version_id),
            ('backup_codes', 'MFA backup codes', v_user_class_id, 'json', false, false, true, v_sys_version_id),
            ('last_user_agent', 'User agent of last login', v_user_class_id, 'string', false, false, false, v_sys_version_id)
        ON CONFLICT (name, class_id, version_id) DO NOTHING;

        -- 3. Sync existing data from legacy 'users' table to ontology 'entities'
        -- We update the 'attributes' column for all existing User entities
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
            UPDATE entities e
            SET attributes = e.attributes || jsonb_build_object(
                'password_hash', u.password_hash,
                'mfa_secret', u.mfa_secret,
                'backup_codes', u.backup_codes,
                'last_user_agent', u.last_user_agent,
                'last_login_at', u.last_login_at,
                'last_login_ip', u.last_login_ip
            ),
            updated_at = NOW()
            FROM users u
            WHERE e.id = u.id AND e.class_id = v_user_class_id;
        END IF;
    END IF;
END $$;
