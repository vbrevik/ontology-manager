-- Migration: Projects Module Ontology
-- Description: Creates Project and Task classes with properties and relationship types

-- ============================================================================
-- Get the current version ID for properties
-- ============================================================================
DO $$
DECLARE
    v_version_id UUID;
    v_project_class_id UUID;
    v_task_class_id UUID;
    v_user_class_id UUID;
    v_permission_class_id UUID;
BEGIN
    -- Get system version
    SELECT id INTO v_version_id FROM ontology_versions WHERE is_system = TRUE LIMIT 1;
    
    IF v_version_id IS NULL THEN
        RAISE EXCEPTION 'System ontology version not found';
    END IF;
    
    -- Get User and Permission class IDs
    SELECT id INTO v_user_class_id FROM classes WHERE name = 'User';
    SELECT id INTO v_permission_class_id FROM classes WHERE name = 'Permission';

    -- ========================================================================
    -- PHASE 1: Create Project and Task Classes
    -- ========================================================================

    -- Project Class (only insert if not exists)
    IF NOT EXISTS (SELECT 1 FROM classes WHERE name = 'Project') THEN
        INSERT INTO classes (id, name, description, is_abstract, parent_class_id, version_id)
        VALUES (
            'a1b2c3d4-e5f6-7890-abcd-100000000001',
            'Project',
            'A project container for organizing work and team collaboration',
            FALSE,
            NULL,
            v_version_id
        );
    END IF;

    SELECT id INTO v_project_class_id FROM classes WHERE name = 'Project';

    -- Task Class (only insert if not exists)
    IF NOT EXISTS (SELECT 1 FROM classes WHERE name = 'Task') THEN
        INSERT INTO classes (id, name, description, is_abstract, parent_class_id, version_id)
        VALUES (
            'a1b2c3d4-e5f6-7890-abcd-100000000002',
            'Task',
            'A work item or task within a project',
            FALSE,
            NULL,
            v_version_id
        );
    END IF;

    SELECT id INTO v_task_class_id FROM classes WHERE name = 'Task';

    -- ========================================================================
    -- PHASE 2: Create Properties for Project
    -- ========================================================================

    INSERT INTO properties (id, class_id, name, data_type, is_required, is_unique, description, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-200000000001',
        v_project_class_id,
        'name',
        'string',
        TRUE,
        FALSE,
        'Project name',
        v_version_id
    ) ON CONFLICT (name, class_id) DO NOTHING;

    INSERT INTO properties (id, class_id, name, data_type, is_required, is_unique, description, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-200000000002',
        v_project_class_id,
        'description',
        'text',
        FALSE,
        FALSE,
        'Project description',
        v_version_id
    ) ON CONFLICT (name, class_id) DO NOTHING;

    INSERT INTO properties (id, class_id, name, data_type, is_required, is_unique, description, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-200000000003',
        v_project_class_id,
        'status',
        'string',
        TRUE,
        FALSE,
        'Project status: planning, active, on_hold, completed, archived',
        v_version_id
    ) ON CONFLICT (name, class_id) DO NOTHING;

    INSERT INTO properties (id, class_id, name, data_type, is_required, is_unique, description, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-200000000004',
        v_project_class_id,
        'start_date',
        'date',
        FALSE,
        FALSE,
        'Project start date',
        v_version_id
    ) ON CONFLICT (name, class_id) DO NOTHING;

    INSERT INTO properties (id, class_id, name, data_type, is_required, is_unique, description, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-200000000005',
        v_project_class_id,
        'end_date',
        'date',
        FALSE,
        FALSE,
        'Project end date',
        v_version_id
    ) ON CONFLICT (name, class_id) DO NOTHING;

    -- (Budget property removed)

    -- ========================================================================
    -- PHASE 3: Create Properties for Task
    -- ========================================================================

    INSERT INTO properties (id, class_id, name, data_type, is_required, is_unique, description, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000001',
        v_task_class_id,
        'title',
        'string',
        TRUE,
        FALSE,
        'Task title',
        v_version_id
    ) ON CONFLICT (name, class_id) DO NOTHING;

    INSERT INTO properties (id, class_id, name, data_type, is_required, is_unique, description, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000002',
        v_task_class_id,
        'description',
        'text',
        FALSE,
        FALSE,
        'Task description',
        v_version_id
    ) ON CONFLICT (name, class_id) DO NOTHING;

    INSERT INTO properties (id, class_id, name, data_type, is_required, is_unique, description, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000003',
        v_task_class_id,
        'status',
        'string',
        TRUE,
        FALSE,
        'Task status: todo, in_progress, blocked, done',
        v_version_id
    ) ON CONFLICT (name, class_id) DO NOTHING;

    INSERT INTO properties (id, class_id, name, data_type, is_required, is_unique, description, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000004',
        v_task_class_id,
        'priority',
        'string',
        FALSE,
        FALSE,
        'Task priority: low, medium, high, critical',
        v_version_id
    ) ON CONFLICT (name, class_id) DO NOTHING;

    INSERT INTO properties (id, class_id, name, data_type, is_required, is_unique, description, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000005',
        v_task_class_id,
        'due_date',
        'date',
        FALSE,
        FALSE,
        'Task due date',
        v_version_id
    ) ON CONFLICT (name, class_id) DO NOTHING;

    INSERT INTO properties (id, class_id, name, data_type, is_required, is_unique, description, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000006',
        v_task_class_id,
        'estimated_hours',
        'number',
        FALSE,
        FALSE,
        'Estimated hours to complete task',
        v_version_id
    ) ON CONFLICT (name, class_id) DO NOTHING;

    -- ========================================================================
    -- PHASE 4: Create Relationship Types
    -- ========================================================================

    -- owns_project: User -> Project
    INSERT INTO relationship_types (id, name, description, allowed_source_class_id, allowed_target_class_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000001',
        'owns_project',
        'User owns/created this project',
        v_user_class_id,
        v_project_class_id
    ) ON CONFLICT (name) DO NOTHING;

    -- member_of_project: User -> Project
    INSERT INTO relationship_types (id, name, description, allowed_source_class_id, allowed_target_class_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000002',
        'member_of_project',
        'User is a member of this project',
        v_user_class_id,
        v_project_class_id
    ) ON CONFLICT (name) DO NOTHING;

    -- has_task: Project -> Task
    INSERT INTO relationship_types (id, name, description, allowed_source_class_id, allowed_target_class_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000003',
        'has_task',
        'Project contains this task',
        v_project_class_id,
        v_task_class_id
    ) ON CONFLICT (name) DO NOTHING;

    -- assigned_to: Task -> User
    INSERT INTO relationship_types (id, name, description, allowed_source_class_id, allowed_target_class_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000004',
        'assigned_to',
        'Task is assigned to this user',
        v_task_class_id,
        v_user_class_id
    ) ON CONFLICT (name) DO NOTHING;

    -- ========================================================================
    -- PHASE 6: Create Permissions
    -- ========================================================================

    -- Project permissions
    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-500000000001',
        v_permission_class_id,
        'project.create',
        '{"name": "project.create", "description": "Create new projects"}'::jsonb,
        'APPROVED'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-500000000002',
        v_permission_class_id,
        'project.read',
        '{"name": "project.read", "description": "View projects"}'::jsonb,
        'APPROVED'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-500000000003',
        v_permission_class_id,
        'project.update',
        '{"name": "project.update", "description": "Update projects"}'::jsonb,
        'APPROVED'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-500000000004',
        v_permission_class_id,
        'project.delete',
        '{"name": "project.delete", "description": "Delete projects"}'::jsonb,
        'APPROVED'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-500000000005',
        v_permission_class_id,
        'project.manage_members',
        '{"name": "project.manage_members", "description": "Manage project team members"}'::jsonb,
        'APPROVED'
    ) ON CONFLICT (id) DO NOTHING;

    -- Task permissions
    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-500000000006',
        v_permission_class_id,
        'task.create',
        '{"name": "task.create", "description": "Create tasks"}'::jsonb,
        'APPROVED'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-500000000007',
        v_permission_class_id,
        'task.read',
        '{"name": "task.read", "description": "View tasks"}'::jsonb,
        'APPROVED'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-500000000008',
        v_permission_class_id,
        'task.update',
        '{"name": "task.update", "description": "Update tasks"}'::jsonb,
        'APPROVED'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-500000000009',
        v_permission_class_id,
        'task.delete',
        '{"name": "task.delete", "description": "Delete tasks"}'::jsonb,
        'APPROVED'
    ) ON CONFLICT (id) DO NOTHING;

END $$;

-- ============================================================================
-- PHASE 5: Create Unified Views (outside DO block for DDL)
-- ============================================================================

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
     LIMIT 1) as owner_id
FROM entities e
JOIN classes c ON e.class_id = c.id
WHERE c.name = 'Project' AND e.deleted_at IS NULL;

DROP VIEW IF EXISTS unified_tasks CASCADE;
CREATE OR REPLACE VIEW unified_tasks AS
SELECT 
    e.id,
    e.display_name as title,
    e.attributes->>'description' as description,
    COALESCE(e.attributes->>'status', 'todo') as status,
    COALESCE(e.attributes->>'priority', 'medium') as priority,
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
