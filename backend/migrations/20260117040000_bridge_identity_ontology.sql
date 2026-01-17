-- Bridge Identity & Ontology
-- Adds user_id property to User class and seeds entities for existing users.

DO $$
DECLARE
    v_system_version_id UUID;
    user_class_id UUID;
    user_rec RECORD;
BEGIN
    -- 1. Get the system version ID
    SELECT id INTO v_system_version_id 
    FROM ontology_versions 
    WHERE is_system = TRUE 
    LIMIT 1;

    IF v_system_version_id IS NULL THEN
        RAISE EXCEPTION 'System ontology version not found';
    END IF;

    -- 2. Get the 'User' class ID
    SELECT id INTO user_class_id 
    FROM classes 
    WHERE name = 'User' AND version_id = v_system_version_id 
    LIMIT 1;

    IF user_class_id IS NULL THEN
        RAISE EXCEPTION 'Ontology class "User" not found in system version';
    END IF;

    -- 3. Add 'user_id' property to User class
    INSERT INTO properties (name, description, class_id, data_type, is_required, is_unique, version_id)
    VALUES ('user_id', 'The internal database UUID of the user', user_class_id, 'string', TRUE, TRUE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- 4. Seed entities for existing users
    FOR user_rec IN (SELECT id, username, email FROM users) LOOP
        -- Check if entity already exists for this user
        IF NOT EXISTS (
            SELECT 1 FROM entities 
            WHERE class_id = user_class_id 
              AND (attributes->>'user_id')::uuid = user_rec.id
        ) THEN
            INSERT INTO entities (class_id, display_name, attributes)
            VALUES (
                user_class_id, 
                user_rec.username, 
                jsonb_build_object(
                    'user_id', user_rec.id::text,
                    'username', user_rec.username,
                    'email', user_rec.email,
                    'last_login_at', NULL,
                    'last_login_ip', NULL,
                    'custom_attributes', '{}'::jsonb
                )
            );
        END IF;
    END LOOP;

END $$;
