-- Migration: Enforce Unique Username
-- Description: Adds a unique index on the 'username' attribute in the entities table.
-- This enforces uniqueness for any entity having a 'username' field (Users, ServiceAccounts),
-- but only for active (non-deleted) records.

CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_attributes_username_unique
ON entities ((attributes->>'username'))
WHERE attributes ? 'username' AND deleted_at IS NULL;
