-- ReBAC Authorization Tables Migration
-- Implements scoped role assignments with graph inheritance, DENY rules, and temporal access

-- ============================================================================
-- PERMISSION TYPES (Granular Access Levels)
-- From requirements: Discover, Read, ReadSensitive, Update, UpdateField, Delegate, Admin
-- ============================================================================

CREATE TABLE IF NOT EXISTS permission_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    -- Permission hierarchy level (higher = more access)
    level INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed permission types from requirements section 3.6
INSERT INTO permission_types (name, description, level) VALUES
    ('discover', 'See existence of entity, no attributes visible', 10),
    ('read', 'View standard (non-sensitive) attributes', 20),
    ('read_sensitive', 'View classified/sensitive fields', 30),
    ('update', 'Modify all mutable attributes', 40),
    ('update_field', 'Modify specific field only (requires field specification)', 45),
    ('delegate', 'Grant own access level to others', 50),
    ('admin', 'Full control including deletion', 100)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- ROLE PERMISSION MAPPINGS
-- Links roles to their granted permission types
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permission_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_type_id UUID NOT NULL REFERENCES permission_types(id) ON DELETE CASCADE,
    -- Optional: restrict to specific field for update_field permission
    field_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_role_permission UNIQUE (role_id, permission_type_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_role_permission_types_role ON role_permission_types(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permission_types_perm ON role_permission_types(permission_type_id);

-- Seed default role permissions
-- Superadmin gets admin permission
INSERT INTO role_permission_types (role_id, permission_type_id)
SELECT r.id, pt.id FROM roles r, permission_types pt 
WHERE r.name = 'superadmin' AND pt.name = 'admin'
ON CONFLICT DO NOTHING;

-- Admin gets up to delegate
INSERT INTO role_permission_types (role_id, permission_type_id)
SELECT r.id, pt.id FROM roles r, permission_types pt 
WHERE r.name = 'admin' AND pt.name IN ('discover', 'read', 'read_sensitive', 'update', 'delegate')
ON CONFLICT DO NOTHING;

-- Editor gets up to update
INSERT INTO role_permission_types (role_id, permission_type_id)
SELECT r.id, pt.id FROM roles r, permission_types pt 
WHERE r.name = 'editor' AND pt.name IN ('discover', 'read', 'update')
ON CONFLICT DO NOTHING;

-- Viewer gets read only
INSERT INTO role_permission_types (role_id, permission_type_id)
SELECT r.id, pt.id FROM roles r, permission_types pt 
WHERE r.name = 'viewer' AND pt.name IN ('discover', 'read')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SCOPED USER ROLES (ReBAC Core)
-- UserRole(user_id, role_id, scope_entity_id) with temporal and DENY support
-- ============================================================================

CREATE TABLE IF NOT EXISTS scoped_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    -- Scope: which entity this role applies to (NULL = global)
    -- Role on entity E grants access to E and all descendants
    scope_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    
    -- Temporal access control (Section 3.4)
    valid_from TIMESTAMPTZ,  -- NULL = immediately valid
    valid_until TIMESTAMPTZ, -- NULL = no expiration
    -- Cron expression for scheduled access (e.g., "0 9-17 * * 1-5" for weekday business hours)
    schedule_cron VARCHAR(100),
    
    -- Negative permissions (Section 3.3)
    -- If true, this DENIES the permission instead of granting it
    -- DENY always overrides ALLOW
    is_deny BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Audit fields
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    revoke_reason TEXT,
    
    -- Prevent duplicate role assignments to same scope
    CONSTRAINT unique_scoped_role UNIQUE (user_id, role_id, scope_entity_id, is_deny)
);

CREATE INDEX IF NOT EXISTS idx_scoped_roles_user ON scoped_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_scoped_roles_scope ON scoped_user_roles(scope_entity_id);
CREATE INDEX IF NOT EXISTS idx_scoped_roles_role ON scoped_user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_scoped_roles_valid ON scoped_user_roles(valid_from, valid_until);
-- Active roles only (not revoked)
CREATE INDEX IF NOT EXISTS idx_scoped_roles_active ON scoped_user_roles(user_id) 
    WHERE revoked_at IS NULL;

-- ============================================================================
-- PERMISSION CHECK FUNCTIONS
-- ============================================================================

-- Check if user has a specific permission on an entity
-- Traverses entity hierarchy upward to find inherited permissions
-- DENY rules take precedence over ALLOW
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
        -- Start with the target entity
        SELECT id, parent_entity_id, 0 as depth
        FROM entities 
        WHERE id = p_entity_id AND deleted_at IS NULL
        
        UNION ALL
        
        -- Walk up to ancestors
        SELECT e.id, e.parent_entity_id, ep.depth + 1
        FROM entity_path ep
        JOIN entities e ON e.id = ep.parent_entity_id
        WHERE e.deleted_at IS NULL
    ),
    -- Find all applicable role assignments (scope matches entity or ancestor, or global)
    applicable_roles AS (
        SELECT 
            sur.id,
            sur.role_id,
            sur.scope_entity_id,
            sur.is_deny,
            r.name as role_name,
            ep.depth,
            CASE WHEN sur.scope_entity_id IS NULL THEN 1000 ELSE ep.depth END as specificity
        FROM scoped_user_roles sur
        JOIN roles r ON sur.role_id = r.id
        LEFT JOIN entity_path ep ON sur.scope_entity_id = ep.id
        WHERE sur.user_id = p_user_id
          AND sur.revoked_at IS NULL
          -- Temporal checks
          AND (sur.valid_from IS NULL OR sur.valid_from <= v_now)
          AND (sur.valid_until IS NULL OR sur.valid_until > v_now)
          -- Scope matches: global (NULL) or entity/ancestor
          AND (sur.scope_entity_id IS NULL OR sur.scope_entity_id IN (SELECT id FROM entity_path))
    ),
    -- Check which roles have the requested permission
    roles_with_permission AS (
        SELECT ar.*, pt.name as permission_name
        FROM applicable_roles ar
        JOIN role_permission_types rpt ON ar.role_id = rpt.role_id
        JOIN permission_types pt ON rpt.permission_type_id = pt.id
        WHERE pt.name = p_permission_name OR pt.name = 'admin'  -- admin implies all
    )
    -- Return result: DENY wins, otherwise check for ALLOW
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = TRUE) THEN FALSE
            WHEN EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = FALSE) THEN TRUE
            ELSE FALSE
        END as has_permission,
        (SELECT scope_entity_id FROM roles_with_permission WHERE is_deny = FALSE ORDER BY specificity LIMIT 1),
        (SELECT role_name FROM roles_with_permission WHERE is_deny = FALSE ORDER BY specificity LIMIT 1),
        (SELECT scope_entity_id != p_entity_id FROM roles_with_permission WHERE is_deny = FALSE ORDER BY specificity LIMIT 1),
        EXISTS (SELECT 1 FROM roles_with_permission WHERE is_deny = TRUE);
END;
$$ LANGUAGE plpgsql;

-- Get all permissions a user has on an entity
CREATE OR REPLACE FUNCTION get_user_entity_permissions(
    p_user_id UUID,
    p_entity_id UUID
)
RETURNS TABLE (
    permission_name VARCHAR(100),
    has_permission BOOLEAN,
    is_denied BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.name,
        (check_entity_permission(p_user_id, p_entity_id, pt.name)).has_permission,
        (check_entity_permission(p_user_id, p_entity_id, pt.name)).is_denied
    FROM permission_types pt
    ORDER BY pt.level;
END;
$$ LANGUAGE plpgsql;

-- Get all entities a user can access with a specific permission
CREATE OR REPLACE FUNCTION get_accessible_entities(
    p_user_id UUID,
    p_permission_name VARCHAR(100)
)
RETURNS TABLE (
    entity_id UUID,
    entity_name VARCHAR(500),
    class_name VARCHAR(255),
    access_type VARCHAR(20)  -- 'direct' or 'inherited'
) AS $$
BEGIN
    RETURN QUERY
    WITH user_scopes AS (
        -- Get all scopes where user has the permission (not denied)
        SELECT 
            sur.scope_entity_id,
            r.name as role_name,
            sur.is_deny
        FROM scoped_user_roles sur
        JOIN roles r ON sur.role_id = r.id
        JOIN role_permission_types rpt ON r.id = rpt.role_id
        JOIN permission_types pt ON rpt.permission_type_id = pt.id
        WHERE sur.user_id = p_user_id
          AND sur.revoked_at IS NULL
          AND (sur.valid_from IS NULL OR sur.valid_from <= NOW())
          AND (sur.valid_until IS NULL OR sur.valid_until > NOW())
          AND (pt.name = p_permission_name OR pt.name = 'admin')
    ),
    -- Global access
    global_access AS (
        SELECT e.id, e.display_name, c.name as class_name, 'inherited'::VARCHAR(20) as access_type
        FROM entities e
        JOIN classes c ON e.class_id = c.id
        WHERE e.deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM user_scopes WHERE scope_entity_id IS NULL AND is_deny = FALSE)
          AND NOT EXISTS (SELECT 1 FROM user_scopes WHERE scope_entity_id = e.id AND is_deny = TRUE)
    ),
    -- Direct scope access
    direct_access AS (
        SELECT e.id, e.display_name, c.name as class_name, 'direct'::VARCHAR(20) as access_type
        FROM entities e
        JOIN classes c ON e.class_id = c.id
        JOIN user_scopes us ON us.scope_entity_id = e.id AND us.is_deny = FALSE
        WHERE e.deleted_at IS NULL
    ),
    -- Inherited access (descendants of scoped entities)
    inherited_access AS (
        SELECT DISTINCT e.id, e.display_name, c.name as class_name, 'inherited'::VARCHAR(20) as access_type
        FROM entities e
        JOIN classes c ON e.class_id = c.id
        JOIN user_scopes us ON us.scope_entity_id IS NOT NULL AND us.is_deny = FALSE
        WHERE e.deleted_at IS NULL
          AND e.id IN (
              SELECT descendant_id FROM get_entity_descendants(us.scope_entity_id)
          )
          -- Not explicitly denied
          AND NOT EXISTS (SELECT 1 FROM user_scopes us2 WHERE us2.scope_entity_id = e.id AND us2.is_deny = TRUE)
    )
    SELECT * FROM direct_access
    UNION
    SELECT * FROM inherited_access
    UNION  
    SELECT * FROM global_access;
END;
$$ LANGUAGE plpgsql;
