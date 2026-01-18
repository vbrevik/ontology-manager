-- Migration: Grant Project Permissions to Authenticated Users
-- Description: Creates a "user" role and grants project permissions to enable E2E tests

DO $$
DECLARE
    v_version_id UUID;
    v_role_class_id UUID;
    v_permission_class_id UUID;
    v_user_role_id UUID;
    v_editor_role_id UUID;
    v_has_permission_rt_id UUID;
    v_project_create_perm_id UUID;
    v_project_read_perm_id UUID;
    v_project_update_perm_id UUID;
    v_project_delete_perm_id UUID;
    v_project_manage_members_perm_id UUID;
    v_task_create_perm_id UUID;
    v_task_read_perm_id UUID;
    v_task_update_perm_id UUID;
    v_task_delete_perm_id UUID;
BEGIN
    -- Get system version
    SELECT id INTO v_version_id FROM ontology_versions WHERE is_system = TRUE LIMIT 1;
    
    IF v_version_id IS NULL THEN
        RAISE EXCEPTION 'System ontology version not found';
    END IF;
    
    -- Get class IDs
    SELECT id INTO v_role_class_id FROM classes WHERE name = 'Role';
    SELECT id INTO v_permission_class_id FROM classes WHERE name = 'Permission';
    
    -- Get or create "has_permission" relationship type
    SELECT id INTO v_has_permission_rt_id 
    FROM relationship_types 
    WHERE name = 'has_permission';
    
    IF v_has_permission_rt_id IS NULL THEN
        INSERT INTO relationship_types (id, name, description, allowed_source_class_id, allowed_target_class_id)
        VALUES (
            gen_random_uuid(),
            'has_permission',
            'Role has this permission',
            v_role_class_id,
            v_permission_class_id
        )
        RETURNING id INTO v_has_permission_rt_id;
    END IF;
    
    -- ========================================================================
    -- Create "user" role for authenticated users
    -- ========================================================================
    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-600000000001',
        v_role_class_id,
        'user',
        '{"name": "user", "description": "Basic authenticated user with project creation privileges", "level": 10}'::jsonb,
        'APPROVED'
    ) ON CONFLICT (id) DO UPDATE
    SET attributes = EXCLUDED.attributes
    RETURNING id INTO v_user_role_id;
    
    -- Get editor role ID
    SELECT id INTO v_editor_role_id 
    FROM entities 
    WHERE class_id = v_role_class_id 
    AND display_name = 'editor';
    
    -- ========================================================================
    -- Get permission entity IDs
    -- ========================================================================
    SELECT id INTO v_project_create_perm_id FROM entities 
    WHERE class_id = v_permission_class_id AND display_name = 'project.create';
    
    SELECT id INTO v_project_read_perm_id FROM entities 
    WHERE class_id = v_permission_class_id AND display_name = 'project.read';
    
    SELECT id INTO v_project_update_perm_id FROM entities 
    WHERE class_id = v_permission_class_id AND display_name = 'project.update';
    
    SELECT id INTO v_project_delete_perm_id FROM entities 
    WHERE class_id = v_permission_class_id AND display_name = 'project.delete';
    
    SELECT id INTO v_project_manage_members_perm_id FROM entities 
    WHERE class_id = v_permission_class_id AND display_name = 'project.manage_members';
    
    SELECT id INTO v_task_create_perm_id FROM entities 
    WHERE class_id = v_permission_class_id AND display_name = 'task.create';
    
    SELECT id INTO v_task_read_perm_id FROM entities 
    WHERE class_id = v_permission_class_id AND display_name = 'task.read';
    
    SELECT id INTO v_task_update_perm_id FROM entities 
    WHERE class_id = v_permission_class_id AND display_name = 'task.update';
    
    SELECT id INTO v_task_delete_perm_id FROM entities 
    WHERE class_id = v_permission_class_id AND display_name = 'task.delete';
    
    -- ========================================================================
    -- Grant project permissions to "user" role
    -- ========================================================================
    IF v_user_role_id IS NOT NULL THEN
        -- project.create
        IF v_project_create_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_user_role_id, v_project_create_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- project.read
        IF v_project_read_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_user_role_id, v_project_read_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- project.update
        IF v_project_update_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_user_role_id, v_project_update_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- project.delete
        IF v_project_delete_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_user_role_id, v_project_delete_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- task.create
        IF v_task_create_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_user_role_id, v_task_create_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- task.read
        IF v_task_read_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_user_role_id, v_task_read_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    
    -- ========================================================================
    -- Also grant permissions to "editor" role
    -- ========================================================================
    IF v_editor_role_id IS NOT NULL THEN
        -- project.create
        IF v_project_create_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_editor_role_id, v_project_create_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- project.read
        IF v_project_read_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_editor_role_id, v_project_read_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- project.update
        IF v_project_update_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_editor_role_id, v_project_update_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- project.delete
        IF v_project_delete_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_editor_role_id, v_project_delete_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- task.create
        IF v_task_create_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_editor_role_id, v_task_create_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- task.read
        IF v_task_read_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_editor_role_id, v_task_read_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- task.update
        IF v_task_update_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_editor_role_id, v_task_update_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- task.delete
        IF v_task_delete_perm_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_permission_rt_id, v_editor_role_id, v_task_delete_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    
    RAISE NOTICE 'Created "user" role and granted project permissions';
    RAISE NOTICE 'Users must be assigned "user" or "editor" role to create projects';
    
END $$;

-- ========================================================================
-- Auto-assign "user" role to all existing users without roles
-- ========================================================================
DO $$
DECLARE
    v_user_role_id UUID;
    v_user_class_id UUID;
    v_has_role_rt_id UUID;
    user_record RECORD;
BEGIN
    -- Get user role ID
    SELECT id INTO v_user_role_id 
    FROM entities 
    WHERE display_name = 'user' 
    AND class_id = (SELECT id FROM classes WHERE name = 'Role');
    
    -- Get User class ID
    SELECT id INTO v_user_class_id FROM classes WHERE name = 'User';
    
    -- Get or create "has_role" relationship type
    SELECT id INTO v_has_role_rt_id 
    FROM relationship_types 
    WHERE name = 'has_role';
    
    IF v_has_role_rt_id IS NULL THEN
        INSERT INTO relationship_types (id, name, description, allowed_source_class_id, allowed_target_class_id)
        VALUES (
            gen_random_uuid(),
            'has_role',
            'User has this role',
            v_user_class_id,
            (SELECT id FROM classes WHERE name = 'Role')
        )
        RETURNING id INTO v_has_role_rt_id;
    END IF;
    
    -- Assign "user" role to all users who don't have any roles yet
    IF v_user_role_id IS NOT NULL AND v_has_role_rt_id IS NOT NULL THEN
        FOR user_record IN 
            SELECT e.id as user_id
            FROM entities e
            WHERE e.class_id = v_user_class_id
            AND e.deleted_at IS NULL
            AND NOT EXISTS (
                SELECT 1 FROM relationships r
                WHERE r.source_entity_id = e.id
                AND r.relationship_type_id = v_has_role_rt_id
            )
        LOOP
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_role_rt_id, user_record.user_id, v_user_role_id)
            ON CONFLICT DO NOTHING;
            
            RAISE NOTICE 'Assigned "user" role to user %', user_record.user_id;
        END LOOP;
    END IF;
    
END $$;

-- ========================================================================
-- Create helper function to auto-assign role on user registration
-- ========================================================================
CREATE OR REPLACE FUNCTION auto_assign_user_role()
RETURNS TRIGGER AS $$
DECLARE
    v_user_role_id UUID;
    v_has_role_rt_id UUID;
BEGIN
    -- Only process inserts for User class entities
    IF TG_OP = 'INSERT' AND NEW.class_id = (SELECT id FROM classes WHERE name = 'User') THEN
        -- Get user role ID
        SELECT id INTO v_user_role_id 
        FROM entities 
        WHERE display_name = 'user' 
        AND class_id = (SELECT id FROM classes WHERE name = 'Role')
        LIMIT 1;
        
        -- Get has_role relationship type
        SELECT id INTO v_has_role_rt_id 
        FROM relationship_types 
        WHERE name = 'has_role'
        LIMIT 1;
        
        -- Auto-assign user role if both exist
        IF v_user_role_id IS NOT NULL AND v_has_role_rt_id IS NOT NULL THEN
            INSERT INTO relationships (id, relationship_type_id, source_entity_id, target_entity_id)
            VALUES (gen_random_uuid(), v_has_role_rt_id, NEW.id, v_user_role_id)
            ON CONFLICT DO NOTHING;
            
            RAISE NOTICE 'Auto-assigned "user" role to new user %', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-assignment
DROP TRIGGER IF EXISTS trigger_auto_assign_user_role ON entities;
CREATE TRIGGER trigger_auto_assign_user_role
    AFTER INSERT ON entities
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_user_role();

COMMENT ON FUNCTION auto_assign_user_role() IS 'Automatically assigns "user" role to newly created user entities';
