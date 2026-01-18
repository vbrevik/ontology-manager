-- Migration: Sub-projects Support
-- Description: Adds has_sub_project relationship type and updates unified_projects view

DO $$
DECLARE
    v_project_class_id UUID;
BEGIN
    -- Get Project class ID
    SELECT id INTO v_project_class_id FROM classes WHERE name = 'Project';

    -- Add has_sub_project relationship type (Project -> Project)
    IF v_project_class_id IS NOT NULL THEN
        INSERT INTO relationship_types (id, name, description, allowed_source_class_id, allowed_target_class_id)
        VALUES (
            'a1b2c3d4-e5f6-7890-abcd-400000000006',
            'has_sub_project',
            'Project contains a sub-project',
            v_project_class_id,
            v_project_class_id
        ) ON CONFLICT (name) DO NOTHING;
    END IF;

END $$;

-- Update unified_projects view to include parent_project_id
DROP VIEW IF EXISTS unified_projects CASCADE;
CREATE OR REPLACE VIEW unified_projects AS
SELECT 
    e.id,
    e.display_name as name,
    e.attributes->>'description' as description,
    COALESCE(e.attributes->>'status', 'planning') as status,
    (e.attributes->>'start_date')::date as start_date,
    (e.attributes->>'end_date')::date as end_date,
    e.created_at,
    e.updated_at,
    e.tenant_id,
    -- Owner derived from relationship
    (SELECT r.source_entity_id FROM relationships r 
     JOIN relationship_types rt ON r.relationship_type_id = rt.id 
     WHERE rt.name = 'owns_project' AND r.target_entity_id = e.id 
     LIMIT 1) as owner_id,
    -- Parent project derived from relationship
    (SELECT r.source_entity_id FROM relationships r 
     JOIN relationship_types rt ON r.relationship_type_id = rt.id 
     WHERE rt.name = 'has_sub_project' AND r.target_entity_id = e.id 
     LIMIT 1) as parent_project_id
FROM entities e
JOIN classes c ON e.class_id = c.id
WHERE c.name = 'Project' AND e.deleted_at IS NULL;
