-- Refine discovery and add bulk checker for Phase 2d
-- 1. Refined Discovery: Support relationship-based inheritance and level hierarchies
-- 2. Bulk Checker: Efficiently check multi-entity permissions

-- 1. Update get_accessible_entities
CREATE OR REPLACE FUNCTION get_accessible_entities(
    p_user_id UUID,
    p_permission_name VARCHAR(100),
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    entity_id UUID,
    entity_name VARCHAR(500),
    class_name VARCHAR(255),
    access_type VARCHAR(20)  -- 'direct' or 'inherited'
) AS $$
DECLARE
    v_requested_level INT;
BEGIN
    -- Get level for requested permission
    SELECT level INTO v_requested_level FROM permission_types WHERE name = p_permission_name;
    IF v_requested_level IS NULL THEN v_requested_level := 0; END IF;

    RETURN QUERY
    WITH RECURSIVE graph_path AS (
        -- Base case: find all entities where the user has a DIRECT role assignment
        -- that grants the requested permission (or higher level)
        SELECT 
            sur.scope_entity_id as id,
            'direct'::VARCHAR(20) as access_type
        FROM scoped_user_roles sur
        JOIN role_permission_types rpt ON sur.role_id = rpt.role_id
        JOIN permission_types pt ON rpt.permission_type_id = pt.id
        WHERE sur.user_id = p_user_id
          AND sur.revoked_at IS NULL
          AND (p_tenant_id IS NULL OR EXISTS (SELECT 1 FROM entities WHERE id = sur.scope_entity_id AND tenant_id = p_tenant_id))
          AND (pt.name = p_permission_name OR pt.level >= v_requested_level OR pt.name = 'admin')
          AND sur.is_deny = FALSE
          -- Time check
          AND (sur.valid_from IS NULL OR sur.valid_from <= NOW())
          AND (sur.valid_until IS NULL OR sur.valid_until > NOW())

        UNION ALL

        -- Recursive case: inherit access DOWN the graph
        -- This is the reverse of check_permission (which walks UP)
        -- We walk from parent -> child AND through relationships that grant inheritance
        
        -- Down through children
        SELECT 
            e.id,
            'inherited'::VARCHAR(20)
        FROM graph_path gp
        JOIN entities e ON e.parent_entity_id = gp.id
        WHERE e.deleted_at IS NULL
          AND (p_tenant_id IS NULL OR e.tenant_id = p_tenant_id)
          -- Stop if explicitly denied
          AND NOT EXISTS (
              SELECT 1 FROM scoped_user_roles sur_deny
              JOIN role_permission_types rpt_deny ON sur_deny.role_id = rpt_deny.role_id
              JOIN permission_types pt_deny ON rpt_deny.permission_type_id = pt_deny.id
              WHERE sur_deny.user_id = p_user_id
                AND sur_deny.scope_entity_id = e.id
                AND sur_deny.is_deny = TRUE
                AND (pt_deny.name = p_permission_name OR pt_deny.level >= v_requested_level OR pt_deny.name = 'admin')
          )

        UNION ALL

        -- Down through relationships
        SELECT 
            r.target_entity_id,
            'inherited'::VARCHAR(20)
        FROM graph_path gp
        JOIN relationships r ON r.source_entity_id = gp.id
        JOIN relationship_types rt ON r.relationship_type_id = rt.id
        WHERE rt.grants_permission_inheritance = TRUE
          AND (p_tenant_id IS NULL OR EXISTS (SELECT 1 FROM entities WHERE id = r.target_entity_id AND tenant_id = p_tenant_id))
          -- Stop if explicitly denied
          AND NOT EXISTS (
              SELECT 1 FROM scoped_user_roles sur_deny
              JOIN role_permission_types rpt_deny ON sur_deny.role_id = rpt_deny.role_id
              JOIN permission_types pt_deny ON rpt_deny.permission_type_id = pt_deny.id
              WHERE sur_deny.user_id = p_user_id
                AND sur_deny.scope_entity_id = r.target_entity_id
                AND sur_deny.is_deny = TRUE
                AND (pt_deny.name = p_permission_name OR pt_deny.level >= v_requested_level OR pt_deny.name = 'admin')
          )
    )
    SELECT DISTINCT
        e.id,
        e.display_name,
        c.name as class_name,
        gp.access_type
    FROM graph_path gp
    JOIN entities e ON e.id = gp.id
    JOIN classes c ON e.class_id = c.id
    WHERE e.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Add Bulk Checker
CREATE OR REPLACE FUNCTION check_multiple_entities_permission(
    p_user_id UUID,
    p_entity_ids UUID[],
    p_permission_name VARCHAR(100),
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    entity_id UUID,
    has_permission BOOLEAN,
    is_denied BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        id,
        (res.has_permission).has_permission,
        (res.has_permission).is_denied
    FROM unnest(p_entity_ids) AS id
    CROSS JOIN LATERAL check_entity_permission(p_user_id, id, p_permission_name, p_tenant_id) AS res;
END;
$$ LANGUAGE plpgsql;
