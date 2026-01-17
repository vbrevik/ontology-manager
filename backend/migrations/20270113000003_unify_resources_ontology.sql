-- Migration: Unify Resources Ontology
-- Description: Migrates legacy resources to the ontology 'Resource' class and creates a unified view.

DO $$
DECLARE
    v_resource_class_id UUID;
BEGIN
    -- 1. Get Resource class metadata
    SELECT id INTO v_resource_class_id FROM classes WHERE name = 'Resource' LIMIT 1;

    IF v_resource_class_id IS NOT NULL THEN
        -- 2. Sync existing data from legacy 'resources' table to ontology 'entities'
        -- We insert missing resources into entities
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resources') THEN
            INSERT INTO entities (id, class_id, display_name, attributes, approval_status, created_at)
            SELECT 
                id, 
                v_resource_class_id, 
                name, 
                jsonb_build_object('resource_type', resource_type),
                'APPROVED'::approval_status,
                created_at
            FROM resources
            ON CONFLICT (id) DO UPDATE SET
                attributes = entities.attributes || EXCLUDED.attributes,
                updated_at = NOW();
        END IF;
    END IF;
END $$;

-- 3. Create public view for services
CREATE OR REPLACE VIEW unified_resources AS
SELECT 
    e.id, 
    e.display_name as name, 
    e.attributes->>'resource_type' as resource_type,
    e.created_at,
    e.updated_at,
    e.tenant_id
FROM entities e
JOIN classes c ON e.class_id = c.id
WHERE c.name = 'Resource' AND e.deleted_at IS NULL;
