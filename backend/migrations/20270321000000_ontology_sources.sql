-- ============================================================================
-- ONTOLOGY SOURCES: Multi-source ontology data infrastructure
-- ============================================================================
-- Enables the ontology-manager to work with multiple external ontology data
-- sources. Each source is a directory on disk containing a manifest.json.
-- Ontology entries (classes, properties, relationship_types) are tagged with
-- a source_id to track which source they came from.
-- ============================================================================

-- 1. Create ontology_sources table (global, no tenant_id)
CREATE TABLE IF NOT EXISTS ontology_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL UNIQUE,          -- natural key matching sources.json id
    name TEXT NOT NULL,
    description TEXT,
    version TEXT,
    format TEXT NOT NULL,                    -- "json" or "json-schema"
    domain TEXT,
    path TEXT NOT NULL,                      -- symlink path (not canonical)
    is_base BOOLEAN NOT NULL DEFAULT FALSE,
    is_extension BOOLEAN NOT NULL DEFAULT FALSE,
    imported_at TIMESTAMPTZ,
    stats JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_not_both_base_and_extension CHECK (NOT (is_base AND is_extension))
);

-- 2. Partial unique indexes: at most one base, at most one extension
CREATE UNIQUE INDEX IF NOT EXISTS idx_ontology_sources_base
    ON ontology_sources (is_base) WHERE is_base = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ontology_sources_extension
    ON ontology_sources (is_extension) WHERE is_extension = TRUE;

-- 3. Add source_id column to existing ontology tables
ALTER TABLE classes ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE relationship_types ADD COLUMN IF NOT EXISTS source_id TEXT;

-- 4. Add indexes on source_id for query performance
CREATE INDEX IF NOT EXISTS idx_classes_source_id ON classes(source_id);
CREATE INDEX IF NOT EXISTS idx_properties_source_id ON properties(source_id);
CREATE INDEX IF NOT EXISTS idx_relationship_types_source_id ON relationship_types(source_id);

-- 5. Replace unique constraint on classes with NULL-safe partial indexes
-- PostgreSQL treats NULL as distinct in unique constraints, so we need two
-- partial indexes: one for built-in (NULL source_id), one for imported.
ALTER TABLE classes DROP CONSTRAINT IF EXISTS unique_class_name_tenant_version;

CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_unique_builtin
    ON classes (name, tenant_id, version_id) WHERE source_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_unique_source
    ON classes (name, tenant_id, version_id, source_id) WHERE source_id IS NOT NULL;

-- 6. Replace unique constraint on properties
ALTER TABLE properties DROP CONSTRAINT IF EXISTS unique_property_name_class;

CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_unique_builtin
    ON properties (name, class_id) WHERE source_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_unique_source
    ON properties (name, class_id, source_id) WHERE source_id IS NOT NULL;

-- 7. Replace unique constraint on relationship_types
ALTER TABLE relationship_types DROP CONSTRAINT IF EXISTS relationship_types_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_relationship_types_unique_builtin
    ON relationship_types (name) WHERE source_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_relationship_types_unique_source
    ON relationship_types (name, source_id) WHERE source_id IS NOT NULL;
