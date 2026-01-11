-- Ontology Core Schema Migration (Adjacency List with Recursive CTEs)
-- Simple parent_id references with recursive CTEs for graph traversal
-- No extensions required - works on any PostgreSQL

-- ============================================================================
-- SCHEMA VERSIONING
-- ============================================================================

-- Tracks ontology schema versions for compatibility and rollback
CREATE TABLE IF NOT EXISTS ontology_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(50) NOT NULL UNIQUE,  -- Semantic versioning: "1.0.0"
    description TEXT,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Ensure only one version is marked as current
CREATE UNIQUE INDEX IF NOT EXISTS idx_ontology_versions_current 
ON ontology_versions (is_current) WHERE is_current = TRUE;

-- Seed initial version
INSERT INTO ontology_versions (version, description, is_current) 
VALUES ('1.0.0', 'Initial ontology schema', TRUE)
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- CLASS DEFINITIONS (Ontology Schema)
-- ============================================================================

-- Classes define entity types (e.g., "Mission", "Unit", "TargetList", "Context")
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Parent class for inheritance (adjacency list)
    parent_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    -- Links to ontology version for schema evolution
    version_id UUID NOT NULL REFERENCES ontology_versions(id) ON DELETE CASCADE,
    -- Multi-tenancy: NULL for shared core ontology
    tenant_id UUID,
    -- Metadata
    is_abstract BOOLEAN NOT NULL DEFAULT FALSE,
    is_deprecated BOOLEAN NOT NULL DEFAULT FALSE,
    deprecated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Unique name per tenant per version
    CONSTRAINT unique_class_name_tenant_version UNIQUE (name, tenant_id, version_id)
);

CREATE INDEX IF NOT EXISTS idx_classes_parent ON classes(parent_class_id);
CREATE INDEX IF NOT EXISTS idx_classes_version ON classes(version_id);
CREATE INDEX IF NOT EXISTS idx_classes_tenant ON classes(tenant_id);

-- ============================================================================
-- PROPERTY DEFINITIONS
-- ============================================================================

-- Properties define attributes of classes
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Owning class
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    -- Data type: string, integer, float, boolean, date, datetime, uuid, json, reference
    data_type VARCHAR(50) NOT NULL,
    -- For reference types: which class can this reference?
    reference_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    -- Constraints
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_unique BOOLEAN NOT NULL DEFAULT FALSE,
    is_indexed BOOLEAN NOT NULL DEFAULT FALSE,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,  -- Requires ReadSensitive permission
    default_value JSONB,
    validation_rules JSONB,
    -- Versioning
    version_id UUID NOT NULL REFERENCES ontology_versions(id) ON DELETE CASCADE,
    -- Metadata
    is_deprecated BOOLEAN NOT NULL DEFAULT FALSE,
    deprecated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Unique property name per class
    CONSTRAINT unique_property_name_class UNIQUE (name, class_id)
);

CREATE INDEX IF NOT EXISTS idx_properties_class ON properties(class_id);
CREATE INDEX IF NOT EXISTS idx_properties_reference ON properties(reference_class_id);

-- ============================================================================
-- ENTITY INSTANCES (The Data Graph) - Adjacency List Model
-- ============================================================================

-- Entities are instances of classes
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Which class is this an instance of?
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    -- Human-readable name
    display_name VARCHAR(500) NOT NULL,
    -- Parent entity for hierarchy (adjacency list - simple parent_id)
    parent_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    -- Multi-tenancy
    tenant_id UUID,
    -- Entity attribute data stored as JSONB
    attributes JSONB NOT NULL DEFAULT '{}',
    -- Audit fields
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Soft delete support
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_entities_class ON entities(class_id);
CREATE INDEX IF NOT EXISTS idx_entities_parent ON entities(parent_entity_id);
CREATE INDEX IF NOT EXISTS idx_entities_tenant ON entities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entities_display_name ON entities(display_name);
CREATE INDEX IF NOT EXISTS idx_entities_attributes ON entities USING GIN (attributes);
CREATE INDEX IF NOT EXISTS idx_entities_active ON entities(id) WHERE deleted_at IS NULL;

-- ============================================================================
-- RELATIONSHIPS (Graph Edges)
-- ============================================================================

-- Relationship types define edge semantics
CREATE TABLE IF NOT EXISTS relationship_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    -- Cardinality constraints
    source_cardinality VARCHAR(10) DEFAULT 'many',
    target_cardinality VARCHAR(10) DEFAULT 'many',
    -- Which classes can participate? (NULL = any class)
    allowed_source_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    allowed_target_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    -- Does this relationship grant permission inheritance?
    grants_permission_inheritance BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed core relationship types
INSERT INTO relationship_types (name, description, grants_permission_inheritance) VALUES
    ('contains', 'Composition: A contains B (e.g., Campaign contains Operations)', TRUE),
    ('commands', 'Command/Control: User commands Unit', FALSE),
    ('scopes', 'Scope assignment: Operation scopes TargetList', TRUE),
    ('blocks', 'Blocking dependency: Task A blocks Task B', FALSE),
    ('influences', 'External influence: ExternalEvent influences ContextUpdate', FALSE)
ON CONFLICT (name) DO NOTHING;

-- Relationships connect entities with typed edges
CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relationship_type_id UUID NOT NULL REFERENCES relationship_types(id) ON DELETE RESTRICT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_relationship UNIQUE (source_entity_id, target_entity_id, relationship_type_id)
);

CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(relationship_type_id);

-- ============================================================================
-- RECURSIVE CTE FUNCTIONS FOR GRAPH TRAVERSAL
-- ============================================================================

-- Get all ancestors of an entity (walks up the tree via parent_entity_id)
CREATE OR REPLACE FUNCTION get_entity_ancestors(p_entity_id UUID)
RETURNS TABLE (
    ancestor_id UUID,
    ancestor_name VARCHAR(500),
    depth INT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE ancestors AS (
        -- Base case: start with the parent of the given entity
        SELECT e.parent_entity_id as id, 1 as lvl
        FROM entities e
        WHERE e.id = p_entity_id AND e.deleted_at IS NULL
        
        UNION ALL
        
        -- Recursive case: get parent of each ancestor
        SELECT e.parent_entity_id, a.lvl + 1
        FROM ancestors a
        JOIN entities e ON e.id = a.id
        WHERE e.parent_entity_id IS NOT NULL AND e.deleted_at IS NULL
    )
    SELECT e.id, e.display_name, a.lvl
    FROM ancestors a
    JOIN entities e ON e.id = a.id
    WHERE a.id IS NOT NULL
    ORDER BY a.lvl;
END;
$$ LANGUAGE plpgsql;

-- Get all descendants of an entity (walks down the tree)
CREATE OR REPLACE FUNCTION get_entity_descendants(p_entity_id UUID)
RETURNS TABLE (
    descendant_id UUID,
    descendant_name VARCHAR(500),
    depth INT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE descendants AS (
        -- Base case: direct children
        SELECT e.id, 1 as lvl
        FROM entities e
        WHERE e.parent_entity_id = p_entity_id AND e.deleted_at IS NULL
        
        UNION ALL
        
        -- Recursive case: children of children
        SELECT e.id, d.lvl + 1
        FROM descendants d
        JOIN entities e ON e.parent_entity_id = d.id
        WHERE e.deleted_at IS NULL
    )
    SELECT d.id, e.display_name, d.lvl
    FROM descendants d
    JOIN entities e ON e.id = d.id
    ORDER BY d.lvl;
END;
$$ LANGUAGE plpgsql;

-- Get entities connected via relationships (graph edges, not hierarchy)
CREATE OR REPLACE FUNCTION get_related_entities(
    p_entity_id UUID,
    p_relationship_type VARCHAR(100) DEFAULT NULL,
    p_direction VARCHAR(10) DEFAULT 'both'  -- 'outgoing', 'incoming', 'both'
)
RETURNS TABLE (
    related_entity_id UUID,
    related_entity_name VARCHAR(500),
    relationship_id UUID,
    relationship_type VARCHAR(100),
    direction VARCHAR(10)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE WHEN r.source_entity_id = p_entity_id THEN r.target_entity_id ELSE r.source_entity_id END,
        e.display_name,
        r.id,
        rt.name,
        CASE WHEN r.source_entity_id = p_entity_id THEN 'outgoing'::VARCHAR(10) ELSE 'incoming'::VARCHAR(10) END
    FROM relationships r
    JOIN relationship_types rt ON r.relationship_type_id = rt.id
    JOIN entities e ON e.id = CASE 
        WHEN r.source_entity_id = p_entity_id THEN r.target_entity_id 
        ELSE r.source_entity_id 
    END
    WHERE e.deleted_at IS NULL
      AND (p_relationship_type IS NULL OR rt.name = p_relationship_type)
      AND (
          (p_direction IN ('outgoing', 'both') AND r.source_entity_id = p_entity_id)
          OR (p_direction IN ('incoming', 'both') AND r.target_entity_id = p_entity_id)
      );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED CORE CLASSES
-- ============================================================================

-- Seed "Context" as the root abstract class for context hierarchy
INSERT INTO classes (name, description, version_id, is_abstract)
SELECT 'Context', 'Base class for all context entities (Campaign, Operation, Mission, Task)', 
       id, TRUE
FROM ontology_versions WHERE is_current = TRUE
ON CONFLICT DO NOTHING;

-- Seed "ExternalInfluence" abstract class
INSERT INTO classes (name, description, version_id, is_abstract)
SELECT 'ExternalInfluence', 'Base class for external influences (political, environmental, intelligence)',
       id, TRUE
FROM ontology_versions WHERE is_current = TRUE
ON CONFLICT DO NOTHING;
