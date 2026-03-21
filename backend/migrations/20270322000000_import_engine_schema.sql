-- Import Engine Schema Changes
-- Part A: Add is_system column to classes
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Part B: Create source_conflicts table for tracking conflicts between base and extension sources
CREATE TABLE IF NOT EXISTS source_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_source_id TEXT NOT NULL,
    extension_source_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    resolution TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_conflicts_base
    ON source_conflicts (base_source_id);
CREATE INDEX IF NOT EXISTS idx_source_conflicts_extension
    ON source_conflicts (extension_source_id);
