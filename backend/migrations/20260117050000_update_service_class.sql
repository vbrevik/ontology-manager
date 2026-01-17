-- Align Service class with Discovery requirements
-- Renames health_endpoint to endpoint and adds last_heartbeat.

DO $$
DECLARE
    v_system_version_id UUID;
    v_service_class_id UUID;
BEGIN
    -- 1. Get the system version ID
    SELECT id INTO v_system_version_id 
    FROM ontology_versions 
    WHERE is_system = TRUE 
    LIMIT 1;

    IF v_system_version_id IS NULL THEN
        RAISE EXCEPTION 'System ontology version not found';
    END IF;

    -- 2. Get the 'Service' class ID
    SELECT id INTO v_service_class_id 
    FROM classes 
    WHERE name = 'Service' AND version_id = v_system_version_id 
    LIMIT 1;

    IF v_service_class_id IS NULL THEN
        RAISE EXCEPTION 'Ontology class "Service" not found in system version';
    END IF;

    -- 3. Rename health_endpoint to endpoint if it exists
    UPDATE properties 
    SET name = 'endpoint', description = 'The service access endpoint'
    WHERE class_id = v_service_class_id AND name = 'health_endpoint';

    -- 4. Add 'last_heartbeat' property if it doesn't exist
    INSERT INTO properties (name, description, class_id, data_type, is_required, is_unique, version_id)
    VALUES ('last_heartbeat', 'ISO8601 timestamp of the last heartbeat', v_service_class_id, 'datetime', FALSE, FALSE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- 5. Add 'id' property to Service class to store the discovery UUID
    INSERT INTO properties (name, description, class_id, data_type, is_required, is_unique, version_id)
    VALUES ('service_id', 'The internal discovery UUID of the service', v_service_class_id, 'string', TRUE, TRUE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

END $$;
