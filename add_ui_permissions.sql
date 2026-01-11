-- Script to add UI permissions for admin sidebar navigation
-- Run this in your PostgreSQL database

-- Step 1: Create UI permission types if they don't exist
INSERT INTO permission_types (id, name, description, level, created_at)
VALUES 
    (gen_random_uuid(), 'ui.view.dashboard', 'View Admin Dashboard', 1, NOW()),
    (gen_random_uuid(), 'ui.view.discovery', 'View Service Discovery', 1, NOW()),
    (gen_random_uuid(), 'ui.view.users', 'View User Management', 1, NOW()),
    (gen_random_uuid(), 'ui.view.ontology', 'View Ontology Management', 1, NOW()),
    (gen_random_uuid(), 'ui.view.access', 'View Access Control', 1, NOW()),
    (gen_random_uuid(), 'ui.view.api', 'View API Documentation', 1, NOW())
ON CONFLICT (name) DO NOTHING;

-- Step 2: Find or create an Admin role
INSERT INTO roles (id, name, description, created_at)
VALUES (gen_random_uuid(), 'Admin', 'Administrator with full access', NOW())
ON CONFLICT (name) DO NOTHING;

-- Step 3: Add UI permissions to Admin role
INSERT INTO role_permission_types (role_id, permission_type_id)
SELECT r.id, pt.id
FROM roles r
CROSS JOIN permission_types pt
WHERE r.name = 'Admin' 
  AND pt.name IN (
    'ui.view.dashboard',
    'ui.view.discovery', 
    'ui.view.users',
    'ui.view.ontology',
    'ui.view.access',
    'ui.view.api'
  )
ON CONFLICT DO NOTHING;

-- Step 4: Assign Admin role to your user (replace with your email)
INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT u.id, r.id, NOW()
FROM users u
CROSS JOIN roles r
WHERE u.email = 'vidar@brevik.net'  -- Change this to your email
  AND r.name = 'Admin'
ON CONFLICT DO NOTHING;

-- Verify: Check what permissions your user now has
SELECT DISTINCT pt.name as permission
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
JOIN role_permission_types rpt ON r.id = rpt.role_id
JOIN permission_types pt ON rpt.permission_type_id = pt.id
WHERE u.email = 'vidar@brevik.net'
ORDER BY pt.name;
