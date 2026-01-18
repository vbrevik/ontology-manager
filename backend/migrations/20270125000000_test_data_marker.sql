-- Migration: Test Data Marker System
-- Description: Creates ontology infrastructure to mark and filter test data

DO $$
DECLARE
    v_version_id UUID;
    v_test_marker_class_id UUID;
    v_marked_as_test_rt_id UUID;
BEGIN
    -- Get system version
    SELECT id INTO v_version_id FROM ontology_versions WHERE is_system = TRUE LIMIT 1;
    
    IF v_version_id IS NULL THEN
        RAISE EXCEPTION 'System ontology version not found';
    END IF;
    
    -- ========================================================================
    -- Create TestMarker Class
    -- ========================================================================
    
    -- TestMarker is a singleton class - only one instance needed
    INSERT INTO classes (id, name, description, is_abstract, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-900000000001',
        'TestMarker',
        'Marker to identify entities created during automated testing',
        FALSE,
        v_version_id
    ) ON CONFLICT (name, tenant_id, version_id) DO NOTHING;
    
    SELECT id INTO v_test_marker_class_id FROM classes WHERE name = 'TestMarker';
    
    -- Add properties for test context
    INSERT INTO properties (class_id, name, data_type, is_required, description, version_id)
    VALUES
        (v_test_marker_class_id, 'test_suite', 'string', FALSE, 'Name of test suite (e.g., "e2e", "integration")', v_version_id),
        (v_test_marker_class_id, 'test_run_id', 'string', FALSE, 'Unique identifier for test run', v_version_id),
        (v_test_marker_class_id, 'created_by_test', 'string', FALSE, 'Test name that created this entity', v_version_id),
        (v_test_marker_class_id, 'expires_at', 'datetime', FALSE, 'Auto-cleanup timestamp (optional)', v_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;
    
    -- ========================================================================
    -- Create Test Marker Instance
    -- ========================================================================
    
    -- Create a singleton TestMarker entity that all test data relates to
    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-900000000002',
        v_test_marker_class_id,
        'E2E Test Marker',
        jsonb_build_object(
            'test_suite', 'e2e',
            'description', 'Marker for all E2E test data'
        ),
        'APPROVED'
    ) ON CONFLICT (id) DO NOTHING;
    
    -- ========================================================================
    -- Create Relationship Type
    -- ========================================================================
    
    -- marked_as_test: Any Entity -> TestMarker
    INSERT INTO relationship_types (id, name, description, source_cardinality, target_cardinality, grants_permission_inheritance)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-900000000003',
        'marked_as_test',
        'Entity is marked as test data and should be filtered from production views',
        'many',
        'one',
        FALSE
    ) ON CONFLICT (name) DO NOTHING;
    
    SELECT id INTO v_marked_as_test_rt_id FROM relationship_types WHERE name = 'marked_as_test';
    
    RAISE NOTICE 'Test marker infrastructure created';
    RAISE NOTICE 'Test marker entity ID: a1b2c3d4-e5f6-7890-abcd-900000000002';
    RAISE NOTICE 'Relationship type ID: %', v_marked_as_test_rt_id;
    
END $$;

-- ========================================================================
-- Helper Functions
-- ========================================================================

-- Function: is_test_data
-- Check if an entity is marked as test data
CREATE OR REPLACE FUNCTION is_test_data(p_entity_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_test BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM relationships r
        JOIN relationship_types rt ON r.relationship_type_id = rt.id
        WHERE rt.name = 'marked_as_test'
        AND r.source_entity_id = p_entity_id
    ) INTO v_is_test;
    
    RETURN COALESCE(v_is_test, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_test_data(UUID) IS 'Returns true if entity is marked as test data';

-- Function: mark_as_test_data
-- Convenience function to mark an entity as test data
CREATE OR REPLACE FUNCTION mark_as_test_data(
    p_entity_id UUID,
    p_test_suite VARCHAR DEFAULT 'e2e',
    p_test_name VARCHAR DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_marker_id UUID;
    v_rt_id UUID;
BEGIN
    -- Get test marker entity
    SELECT id INTO v_marker_id 
    FROM entities 
    WHERE class_id = (SELECT id FROM classes WHERE name = 'TestMarker')
    LIMIT 1;
    
    -- Get relationship type
    SELECT id INTO v_rt_id 
    FROM relationship_types 
    WHERE name = 'marked_as_test';
    
    IF v_marker_id IS NULL OR v_rt_id IS NULL THEN
        RAISE EXCEPTION 'Test marker infrastructure not found';
    END IF;
    
    -- Create relationship
    INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id, attributes)
    VALUES (
        gen_random_uuid(),
        v_rt_id,
        p_entity_id,
        v_marker_id,
        jsonb_build_object(
            'test_suite', p_test_suite,
            'test_name', p_test_name,
            'marked_at', NOW()
        )
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Entity % marked as test data', p_entity_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_as_test_data(UUID, VARCHAR, VARCHAR) IS 'Mark an entity as test data';

-- Function: get_non_test_entities
-- Get all entities of a class that are not marked as test data
CREATE OR REPLACE FUNCTION get_non_test_entities(p_class_name VARCHAR)
RETURNS TABLE(entity_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id
    FROM entities e
    WHERE e.class_id = (SELECT id FROM classes WHERE name = p_class_name)
    AND e.deleted_at IS NULL
    AND NOT is_test_data(e.id);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_non_test_entities(VARCHAR) IS 'Returns all non-test entities of a given class';

-- ========================================================================
-- Create View for Production Data
-- ========================================================================

-- View: production_projects
-- Projects that are NOT test data
CREATE OR REPLACE VIEW production_projects AS
SELECT 
    p.*,
    FALSE as is_test_data
FROM unified_projects p
WHERE NOT is_test_data(p.id);

COMMENT ON VIEW production_projects IS 'Projects filtered to exclude test data';

-- View: production_users
-- Users that are NOT test accounts
CREATE OR REPLACE VIEW production_users AS
SELECT 
    u.*,
    FALSE as is_test_data
FROM unified_users u
WHERE NOT is_test_data(u.id);

COMMENT ON VIEW production_users IS 'Users filtered to exclude test accounts';

-- ========================================================================
-- Optional: Auto-cleanup old test data
-- ========================================================================

-- Function: cleanup_expired_test_data
-- Remove test data older than specified days
CREATE OR REPLACE FUNCTION cleanup_expired_test_data(p_days_old INTEGER DEFAULT 7)
RETURNS TABLE(deleted_entity_id UUID, entity_type VARCHAR) AS $$
DECLARE
    v_cutoff_date TIMESTAMP;
BEGIN
    v_cutoff_date := NOW() - (p_days_old || ' days')::INTERVAL;
    
    RETURN QUERY
    WITH test_entities AS (
        SELECT DISTINCT
            e.id as entity_id,
            c.name as class_name
        FROM entities e
        JOIN classes c ON e.class_id = c.id
        JOIN relationships r ON r.source_entity_id = e.id
        JOIN relationship_types rt ON r.relationship_type_id = rt.id
        WHERE rt.name = 'marked_as_test'
        AND e.created_at < v_cutoff_date
        AND e.deleted_at IS NULL
    ),
    deleted AS (
        UPDATE entities e
        SET deleted_at = NOW()
        FROM test_entities te
        WHERE e.id = te.entity_id
        RETURNING e.id, te.class_name
    )
    SELECT * FROM deleted;
    
    RAISE NOTICE 'Cleaned up test data older than % days', p_days_old;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_test_data(INTEGER) IS 'Soft-delete test entities older than specified days';

-- ========================================================================
-- Grant permissions
-- ========================================================================

-- Note: In production, you might want to restrict cleanup_expired_test_data to admin role
