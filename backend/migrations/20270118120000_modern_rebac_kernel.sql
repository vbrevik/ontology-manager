-- Migration: Modern ReBAC Kernel with ABAC support
-- Created: 2026-01-18
-- Description: Unified ontology-based security kernel.

-- 1. Drop old functions to avoid ambiguity
DROP FUNCTION IF EXISTS public.check_entity_permission(uuid, uuid, character varying);
DROP FUNCTION IF EXISTS public.check_entity_permission(uuid, uuid, character varying, uuid);
DROP FUNCTION IF EXISTS public.get_accessible_entities(uuid, character varying);
DROP FUNCTION IF EXISTS public.get_accessible_entities(uuid, character varying, uuid);

-- 2. New Unified check_entity_permission
CREATE OR REPLACE FUNCTION public.check_entity_permission(
    p_user_id uuid,
    p_entity_id uuid,
    p_permission_name character varying,
    p_tenant_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
    has_permission boolean,
    granted_via_entity_id uuid,
    granted_via_role character varying,
    is_inherited boolean,
    is_denied boolean
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
    v_requested_level integer;
    v_now timestamp with time zone := now();
    v_has_role_type_id uuid;
    v_grants_perm_type_id uuid;
    v_permission_class_id uuid;
BEGIN
    -- Get metadata
    SELECT id INTO v_has_role_type_id FROM relationship_types WHERE name = 'has_role' LIMIT 1;
    SELECT id INTO v_grants_perm_type_id FROM relationship_types WHERE name = 'grants_permission' LIMIT 1;
    SELECT id INTO v_permission_class_id FROM classes WHERE name = 'Permission' LIMIT 1;

    -- Determine requested permission level
    SELECT (attributes->>'level')::integer INTO v_requested_level 
    FROM entities WHERE display_name = p_permission_name AND class_id = v_permission_class_id LIMIT 1;
    v_requested_level := COALESCE(v_requested_level, 0);

    RETURN QUERY
    WITH RECURSIVE graph_path AS (
        SELECT id, parent_entity_id, 0 as depth FROM entities
        WHERE id = p_entity_id AND deleted_at IS NULL AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
        UNION ALL
        SELECT e.id, e.parent_entity_id, gp.depth + 1 FROM entities e
        JOIN graph_path gp ON e.id = gp.parent_entity_id
        WHERE e.deleted_at IS NULL AND (p_tenant_id IS NULL OR e.tenant_id = p_tenant_id)
    ),
    applicable_roles AS (
        SELECT 
            r.target_entity_id as role_id,
            r.metadata->>'scope_entity_id' as scope_id_str,
            COALESCE((r.metadata->>'is_deny')::boolean, FALSE) as is_deny,
            e_role.display_name as role_name,
            gp.depth,
            CASE WHEN r.metadata->>'scope_entity_id' IS NULL THEN 1000 ELSE gp.depth END as specificity
        FROM relationships r
        JOIN entities e_role ON r.target_entity_id = e_role.id
        LEFT JOIN graph_path gp ON (r.metadata->>'scope_entity_id')::uuid = gp.id
        WHERE r.source_entity_id = p_user_id
          AND r.relationship_type_id = v_has_role_type_id
          AND (r.metadata->>'valid_from' IS NULL OR (r.metadata->>'valid_from')::timestamp with time zone <= v_now)
          AND (r.metadata->>'valid_until' IS NULL OR (r.metadata->>'valid_until')::timestamp with time zone > v_now)
          AND (r.metadata->>'scope_entity_id' IS NULL OR (r.metadata->>'scope_entity_id')::uuid IN (SELECT id FROM graph_path))
    ),
    roles_with_permission AS (
        -- ReBAC part
        SELECT ar.* FROM applicable_roles ar
        JOIN relationships rel_grant ON ar.role_id = rel_grant.source_entity_id
        JOIN entities e_perm ON rel_grant.target_entity_id = e_perm.id
        WHERE rel_grant.relationship_type_id = v_grants_perm_type_id
          AND (e_perm.display_name = p_permission_name OR COALESCE((e_perm.attributes->>'level')::integer, 0) >= v_requested_level OR e_perm.display_name = 'admin')
        UNION ALL
        -- ABAC part (Attribute filters to role)
        SELECT ar.* FROM applicable_roles ar
        JOIN entities e_role ON ar.role_id = e_role.id
        WHERE (e_role.attributes->'permissions' @> jsonb_build_array(p_permission_name))
           OR (e_role.attributes->>'is_admin')::boolean = TRUE
    )
    SELECT 
        COALESCE(CASE 
            WHEN EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = TRUE) THEN FALSE
            WHEN EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = FALSE) THEN TRUE
            ELSE FALSE
        END, FALSE),
        (SELECT (scope_id_str)::uuid FROM roles_with_permission WHERE is_deny = FALSE ORDER BY specificity ASC LIMIT 1),
        (SELECT role_name FROM roles_with_permission WHERE is_deny = FALSE ORDER BY specificity ASC LIMIT 1),
        (SELECT (scope_id_str)::uuid IS DISTINCT FROM p_entity_id FROM roles_with_permission WHERE is_deny = FALSE ORDER BY specificity ASC LIMIT 1),
        EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = TRUE);
END;
$function$;

-- 3. New Unified get_accessible_entities
CREATE OR REPLACE FUNCTION public.get_accessible_entities(
    p_user_id uuid,
    p_permission_name character varying,
    p_tenant_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE (
    entity_id uuid,
    entity_name character varying,
    class_name character varying,
    access_type character varying
) 
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
    v_requested_level integer;
    v_now timestamp with time zone := now();
    v_has_role_type_id uuid;
    v_grants_perm_type_id uuid;
    v_permission_class_id uuid;
BEGIN
    SELECT id INTO v_has_role_type_id FROM relationship_types WHERE name = 'has_role' LIMIT 1;
    SELECT id INTO v_grants_perm_type_id FROM relationship_types WHERE name = 'grants_permission' LIMIT 1;
    SELECT id INTO v_permission_class_id FROM classes WHERE name = 'Permission' LIMIT 1;

    SELECT (attributes->>'level')::integer INTO v_requested_level 
    FROM entities WHERE display_name = p_permission_name AND class_id = v_permission_class_id LIMIT 1;
    v_requested_level := COALESCE(v_requested_level, 0);

    RETURN QUERY
    WITH RECURSIVE 
    user_roles AS (
        SELECT 
            r.target_entity_id as role_id,
            (r.metadata->>'scope_entity_id')::uuid as scope_id,
            COALESCE((r.metadata->>'is_deny')::boolean, FALSE) as is_deny
        FROM relationships r
        WHERE r.source_entity_id = p_user_id
          AND r.relationship_type_id = v_has_role_type_id
          AND (r.metadata->>'valid_from' IS NULL OR (r.metadata->>'valid_from')::timestamp with time zone <= v_now)
          AND (r.metadata->>'valid_until' IS NULL OR (r.metadata->>'valid_until')::timestamp with time zone > v_now)
    ),
    authorized_scopes AS (
        SELECT ur.scope_id, ur.is_deny
        FROM user_roles ur
        WHERE EXISTS (
            SELECT 1 FROM relationships rel_grant
            JOIN entities e_perm ON rel_grant.target_entity_id = e_perm.id
            WHERE rel_grant.source_entity_id = ur.role_id
              AND rel_grant.relationship_type_id = v_grants_perm_type_id
              AND (e_perm.display_name = p_permission_name OR COALESCE((e_perm.attributes->>'level')::integer, 0) >= v_requested_level OR e_perm.display_name = 'admin')
            UNION ALL
            SELECT 1 FROM entities e_role 
            WHERE e_role.id = ur.role_id
              AND ((e_role.attributes->'permissions' @> jsonb_build_array(p_permission_name)) OR (e_role.attributes->>'is_admin')::boolean = TRUE)
        )
    ),
    graph_path AS (
        SELECT e.id, 'direct'::VARCHAR as type
        FROM entities e
        JOIN authorized_scopes s ON s.scope_id = e.id
        WHERE e.deleted_at IS NULL AND (p_tenant_id IS NULL OR e.tenant_id = p_tenant_id) AND s.is_deny = FALSE
        
        UNION
        
        SELECT e.id, 'global'::VARCHAR as type
        FROM entities e
        WHERE EXISTS (SELECT 1 FROM authorized_scopes s WHERE s.scope_id IS NULL AND s.is_deny = FALSE)
          AND e.deleted_at IS NULL AND (p_tenant_id IS NULL OR e.tenant_id = p_tenant_id)

        UNION ALL
        
        SELECT e.id, 'inherited'::VARCHAR
        FROM entities e
        JOIN graph_path gp ON e.parent_entity_id = gp.id
        WHERE e.deleted_at IS NULL AND (p_tenant_id IS NULL OR e.tenant_id = p_tenant_id)
          AND NOT EXISTS (SELECT 1 FROM authorized_scopes s WHERE s.scope_id = e.id AND s.is_deny = TRUE)
          AND gp.type != 'global' -- Global access doesn't need to inherit down, it's already everywhere
    )
    SELECT DISTINCT e.id, e.display_name, c.name, gp.type
    FROM graph_path gp
    JOIN entities e ON e.id = gp.id
    JOIN classes c ON e.class_id = c.id;
END;
$function$;
