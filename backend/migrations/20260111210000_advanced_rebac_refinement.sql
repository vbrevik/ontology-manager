-- Phase 2c: Advanced ReBAC Refinement
-- Updates check_entity_permission to support:
-- 1. Relationship-based inheritance (Graph DAG)
-- 2. Level-based permission hierarchy (admin > delegate > update > read > discover)
-- 3. Field-level permission filtering
-- 4. Multi-tenancy tenant isolation

-- ============================================================================
-- 1. UPDATED PERMISSION CHECK FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION check_entity_permission(
    p_user_id UUID,
    p_entity_id UUID,
    p_permission_name VARCHAR(100),
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    has_permission BOOLEAN,
    granted_via_entity_id UUID,
    granted_via_role VARCHAR(255),
    is_inherited BOOLEAN,
    is_denied BOOLEAN
) AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_requested_level INT;
BEGIN
    -- Get the level of the requested permission
    SELECT level INTO v_requested_level FROM permission_types WHERE name = p_permission_name;
    
    -- Default to 0 if not found (though it should be seeded)
    IF v_requested_level IS NULL THEN
        v_requested_level := 0;
    END IF;

    RETURN QUERY
    WITH RECURSIVE graph_path AS (
        -- Base case: the target entity itself
        SELECT 
            id, 
            0 as depth,
            ARRAY[id] as visited_ids
        FROM entities 
        WHERE id = p_entity_id 
          AND deleted_at IS NULL
          AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
        
        UNION ALL
        
        -- Recursive case 1: Walk up parent hierarchy (Tree)
        SELECT 
            e.id, 
            gp.depth + 1,
            gp.visited_ids || e.id
        FROM graph_path gp
        JOIN entities e ON e.id = (SELECT parent_entity_id FROM entities WHERE id = gp.id)
        WHERE e.deleted_at IS NULL
          AND NOT e.id = ANY(gp.visited_ids) -- Cycle prevention
          AND (p_tenant_id IS NULL OR e.tenant_id = p_tenant_id)

        UNION ALL

        -- Recursive case 2: Walk across relationships that grant inheritance (Graph)
        SELECT 
            r.source_entity_id, 
            gp.depth + 1,
            gp.visited_ids || r.source_entity_id
        FROM graph_path gp
        JOIN relationships r ON r.target_entity_id = gp.id
        JOIN relationship_types rt ON r.relationship_type_id = rt.id
        WHERE rt.grants_permission_inheritance = TRUE
          AND NOT r.source_entity_id = ANY(gp.visited_ids) -- Cycle prevention
          AND EXISTS (SELECT 1 FROM entities WHERE id = r.source_entity_id AND deleted_at IS NULL AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id))
    ),
    -- Find all applicable role assignments (scope matches any entity in graph_path or global)
    applicable_roles AS (
        SELECT 
            sur.id,
            sur.role_id,
            sur.scope_entity_id,
            sur.is_deny,
            r.name as role_name,
            gp.depth,
            -- Specificity: lower depth (nearer in graph) is more specific. Global (NULL) is least specific.
            CASE WHEN sur.scope_entity_id IS NULL THEN 1000 ELSE gp.depth END as specificity
        FROM scoped_user_roles sur
        JOIN roles r ON sur.role_id = r.id
        LEFT JOIN graph_path gp ON sur.scope_entity_id = gp.id
        WHERE sur.user_id = p_user_id
          AND sur.revoked_at IS NULL
          -- Temporal checks
          AND (sur.valid_from IS NULL OR sur.valid_from <= v_now)
          AND (sur.valid_until IS NULL OR sur.valid_until > v_now)
          -- Scope matches: global (NULL) or any entity discovered in graph_path traversal
          AND (sur.scope_entity_id IS NULL OR sur.scope_entity_id IN (SELECT id FROM graph_path))
    ),
    -- Filter roles by permission level or explicit name match
    roles_with_permission AS (
        SELECT ar.*, pt.name as permission_name, pt.level as pt_level
        FROM applicable_roles ar
        JOIN role_permission_types rpt ON ar.role_id = rpt.role_id
        JOIN permission_types pt ON rpt.permission_type_id = pt.id
        WHERE 
            pt.name = p_permission_name 
            OR pt.level >= v_requested_level  -- Level-based hierarchy
            OR pt.name = 'admin'              -- Special case safety
    )
    -- Final decision logic
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = TRUE) THEN FALSE
            WHEN EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = FALSE) THEN TRUE
            ELSE FALSE
        END as has_permission,
        -- Details for the first granting role found (most specific)
        (SELECT scope_entity_id FROM roles_with_permission WHERE is_deny = FALSE ORDER BY specificity ASC LIMIT 1),
        (SELECT role_name FROM roles_with_permission WHERE is_deny = FALSE ORDER BY specificity ASC LIMIT 1),
        (SELECT scope_entity_id IS DISTINCT FROM p_entity_id FROM roles_with_permission WHERE is_deny = FALSE ORDER BY specificity ASC LIMIT 1),
        EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = TRUE);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. FIELD-LEVEL PERMISSION CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION check_field_permission(
    p_user_id UUID,
    p_entity_id UUID,
    p_field_name VARCHAR(255),
    p_permission_name VARCHAR(100) DEFAULT 'update_field',
    p_tenant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_global BOOLEAN;
BEGIN
    -- 1. Check if user has global 'admin' or general 'update' on entity (which implies field access)
    IF check_entity_permission(p_user_id, p_entity_id, 'admin', p_tenant_id) THEN
        RETURN TRUE;
    END IF;

    -- 2. Check for explicit update_field permission on the specific field
    RETURN EXISTS (
        WITH RECURSIVE graph_path AS (
            SELECT id FROM entities WHERE id = p_entity_id AND deleted_at IS NULL AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
            UNION ALL
            SELECT e.id FROM graph_path gp JOIN entities e ON e.id = (SELECT parent_entity_id FROM entities WHERE id = gp.id) WHERE e.deleted_at IS NULL
        )
        SELECT 1
        FROM scoped_user_roles sur
        JOIN role_permission_types rpt ON sur.role_id = rpt.role_id
        JOIN permission_types pt ON rpt.permission_type_id = pt.id
        WHERE sur.user_id = p_user_id
          AND sur.revoked_at IS NULL
          AND pt.name = p_permission_name
          -- Field must match or be a wildcard (future)
          AND rpt.field_name = p_field_name
          AND (sur.scope_entity_id IS NULL OR sur.scope_entity_id IN (SELECT id FROM graph_path))
          AND sur.is_deny = FALSE
    );
END;
$$ LANGUAGE plpgsql;
