-- Kernel: Unified Ontology Security Logic
-- Created: 2026-01-14
-- Description: Unifies ABAC/ReBAC check logic to use the ontology entities and relationships.

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
    -- 1. Get metadata once
    SELECT id INTO v_has_role_type_id FROM relationship_types WHERE name = 'has_role' LIMIT 1;
    SELECT id INTO v_grants_perm_type_id FROM relationship_types WHERE name = 'grants_permission' LIMIT 1;
    SELECT id INTO v_permission_class_id FROM classes WHERE name = 'Permission' LIMIT 1;

    -- 2. Determine requested permission level
    SELECT (attributes->>'level')::integer 
    INTO v_requested_level 
    FROM entities 
    WHERE display_name = p_permission_name 
      AND class_id = v_permission_class_id
    LIMIT 1;

    v_requested_level := COALESCE(v_requested_level, 0);

    RETURN QUERY
    WITH RECURSIVE 
    -- Graph traversal for entity hierarchy (ReBAC inheritance)
    graph_path AS (
        SELECT id, parent_entity_id, 0 as depth
        FROM entities
        WHERE id = p_entity_id 
          AND deleted_at IS NULL 
          AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
        
        UNION ALL
        
        SELECT e.id, e.parent_entity_id, gp.depth + 1
        FROM entities e
        JOIN graph_path gp ON e.id = gp.parent_entity_id
        WHERE e.deleted_at IS NULL 
          AND (p_tenant_id IS NULL OR e.tenant_id = p_tenant_id)
    ),
    -- Find all applicable role assignments for the user in the context of this graph path
    applicable_roles AS (
        SELECT 
            r.id as relationship_id,
            r.target_entity_id as role_id,
            r.metadata->>'scope_entity_id' as scope_id_str,
            COALESCE((r.metadata->>'is_deny')::boolean, FALSE) as is_deny,
            e_role.display_name as role_name,
            gp.depth,
            -- Specificity: lower depth (nearer in graph) is more specific. Global (NULL) is least specific.
            CASE 
                WHEN r.metadata->>'scope_entity_id' IS NULL THEN 1000 
                ELSE gp.depth 
            END as specificity
        FROM relationships r
        JOIN entities e_role ON r.target_entity_id = e_role.id
        LEFT JOIN graph_path gp ON (r.metadata->>'scope_entity_id')::uuid = gp.id
        WHERE r.source_entity_id = p_user_id
          AND r.relationship_type_id = v_has_role_type_id
          -- Temporal checks from metadata
          AND (r.metadata->>'valid_from' IS NULL OR (r.metadata->>'valid_from')::timestamp with time zone <= v_now)
          AND (r.metadata->>'valid_until' IS NULL OR (r.metadata->>'valid_until')::timestamp with time zone > v_now)
          -- Scope matches: global (metadata is NULL or lacks scope_id) or any entity discovered in graph_path
          AND (r.metadata->>'scope_entity_id' IS NULL OR (r.metadata->>'scope_entity_id')::uuid IN (SELECT id FROM graph_path))
    ),
    -- Filter roles by permission level or explicit name match using ontology relationships
    roles_with_permission AS (
        SELECT ar.*, e_perm.display_name as permission_name, (e_perm.attributes->>'level')::integer as pt_level
        FROM applicable_roles ar
        JOIN relationships rel_grant ON ar.role_id = rel_grant.source_entity_id
        JOIN entities e_perm ON rel_grant.target_entity_id = e_perm.id
        WHERE rel_grant.relationship_type_id = v_grants_perm_type_id
          AND (
              e_perm.display_name = p_permission_name 
              OR COALESCE((e_perm.attributes->>'level')::integer, 0) >= v_requested_level
              OR e_perm.display_name = 'admin'
          )
    )
    -- Final decision logic
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = TRUE) THEN FALSE
            WHEN EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = FALSE) THEN TRUE
            ELSE FALSE
        END as has_permission,
        -- Details for the first granting role found (most specific)
        (SELECT (scope_id_str)::uuid FROM roles_with_permission WHERE is_deny = FALSE ORDER BY specificity ASC LIMIT 1),
        (SELECT role_name FROM roles_with_permission WHERE is_deny = FALSE ORDER BY specificity ASC LIMIT 1),
        (SELECT (scope_id_str)::uuid IS DISTINCT FROM p_entity_id FROM roles_with_permission WHERE is_deny = FALSE ORDER BY specificity ASC LIMIT 1),
        EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = TRUE);
END;
$function$;
