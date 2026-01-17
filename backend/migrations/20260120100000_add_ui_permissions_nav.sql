-- Add missing UI permission types for role-aware navigation

INSERT INTO permission_types (name, description, level) VALUES
('ui.view.roles', 'View role management', 10),
('ui.view.ontology', 'View ontology designer and classes', 10),
('ui.view.firefighter', 'View firefighter audit', 10),
('ui.view.ai', 'View AI orchestrator', 5)
ON CONFLICT (name) DO NOTHING;
