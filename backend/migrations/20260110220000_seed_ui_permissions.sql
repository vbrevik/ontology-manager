
-- Seed UI Permissions
-- We need to ensure these permission types exist in the 'permission_types' table (for ReBAC) 
-- and/or 'permissions' table (for ABAC/Roles).
-- Currently the system seems to be hybrid. Phase 3.1 added 'permission_types'. 
-- Let's check 'permission_types' table structure from previous views (ReBAC service uses it).

-- Checking if permission_types table exists (it should from Phase 3).
-- We will insert UI-specific permission types.

INSERT INTO permission_types (name, description, level) VALUES
('ui.view.dashboard', 'View the main dashboard', 1),
('ui.view.discovery', 'View service discovery', 1),
('ui.view.users', 'View user management', 10),
('ui.view.access', 'View access control', 10),
('ui.view.schedules', 'View access schedules', 5),
('ui.view.metrics', 'View system metrics', 5),
('ui.view.sessions', 'View session management', 10),
('ui.view.logs', 'View system logs', 10),
('ui.view.api', 'View API status', 5)
ON CONFLICT (name) DO NOTHING;
