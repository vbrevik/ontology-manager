-- Migration: Unify Security Ontology
-- Created: 2026-01-14
-- Description: Ports all legacy security data to ontology entities and relationships.

DO $$
DECLARE
    v_role_class_id UUID;
    v_permission_class_id UUID;
    v_user_class_id UUID;
    v_has_role_type_id UUID;
    v_grants_perm_type_id UUID;
    v_sys_version_id UUID;
BEGIN
    -- 1. Get metadata
    SELECT id INTO v_role_class_id FROM classes WHERE name = 'Role' LIMIT 1;
    SELECT id INTO v_permission_class_id FROM classes WHERE name = 'Permission' LIMIT 1;
    SELECT id INTO v_user_class_id FROM classes WHERE name = 'User' LIMIT 1;
    SELECT id INTO v_has_role_type_id FROM relationship_types WHERE name = 'has_role' LIMIT 1;
    SELECT id INTO v_grants_perm_type_id FROM relationship_types WHERE name = 'grants_permission' LIMIT 1;
    SELECT id INTO v_sys_version_id FROM ontology_versions WHERE version = 'system-v1' LIMIT 1;

    -- 2. Port Users (ensure IDs match)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        EXECUTE 'INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
        SELECT 
            u.id, 
            $1, 
            u.username, 
            jsonb_build_object(
                ''email'', u.email,
                ''username'', u.username
            ),
            ''APPROVED''::approval_status
        FROM users u
        WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = u.id)
        ON CONFLICT (id) DO UPDATE SET 
            attributes = EXCLUDED.attributes,
            display_name = EXCLUDED.display_name' USING v_user_class_id;
    END IF;

    -- 3. Port Roles (if not already there)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') THEN
        EXECUTE 'INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
        SELECT 
            r.id, 
            $1, 
            r.name, 
            jsonb_build_object(
                ''name'', r.name,
                ''description'', r.description,
                ''level'', r.level
            ),
            ''APPROVED''::approval_status
        FROM roles r
        WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = r.id)
        ON CONFLICT (id) DO UPDATE SET 
            attributes = EXCLUDED.attributes,
            display_name = EXCLUDED.display_name' USING v_role_class_id;
    END IF;

    -- 4. Port Permission Types (ReBAC definitions)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permission_types') THEN
        EXECUTE 'INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
        SELECT 
            pt.id, 
            $1, 
            pt.name, 
            jsonb_build_object(
                ''name'', pt.name,
                ''description'', pt.description,
                ''level'', pt.level
            ),
            ''APPROVED''::approval_status
        FROM permission_types pt
        WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = pt.id)
        ON CONFLICT (id) DO UPDATE SET 
            attributes = EXCLUDED.attributes,
            display_name = EXCLUDED.display_name' USING v_permission_class_id;
    END IF;

    -- 5. Handle ABAC "actions" that don't have a PermissionType
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions') THEN
        EXECUTE 'INSERT INTO entities (class_id, display_name, attributes, approval_status)
        SELECT DISTINCT 
            $1, 
            action, 
            jsonb_build_object(''name'', action, ''level'', 0),
            ''APPROVED''::approval_status
        FROM permissions p
        WHERE action NOT IN (SELECT name FROM permission_types)
          AND NOT EXISTS (
              SELECT 1 FROM entities e 
              WHERE e.display_name = p.action 
                AND e.class_id = $1
          )' USING v_permission_class_id;
    END IF;

    -- 6. Port Role -> Permission Mappings (ReBAC)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permission_types') THEN
        EXECUTE 'INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata)
        SELECT DISTINCT ON (role_id, permission_type_id)
            role_id, 
            permission_type_id, 
            $1,
            jsonb_build_object(''effect'', COALESCE(effect, ''ALLOW''))
        FROM role_permission_types
        ORDER BY role_id, permission_type_id, created_at DESC
        ON CONFLICT (source_entity_id, target_entity_id, relationship_type_id) DO UPDATE SET
            metadata = EXCLUDED.metadata' USING v_grants_perm_type_id;
    END IF;

    -- 7. Port Role -> Action Mappings (ABAC)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions') THEN
        EXECUTE 'INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata)
        SELECT DISTINCT ON (p.role_id, e.id)
            p.role_id, 
            e.id, 
            $1,
            jsonb_build_object(''effect'', COALESCE(p.effect, ''ALLOW''))
        FROM permissions p
        JOIN entities e ON e.display_name = p.action AND e.class_id = $2
        ON CONFLICT (source_entity_id, target_entity_id, relationship_type_id) DO NOTHING' USING v_grants_perm_type_id, v_permission_class_id;
    END IF;

    -- 8. Port User -> Role Assignments (Scoped Roles)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scoped_user_roles') THEN
        EXECUTE 'INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata)
        SELECT DISTINCT ON (user_id, role_id)
            user_id, 
            role_id, 
            $1,
            jsonb_build_object(
                ''scope_entity_id'', CASE WHEN scope_entity_id IS NOT NULL THEN scope_entity_id::text ELSE NULL END,
                ''valid_from'', CASE WHEN valid_from IS NOT NULL THEN valid_from::text ELSE NULL END,
                ''valid_until'', CASE WHEN valid_until IS NOT NULL THEN valid_until::text ELSE NULL END,
                ''schedule_cron'', schedule_cron,
                ''is_deny'', COALESCE(is_deny, false),
                ''granted_at'', CASE WHEN granted_at IS NOT NULL THEN granted_at::text ELSE NULL END
            )
        FROM scoped_user_roles
        WHERE user_id IN (SELECT id FROM entities)
        ORDER BY user_id, role_id, granted_at DESC
        ON CONFLICT (source_entity_id, target_entity_id, relationship_type_id) DO UPDATE SET
            metadata = EXCLUDED.metadata' USING v_has_role_type_id;
    END IF;

    -- 9. Port legacy User Roles (ABAC user_roles)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
        EXECUTE 'INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata)
        SELECT DISTINCT ON (user_id, role_id)
            user_id, 
            role_id, 
            $1,
            jsonb_build_object(
                ''scope_entity_id'', CASE WHEN resource_id IS NOT NULL THEN resource_id::text ELSE NULL END,
                ''is_deny'', false
            )
        FROM user_roles
        WHERE user_id IN (SELECT id FROM entities)
        ON CONFLICT (source_entity_id, target_entity_id, relationship_type_id) DO NOTHING' USING v_has_role_type_id;
    END IF;

END $$;
