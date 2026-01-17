-- Migration: Cleanup Legacy Tables
-- Description: Drops the legacy tables that have been unified into the ontology.

DROP TABLE IF EXISTS user_mfa CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS role_delegation_rules CASCADE;
DROP TABLE IF EXISTS scoped_user_roles CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS role_permission_types CASCADE;
DROP TABLE IF EXISTS permission_types CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Re-establish FKs for surviving tables that referenced legacy tables
ALTER TABLE firefighter_sessions
    ADD CONSTRAINT fk_firefighter_sessions_user_id FOREIGN KEY (user_id) REFERENCES entities(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_firefighter_sessions_deactivated_by FOREIGN KEY (deactivated_by) REFERENCES entities(id);
