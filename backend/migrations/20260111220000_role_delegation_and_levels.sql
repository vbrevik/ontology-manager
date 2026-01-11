-- Migration to add role levels and delegation rules
-- Supports "Role chains and access levels" and "who can grant what"

-- 1. Add level to roles table for hierarchy
ALTER TABLE roles ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 0;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Update existing roles with some levels
UPDATE roles SET level = 100 WHERE name = 'superadmin';
UPDATE roles SET level = 80 WHERE name = 'admin';
UPDATE roles SET level = 50 WHERE name = 'editor';
UPDATE roles SET level = 10 WHERE name = 'viewer';

-- 2. Create role delegation rules table
-- This table defines which role can grant/modify/revoke another role
CREATE TABLE IF NOT EXISTS role_delegation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    granter_role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    grantee_role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    
    -- Permissions
    can_grant BOOLEAN NOT NULL DEFAULT TRUE,
    can_modify BOOLEAN NOT NULL DEFAULT FALSE,
    can_revoke BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Optional: rules can be tenant-specific
    tenant_id UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (granter_role_id, grantee_role_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_role_delegation_granter ON role_delegation_rules(granter_role_id);
CREATE INDEX IF NOT EXISTS idx_role_delegation_tenant ON role_delegation_rules(tenant_id);

-- 3. Seed some default delegation rules
-- Superadmin can grant everything
INSERT INTO role_delegation_rules (granter_role_id, grantee_role_id, can_grant, can_modify, can_revoke)
SELECT r1.id, r2.id, true, true, true
FROM roles r1, roles r2
WHERE r1.name = 'superadmin'
ON CONFLICT DO NOTHING;

-- Admin can grant editor and viewer
INSERT INTO role_delegation_rules (granter_role_id, grantee_role_id, can_grant, can_revoke)
SELECT r1.id, r2.id, true, true
FROM roles r1, roles r2
WHERE r1.name = 'admin' AND r2.name IN ('editor', 'viewer')
ON CONFLICT DO NOTHING;
