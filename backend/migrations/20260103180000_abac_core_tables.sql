-- ABAC Core Tables Migration (Postgres)

-- Resources: Defines the different areas/scopes (e.g., projects, teams)
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    resource_type VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles: Defines available roles (e.g., admin, editor, viewer)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Roles: Links users to roles within specific resources
-- resource_id can be NULL for global roles
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_resource ON user_roles(resource_id);

-- Permissions: Defines granular permissions for each role
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (role_id, action)
);

CREATE INDEX IF NOT EXISTS idx_permissions_role ON permissions(role_id);

-- Seed default roles
INSERT INTO roles (name, description) VALUES
    ('superadmin', 'Full access to all resources and actions'),
    ('admin', 'Administrative access within a specific resource'),
    ('editor', 'Can create and modify content within a resource'),
    ('viewer', 'Read-only access to a resource')
ON CONFLICT (name) DO NOTHING;

-- Seed default permissions for each role
-- Superadmin permissions (wildcard)
INSERT INTO permissions (role_id, action)
SELECT id, '*' FROM roles WHERE name = 'superadmin'
ON CONFLICT DO NOTHING;

-- Admin permissions
INSERT INTO permissions (role_id, action)
SELECT id, 'read' FROM roles WHERE name = 'admin'
ON CONFLICT DO NOTHING;
INSERT INTO permissions (role_id, action)
SELECT id, 'write' FROM roles WHERE name = 'admin'
ON CONFLICT DO NOTHING;
INSERT INTO permissions (role_id, action)
SELECT id, 'delete' FROM roles WHERE name = 'admin'
ON CONFLICT DO NOTHING;
INSERT INTO permissions (role_id, action)
SELECT id, 'manage_users' FROM roles WHERE name = 'admin'
ON CONFLICT DO NOTHING;

-- Editor permissions
INSERT INTO permissions (role_id, action)
SELECT id, 'read' FROM roles WHERE name = 'editor'
ON CONFLICT DO NOTHING;
INSERT INTO permissions (role_id, action)
SELECT id, 'write' FROM roles WHERE name = 'editor'
ON CONFLICT DO NOTHING;

-- Viewer permissions
INSERT INTO permissions (role_id, action)
SELECT id, 'read' FROM roles WHERE name = 'viewer'
ON CONFLICT DO NOTHING;
