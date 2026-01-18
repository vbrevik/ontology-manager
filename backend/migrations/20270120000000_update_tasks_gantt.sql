-- Migration: Gantt Support for Projects
-- Description: Adds start_date to tasks and depends_on relationship type

DO $$
DECLARE
    v_version_id UUID;
    v_task_class_id UUID;
BEGIN
    -- Get system version
    SELECT id INTO v_version_id FROM ontology_versions WHERE is_system = TRUE LIMIT 1;
    
    -- Get Task class ID
    SELECT id INTO v_task_class_id FROM classes WHERE name = 'Task';

    -- Add start_date property to Task if not exists
    IF v_task_class_id IS NOT NULL AND v_version_id IS NOT NULL THEN
        INSERT INTO properties (id, class_id, name, data_type, is_required, is_unique, description, version_id)
        VALUES (
            'a1b2c3d4-e5f6-7890-abcd-300000000007',
            v_task_class_id,
            'start_date',
            'date',
            FALSE,
            FALSE,
            'Task start date',
            v_version_id
        ) ON CONFLICT (name, class_id) DO NOTHING;
    END IF;

    -- Add depends_on relationship type (Task -> Task)
    IF v_task_class_id IS NOT NULL THEN
        INSERT INTO relationship_types (id, name, description, allowed_source_class_id, allowed_target_class_id)
        VALUES (
            'a1b2c3d4-e5f6-7890-abcd-400000000005',
            'depends_on',
            'Task depends on another task (A depends_on B means B must finish before A)',
            v_task_class_id,
            v_task_class_id
        ) ON CONFLICT (name) DO NOTHING;
    END IF;

END $$;

-- Update unified_tasks view to include start_date
DROP VIEW IF EXISTS unified_tasks CASCADE;
CREATE OR REPLACE VIEW unified_tasks AS
SELECT 
    e.id,
    e.display_name as title,
    e.attributes->>'description' as description,
    COALESCE(e.attributes->>'status', 'todo') as status,
    COALESCE(e.attributes->>'priority', 'medium') as priority,
    (e.attributes->>'start_date')::date as start_date,
    (e.attributes->>'due_date')::date as due_date,
    (e.attributes->>'estimated_hours')::numeric as estimated_hours,
    e.created_at,
    e.updated_at,
    e.tenant_id,
    -- Project derived from relationship
    (SELECT r.source_entity_id FROM relationships r 
     JOIN relationship_types rt ON r.relationship_type_id = rt.id 
     WHERE rt.name = 'has_task' AND r.target_entity_id = e.id 
     LIMIT 1) as project_id,
    -- Assignee derived from relationship
    (SELECT r.target_entity_id FROM relationships r 
     JOIN relationship_types rt ON r.relationship_type_id = rt.id 
     WHERE rt.name = 'assigned_to' AND r.source_entity_id = e.id 
     LIMIT 1) as assignee_id
FROM entities e
JOIN classes c ON e.class_id = c.id
WHERE c.name = 'Task' AND e.deleted_at IS NULL;
