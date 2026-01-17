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
    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    SELECT 
        u.id, 
        v_user_class_id, 
        u.username, 
        jsonb_build_object(
            'email', u.email,
            'username', u.username
        ),
        'APPROVED'::approval_status
    FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = u.id)
    ON CONFLICT (id) DO UPDATE SET 
        attributes = EXCLUDED.attributes,
        display_name = EXCLUDED.display_name;

    -- 3. Port Roles (if not already there)
    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    SELECT 
        r.id, 
        v_role_class_id, 
        r.name, 
        jsonb_build_object(
            'name', r.name,
            'description', r.description,
            'level', r.level
        ),
        'APPROVED'::approval_status
    FROM roles r
    WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = r.id)
    ON CONFLICT (id) DO UPDATE SET 
        attributes = EXCLUDED.attributes,
        display_name = EXCLUDED.display_name;

    -- 4. Port Permission Types (ReBAC definitions)
    INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
    SELECT 
        pt.id, 
        v_permission_class_id, 
        pt.name, 
        jsonb_build_object(
            'name', pt.name,
            'description', pt.description,
            'level', pt.level
        ),
        'APPROVED'::approval_status
    FROM permission_types pt
    WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = pt.id)
    ON CONFLICT (id) DO UPDATE SET 
        attributes = EXCLUDED.attributes,
        display_name = EXCLUDED.display_name;

    -- 5. Handle ABAC "actions" that don't have a PermissionType
    INSERT INTO entities (class_id, display_name, attributes, approval_status)
    SELECT DISTINCT 
        v_permission_class_id, 
        action, 
        jsonb_build_object('name', action, 'level', 0),
        'APPROVED'::approval_status
    FROM permissions p
    WHERE action NOT IN (SELECT name FROM permission_types)
      AND NOT EXISTS (
          SELECT 1 FROM entities e 
          WHERE e.display_name = p.action 
            AND e.class_id = v_permission_class_id
      );

    -- 6. Port Role -> Permission Mappings (ReBAC)
    INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata)
    SELECT DISTINCT ON (role_id, permission_type_id)
        role_id, 
        permission_type_id, 
        v_grants_perm_type_id,
        jsonb_build_object('effect', COALESCE(effect, 'ALLOW'))
    FROM role_permission_types
    ORDER BY role_id, permission_type_id, created_at DESC
    ON CONFLICT (source_entity_id, target_entity_id, relationship_type_id) DO UPDATE SET
        metadata = EXCLUDED.metadata;

    -- 7. Port Role -> Action Mappings (ABAC)
    INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata)
    SELECT DISTINCT ON (p.role_id, e.id)
        p.role_id, 
        e.id, 
        v_grants_perm_type_id,
        jsonb_build_object('effect', COALESCE(p.effect, 'ALLOW'))
    FROM permissions p
    JOIN entities e ON e.display_name = p.action AND e.class_id = v_permission_class_id
    ON CONFLICT (source_entity_id, target_entity_id, relationship_type_id) DO NOTHING;

    -- 8. Port User -> Role Assignments (Scoped Roles)
    INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata)
    SELECT DISTINCT ON (user_id, role_id)
        user_id, 
        role_id, 
        v_has_role_type_id,
        jsonb_build_object(
            'scope_entity_id', CASE WHEN scope_entity_id IS NOT NULL THEN scope_entity_id::text ELSE NULL END,
            'valid_from', CASE WHEN valid_from IS NOT NULL THEN valid_from::text ELSE NULL END,
            'valid_until', CASE WHEN valid_until IS NOT NULL THEN valid_until::text ELSE NULL END,
            'schedule_cron', schedule_cron,
            'is_deny', COALESCE(is_deny, false),
            'granted_at', CASE WHEN granted_at IS NOT NULL THEN granted_at::text ELSE NULL END
        )
    FROM scoped_user_roles
    WHERE user_id IN (SELECT id FROM entities)
    ORDER BY user_id, role_id, granted_at DESC
    ON CONFLICT (source_entity_id, target_entity_id, relationship_type_id) DO UPDATE SET
        metadata = EXCLUDED.metadata;

    -- 9. Port legacy User Roles (ABAC user_roles)
    INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata)
    SELECT DISTINCT ON (user_id, role_id)
        user_id, 
        role_id, 
        v_has_role_type_id,
        jsonb_build_object(
            'scope_entity_id', CASE WHEN resource_id IS NOT NULL THEN resource_id::text ELSE NULL END,
            'is_deny', false
        )
    FROM user_roles
    WHERE user_id IN (SELECT id FROM entities)
    ON CONFLICT (source_entity_id, target_entity_id, relationship_type_id) DO NOTHING;

END $$;
