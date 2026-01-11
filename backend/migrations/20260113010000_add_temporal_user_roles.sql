-- Add temporal columns to the legacy user_roles table
-- These columns allow setting start and end dates for global role assignments.

-- 1. Add valid_from and valid_until columns
ALTER TABLE user_roles ADD COLUMN valid_from TIMESTAMPTZ;
ALTER TABLE user_roles ADD COLUMN valid_until TIMESTAMPTZ;

-- 2. Add indexes for efficient temporal filtering
CREATE INDEX idx_user_roles_temporal ON user_roles(user_id, valid_from, valid_until);
