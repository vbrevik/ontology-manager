-- Migration: Unify Delegation Rules with Ontology + Multi-tenancy support
-- Description: Adds tenant_id to relationships and ports legacy delegation rules.

-- 1. Add tenant_id to relationships if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'relationships' AND column_name = 'tenant_id') THEN
        ALTER TABLE relationships ADD COLUMN tenant_id UUID;
        CREATE INDEX idx_relationships_tenant ON relationships(tenant_id);
    END IF;
END $$;

-- 2. Create the 'can_delegate' relationship type if it doesn't exist
INSERT INTO relationship_types (name, description, grants_permission_inheritance)
VALUES ('can_delegate', 'Allows one role to grant or manage another role for users', false)
ON CONFLICT (name) DO NOTHING;

-- 3. Port existing delegation rules
-- Metadata stores: can_grant, can_modify, can_revoke
INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata, tenant_id)
SELECT 
    dr.granter_role_id, 
    dr.grantee_role_id, 
    (SELECT id FROM relationship_types WHERE name = 'can_delegate'),
    jsonb_build_object(
        'can_grant', dr.can_grant,
        'can_modify', dr.can_modify,
        'can_revoke', dr.can_revoke
    ),
    dr.tenant_id
FROM role_delegation_rules dr
JOIN entities e1 ON dr.granter_role_id = e1.id
JOIN entities e2 ON dr.grantee_role_id = e2.id
ON CONFLICT (source_entity_id, target_entity_id, relationship_type_id) 
DO UPDATE SET 
    metadata = EXCLUDED.metadata,
    tenant_id = EXCLUDED.tenant_id;
