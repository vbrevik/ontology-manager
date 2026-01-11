-- Add context approval workflow to entities
DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE entities 
ADD COLUMN IF NOT EXISTS approval_status approval_status NOT NULL DEFAULT 'APPROVED',
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Root entities (contexts) should default to PENDING if they are top-level
-- However, existing entities should probably be APPROVED to avoid breaking things.
-- We will handle the "PENDING" logic in the application code for new root entities.

-- Update existing root entities to be APPROVED if we want (they already are by default)
UPDATE entities SET approval_status = 'APPROVED' WHERE parent_entity_id IS NULL;
