-- Refine Ontology Versioning with Status and Lineage
-- Introducing DRAFT, PUBLISHED, ARCHIVED status workflow.

-- 1. Create Enum Type for Status
DO $$ BEGIN
    CREATE TYPE ontology_version_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add columns to ontology_versions
ALTER TABLE ontology_versions ADD COLUMN status ontology_version_status DEFAULT 'DRAFT';
ALTER TABLE ontology_versions ADD COLUMN cloned_from_id UUID REFERENCES ontology_versions(id) ON DELETE SET NULL;

-- 3. Migrate existing data
UPDATE ontology_versions SET status = 'PUBLISHED' WHERE is_current = TRUE;
UPDATE ontology_versions SET status = 'ARCHIVED' WHERE is_current = FALSE;

-- 4. Constraint: Ensure status is not null
ALTER TABLE ontology_versions ALTER COLUMN status SET NOT NULL;

-- 5. Index for performance
CREATE INDEX idx_ontology_versions_status ON ontology_versions(status);
