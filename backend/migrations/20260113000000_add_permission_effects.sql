-- Add effect column to permissions (Legacy ABAC) and role_permission_types (New ReBAC)
-- Default is 'ALLOW' to maintain backward compatibility.

-- 1. Update permissions table (Legacy ABAC)
ALTER TABLE permissions ADD COLUMN effect VARCHAR(10) NOT NULL DEFAULT 'ALLOW' CHECK (effect IN ('ALLOW', 'DENY'));

-- 2. Update role_permission_types (New ReBAC)
ALTER TABLE role_permission_types ADD COLUMN effect VARCHAR(10) NOT NULL DEFAULT 'ALLOW' CHECK (effect IN ('ALLOW', 'DENY'));

-- 3. Update check_entity_permission function to handle role-level effects
CREATE OR REPLACE FUNCTION check_entity_permission(
    p_user_id UUID,
    p_entity_id UUID,
    p_permission_name VARCHAR(100)
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
BEGIN
    RETURN QUERY
    WITH RECURSIVE entity_path AS (
        SELECT id, parent_entity_id, 0 as depth
        FROM entities 
        WHERE id = p_entity_id AND deleted_at IS NULL
        UNION ALL
        SELECT e.id, e.parent_entity_id, ep.depth + 1
        FROM entity_path ep
        JOIN entities e ON e.id = ep.parent_entity_id
        WHERE e.deleted_at IS NULL
    ),
    applicable_roles AS (
        SELECT 
            sur.id, sur.role_id, sur.scope_entity_id, sur.is_deny,
            r.name as role_name, ep.depth,
            CASE WHEN sur.scope_entity_id IS NULL THEN 1000 ELSE ep.depth END as specificity
        FROM scoped_user_roles sur
        JOIN roles r ON sur.role_id = r.id
        LEFT JOIN entity_path ep ON sur.scope_entity_id = ep.id
        WHERE sur.user_id = p_user_id
          AND sur.revoked_at IS NULL
          AND (sur.valid_from IS NULL OR sur.valid_from <= v_now)
          AND (sur.valid_until IS NULL OR sur.valid_until > v_now)
          AND (sur.scope_entity_id IS NULL OR sur.scope_entity_id IN (SELECT id FROM entity_path))
    ),
    roles_with_permission AS (
        SELECT ar.*, pt.name as permission_name, rpt.effect
        FROM applicable_roles ar
        JOIN role_permission_types rpt ON ar.role_id = rpt.role_id
        JOIN permission_types pt ON rpt.permission_type_id = pt.id
        WHERE pt.name = p_permission_name OR pt.name = 'admin'
    )
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = TRUE OR effect = 'DENY') THEN FALSE
            WHEN EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = FALSE AND effect = 'ALLOW') THEN TRUE
            ELSE FALSE
        END as has_permission,
        (SELECT scope_entity_id FROM roles_with_permission WHERE is_deny = FALSE AND effect = 'ALLOW' ORDER BY specificity LIMIT 1),
        (SELECT role_name FROM roles_with_permission WHERE is_deny = FALSE AND effect = 'ALLOW' ORDER BY specificity LIMIT 1),
        (SELECT scope_entity_id != p_entity_id FROM roles_with_permission WHERE is_deny = FALSE AND effect = 'ALLOW' ORDER BY specificity LIMIT 1),
        EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = TRUE OR effect = 'DENY');
END;
$$ LANGUAGE plpgsql;

-- 4. Update get_accessible_entities to handle role-level effects
CREATE OR REPLACE FUNCTION get_accessible_entities(
    p_user_id UUID,
    p_permission_name VARCHAR(100)
)
RETURNS TABLE (
    entity_id UUID,
    entity_name VARCHAR(500),
    class_name VARCHAR(255),
    access_type VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    WITH user_scopes AS (
        SELECT 
            sur.scope_entity_id,
            sur.is_deny,
            rpt.effect
        FROM scoped_user_roles sur
        JOIN role_permission_types rpt ON sur.role_id = rpt.role_id
        JOIN permission_types pt ON rpt.permission_type_id = pt.id
        WHERE sur.user_id = p_user_id
          AND sur.revoked_at IS NULL
          AND (sur.valid_from IS NULL OR sur.valid_from <= NOW())
          AND (sur.valid_until IS NULL OR sur.valid_until > NOW())
          AND (pt.name = p_permission_name OR pt.name = 'admin')
    ),
    global_access AS (
        SELECT e.id, e.display_name, c.name as class_name, 'inherited'::VARCHAR(20) as access_type
        FROM entities e
        JOIN classes c ON e.class_id = c.id
        WHERE e.deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM user_scopes WHERE scope_entity_id IS NULL AND is_deny = FALSE AND effect = 'ALLOW')
          AND NOT EXISTS (SELECT 1 FROM user_scopes WHERE scope_entity_id IS NULL AND (is_deny = TRUE OR effect = 'DENY'))
          AND NOT EXISTS (SELECT 1 FROM user_scopes WHERE scope_entity_id = e.id AND (is_deny = TRUE OR effect = 'DENY'))
    ),
    direct_access AS (
        SELECT e.id, e.display_name, c.name as class_name, 'direct'::VARCHAR(20) as access_type
        FROM entities e
        JOIN classes c ON e.class_id = c.id
        WHERE e.deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM user_scopes WHERE scope_entity_id = e.id AND is_deny = FALSE AND effect = 'ALLOW')
          AND NOT EXISTS (SELECT 1 FROM user_scopes WHERE scope_entity_id = e.id AND (is_deny = TRUE OR effect = 'DENY'))
    ),
    inherited_access AS (
        SELECT DISTINCT e.id, e.display_name, c.name as class_name, 'inherited'::VARCHAR(20) as access_type
        FROM entities e
        JOIN classes c ON e.class_id = c.id
        WHERE e.deleted_at IS NULL
          AND e.id IN (
              SELECT descendant_id FROM (
                  SELECT scope_entity_id FROM user_scopes WHERE scope_entity_id IS NOT NULL AND is_deny = FALSE AND effect = 'ALLOW'
              ) as s, get_entity_descendants(s.scope_entity_id)
          )
          AND NOT EXISTS (SELECT 1 FROM user_scopes WHERE scope_entity_id = e.id AND (is_deny = TRUE OR effect = 'DENY'))
          -- Also check if any ancestor is explicitly denied
          AND NOT EXISTS (
              SELECT 1 FROM user_scopes us2
              JOIN get_entity_ancestors(e.id) anc ON us2.scope_entity_id = anc.ancestor_id
              WHERE us2.is_deny = TRUE OR us2.effect = 'DENY'
          )
    )
    SELECT * FROM direct_access
    UNION
    SELECT * FROM inherited_access
    UNION  
    SELECT * FROM global_access;
END;
$$ LANGUAGE plpgsql;
