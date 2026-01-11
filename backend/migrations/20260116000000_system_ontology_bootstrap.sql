-- System Ontology Bootstrap Migration
-- Creates a system ontology version with predefined core classes
-- that serve as the foundation for ontology-first architecture.

-- ============================================================================
-- SCHEMA UPDATES
-- ============================================================================

-- Add is_system flag to ontology_versions to mark immutable system versions
ALTER TABLE ontology_versions ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Create unique constraint to allow only one system version
CREATE UNIQUE INDEX IF NOT EXISTS idx_ontology_versions_system 
ON ontology_versions (is_system) WHERE is_system = TRUE;

-- ============================================================================
-- CREATE SYSTEM ONTOLOGY VERSION
-- ============================================================================

-- Insert system ontology version (status will be PUBLISHED to make it usable)
INSERT INTO ontology_versions (version, description, is_system) 
VALUES ('system-1.0.0', 'Core system ontology with foundational classes for access control, identity, operations, and metadata', TRUE)
ON CONFLICT (version) DO NOTHING;

-- Get the system version ID for subsequent inserts
DO $$
DECLARE
    v_system_version_id UUID;
BEGIN
    SELECT id INTO v_system_version_id 
    FROM ontology_versions 
    WHERE is_system = TRUE 
    LIMIT 1;

    -- ============================================================================
    -- SEED CORE SYSTEM CLASSES
    -- ============================================================================

    -- AccessControl hierarchy
    INSERT INTO classes (name, description, version_id, is_abstract, tenant_id) VALUES
        ('AccessControl', 'Base class for all access control entities', v_system_version_id, TRUE, NULL),
        ('Role', 'A role that can be assigned to users for authorization', v_system_version_id, FALSE, NULL),
        ('Permission', 'A granular permission type (e.g., Read, Update, Delete)', v_system_version_id, FALSE, NULL),
        ('Resource', 'A protected resource or scope within the application', v_system_version_id, FALSE, NULL),
        ('RelationshipType', 'Defines types of relationships between entities', v_system_version_id, FALSE, NULL)
    ON CONFLICT (name, tenant_id, version_id) DO NOTHING;

    -- Identity hierarchy
    INSERT INTO classes (name, description, version_id, is_abstract, tenant_id) VALUES
        ('Identity', 'Base class for all identity entities', v_system_version_id, TRUE, NULL),
        ('User', 'A user account in the system', v_system_version_id, FALSE, NULL),
        ('ServiceAccount', 'A service account for machine-to-machine authentication', v_system_version_id, FALSE, NULL),
        ('Group', 'A group of users for collective permissions', v_system_version_id, FALSE, NULL)
    ON CONFLICT (name, tenant_id, version_id) DO NOTHING;

    -- Operations hierarchy
    INSERT INTO classes (name, description, version_id, is_abstract, tenant_id) VALUES
        ('Operations', 'Base class for operational entities', v_system_version_id, TRUE, NULL),
        ('AuditEvent', 'An audit trail event capturing system actions', v_system_version_id, FALSE, NULL),
        ('RateLimitPolicy', 'A rate limiting policy for API endpoints', v_system_version_id, FALSE, NULL),
        ('Service', 'A registered service in the discovery registry', v_system_version_id, FALSE, NULL),
        ('Endpoint', 'An API endpoint with metadata and policies', v_system_version_id, FALSE, NULL)
    ON CONFLICT (name, tenant_id, version_id) DO NOTHING;

    -- Meta hierarchy (self-referential)
    INSERT INTO classes (name, description, version_id, is_abstract, tenant_id) VALUES
        ('Meta', 'Base class for metadata and ontology structure', v_system_version_id, TRUE, NULL),
        ('Class', 'Represents a class in the ontology (self-referential)', v_system_version_id, FALSE, NULL),
        ('Property', 'Represents a property definition in the ontology', v_system_version_id, FALSE, NULL)
    ON CONFLICT (name, tenant_id, version_id) DO NOTHING;

    -- ============================================================================
    -- SET PARENT CLASS RELATIONSHIPS
    -- ============================================================================

    -- Update parent_class_id for subclasses
    UPDATE classes SET parent_class_id = (SELECT id FROM classes WHERE name = 'AccessControl' AND version_id = v_system_version_id)
    WHERE name IN ('Role', 'Permission', 'Resource', 'RelationshipType') AND version_id = v_system_version_id;

    UPDATE classes SET parent_class_id = (SELECT id FROM classes WHERE name = 'Identity' AND version_id = v_system_version_id)
    WHERE name IN ('User', 'ServiceAccount', 'Group') AND version_id = v_system_version_id;

    UPDATE classes SET parent_class_id = (SELECT id FROM classes WHERE name = 'Operations' AND version_id = v_system_version_id)
    WHERE name IN ('AuditEvent', 'RateLimitPolicy', 'Service', 'Endpoint') AND version_id = v_system_version_id;

    UPDATE classes SET parent_class_id = (SELECT id FROM classes WHERE name = 'Meta' AND version_id = v_system_version_id)
    WHERE name IN ('Class', 'Property') AND version_id = v_system_version_id;

    -- ============================================================================
    -- SEED PROPERTIES FOR CORE CLASSES
    -- ============================================================================

    -- Role properties
    INSERT INTO properties (name, description, class_id, data_type, is_required, version_id) VALUES
        ('name', 'Role name', (SELECT id FROM classes WHERE name = 'Role' AND version_id = v_system_version_id), 'string', TRUE, v_system_version_id),
        ('description', 'Role description', (SELECT id FROM classes WHERE name = 'Role' AND version_id = v_system_version_id), 'string', FALSE, v_system_version_id),
        ('level', 'Hierarchical level for role delegation', (SELECT id FROM classes WHERE name = 'Role' AND version_id = v_system_version_id), 'integer', TRUE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- Permission properties
    INSERT INTO properties (name, description, class_id, data_type, is_required, version_id) VALUES
        ('name', 'Permission name (e.g., Read, Update, Delete)', (SELECT id FROM classes WHERE name = 'Permission' AND version_id = v_system_version_id), 'string', TRUE, v_system_version_id),
        ('description', 'Permission description', (SELECT id FROM classes WHERE name = 'Permission' AND version_id = v_system_version_id), 'string', FALSE, v_system_version_id),
        ('level', 'Permission sensitivity level', (SELECT id FROM classes WHERE name = 'Permission' AND version_id = v_system_version_id), 'integer', TRUE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- User properties
    INSERT INTO properties (name, description, class_id, data_type, is_required, is_unique, is_sensitive, version_id) VALUES
        ('username', 'User login name', (SELECT id FROM classes WHERE name = 'User' AND version_id = v_system_version_id), 'string', TRUE, TRUE, FALSE, v_system_version_id),
        ('email', 'User email address', (SELECT id FROM classes WHERE name = 'User' AND version_id = v_system_version_id), 'string', TRUE, TRUE, TRUE, v_system_version_id),
        ('last_login_ip', 'IP address of last login', (SELECT id FROM classes WHERE name = 'User' AND version_id = v_system_version_id), 'string', FALSE, FALSE, TRUE, v_system_version_id),
        ('last_login_at', 'Timestamp of last login', (SELECT id FROM classes WHERE name = 'User' AND version_id = v_system_version_id), 'datetime', FALSE, FALSE, FALSE, v_system_version_id),
        ('custom_attributes', 'Extensible user attributes', (SELECT id FROM classes WHERE name = 'User' AND version_id = v_system_version_id), 'json', FALSE, FALSE, FALSE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- AuditEvent properties
    INSERT INTO properties (name, description, class_id, data_type, is_required, version_id) VALUES
        ('action', 'The action performed (Create, Read, Update, Delete, Login)', (SELECT id FROM classes WHERE name = 'AuditEvent' AND version_id = v_system_version_id), 'string', TRUE, v_system_version_id),
        ('resource_class', 'The class of resource affected', (SELECT id FROM classes WHERE name = 'AuditEvent' AND version_id = v_system_version_id), 'string', FALSE, v_system_version_id),
        ('before_state', 'State before the action', (SELECT id FROM classes WHERE name = 'AuditEvent' AND version_id = v_system_version_id), 'json', FALSE, v_system_version_id),
        ('after_state', 'State after the action', (SELECT id FROM classes WHERE name = 'AuditEvent' AND version_id = v_system_version_id), 'json', FALSE, v_system_version_id),
        ('timestamp', 'When the event occurred', (SELECT id FROM classes WHERE name = 'AuditEvent' AND version_id = v_system_version_id), 'datetime', TRUE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- RateLimitPolicy properties
    INSERT INTO properties (name, description, class_id, data_type, is_required, version_id) VALUES
        ('name', 'Policy name', (SELECT id FROM classes WHERE name = 'RateLimitPolicy' AND version_id = v_system_version_id), 'string', TRUE, v_system_version_id),
        ('requests_per_window', 'Maximum requests allowed in time window', (SELECT id FROM classes WHERE name = 'RateLimitPolicy' AND version_id = v_system_version_id), 'integer', TRUE, v_system_version_id),
        ('window_seconds', 'Time window in seconds', (SELECT id FROM classes WHERE name = 'RateLimitPolicy' AND version_id = v_system_version_id), 'integer', TRUE, v_system_version_id),
        ('burst_size', 'Maximum burst size', (SELECT id FROM classes WHERE name = 'RateLimitPolicy' AND version_id = v_system_version_id), 'integer', TRUE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- Service properties
    INSERT INTO properties (name, description, class_id, data_type, is_required, version_id) VALUES
        ('name', 'Service name', (SELECT id FROM classes WHERE name = 'Service' AND version_id = v_system_version_id), 'string', TRUE, v_system_version_id),
        ('version', 'Service version', (SELECT id FROM classes WHERE name = 'Service' AND version_id = v_system_version_id), 'string', TRUE, v_system_version_id),
        ('health_endpoint', 'Health check endpoint URL', (SELECT id FROM classes WHERE name = 'Service' AND version_id = v_system_version_id), 'string', FALSE, v_system_version_id),
        ('status', 'Current service status (Healthy, Degraded, Unhealthy)', (SELECT id FROM classes WHERE name = 'Service' AND version_id = v_system_version_id), 'string', TRUE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- ============================================================================
    -- SEED SYSTEM RELATIONSHIP TYPES
    -- ============================================================================

    -- Add system relationship types for access control
    INSERT INTO relationship_types (name, description, grants_permission_inheritance) VALUES
        ('has_role', 'User has a role assignment', TRUE),
        ('grants_permission', 'Role grants a permission', FALSE),
        ('applies_to', 'Policy applies to a resource or endpoint', TRUE),
        ('performed_by', 'Action performed by a user', FALSE),
        ('affects', 'Event affects a resource', FALSE),
        ('depends_on', 'Service depends on another service', FALSE)
    ON CONFLICT (name) DO NOTHING;

END $$;
