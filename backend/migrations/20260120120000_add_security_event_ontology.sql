-- Migration: Add SecurityEvent Ontology
-- Description: Defines the SecurityEvent class and relationships for graph-based security intelligence.

DO $$
DECLARE
    v_system_version_id UUID;
    v_security_event_class_id UUID;
    v_user_class_id UUID;
    v_entity_class_id UUID; -- Abstract root class, effectively 'Thing' or we just target 'Entity' conceptually
BEGIN
    -- 1. Get system version
    SELECT id INTO v_system_version_id FROM ontology_versions WHERE is_system = TRUE LIMIT 1;
    IF v_system_version_id IS NULL THEN
        RAISE EXCEPTION 'System ontology version not found';
    END IF;

    -- 2. Create SecurityEvent Class
    -- Check if it exists first to handle the nullable tenant_id constraint complexity
    SELECT id INTO v_security_event_class_id FROM classes WHERE name = 'SecurityEvent' AND version_id = v_system_version_id AND tenant_id IS NULL;
    
    IF v_security_event_class_id IS NULL THEN
        INSERT INTO classes (name, description, version_id, is_abstract)
        VALUES ('SecurityEvent', 'Represents a security-relevant event (login, denial, modification)', v_system_version_id, FALSE)
        RETURNING id INTO v_security_event_class_id;
    END IF;

    -- 3. Add Properties
    -- Action (e.g., "LOGIN_SUCCESS", "PERMISSION_DENIED")
    INSERT INTO properties (name, description, class_id, data_type, is_required, is_unique, version_id)
    VALUES ('action', 'The type of security action occurred', v_security_event_class_id, 'string', TRUE, FALSE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- Severity (LOW, MEDIUM, HIGH, CRITICAL)
    INSERT INTO properties (name, description, class_id, data_type, is_required, is_unique, version_id)
    VALUES ('severity', 'The severity level of the event', v_security_event_class_id, 'string', TRUE, FALSE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- Details (JSON payload)
    INSERT INTO properties (name, description, class_id, data_type, is_required, is_unique, version_id)
    VALUES ('details', 'Detailed context of the event', v_security_event_class_id, 'json', FALSE, FALSE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- Network Info
    INSERT INTO properties (name, description, class_id, data_type, is_required, is_unique, version_id)
    VALUES ('ip_address', 'IP address of the actor', v_security_event_class_id, 'string', FALSE, FALSE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    INSERT INTO properties (name, description, class_id, data_type, is_required, is_unique, version_id)
    VALUES ('user_agent', 'User Agent string of the actor', v_security_event_class_id, 'string', FALSE, FALSE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- 4. Create Relationship Types
    
    -- initiated_by (SecurityEvent -> User)
    -- We need User class ID
    SELECT id INTO v_user_class_id FROM classes WHERE name = 'User' AND version_id = v_system_version_id LIMIT 1;

    INSERT INTO relationship_types (name, description, allowed_source_class_id, allowed_target_class_id)
    VALUES ('initiated_by', 'The actor who triggered the event', v_security_event_class_id, v_user_class_id)
    ON CONFLICT (name) DO NOTHING;

    -- affected_target (SecurityEvent -> Any Entity)
    INSERT INTO relationship_types (name, description, allowed_source_class_id, allowed_target_class_id)
    VALUES ('affected_target', 'The entity affected by this event', v_security_event_class_id, NULL)
    ON CONFLICT (name) DO NOTHING;

END $$;
