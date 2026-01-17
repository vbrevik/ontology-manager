-- Migration: Unify Audit Ontology
-- Description: Migrates legacy audit logs to the ontology 'SecurityEvent' class and creates a unified view.

DO $$
DECLARE
    v_event_class_id UUID;
    v_user_class_id UUID;
    v_init_rel_type_id UUID;
    v_target_rel_type_id UUID;
BEGIN
    -- 1. Get Class and Relation IDs
    SELECT id INTO v_event_class_id FROM classes WHERE name = 'SecurityEvent' LIMIT 1;
    SELECT id INTO v_user_class_id FROM classes WHERE name = 'User' LIMIT 1;
    SELECT id INTO v_init_rel_type_id FROM relationship_types WHERE name = 'initiated_by' LIMIT 1;
    SELECT id INTO v_target_rel_type_id FROM relationship_types WHERE name = 'affected_target' LIMIT 1;

    IF v_event_class_id IS NOT NULL THEN
        -- 2. Port legacy audit_logs to entities
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
            INSERT INTO entities (id, class_id, display_name, attributes, created_at)
            SELECT 
                id, 
                v_event_class_id, 
                'SecurityEvent: ' || action, 
                jsonb_build_object(
                    'action', action,
                    'target_type', target_type,
                    'before_state', before_state,
                    'after_state', after_state,
                    'details', metadata,
                    'severity', 'MEDIUM'
                ),
                created_at
            FROM audit_logs
            ON CONFLICT (id) DO NOTHING;

            -- 3. Port associations (Event -> initiated_by -> User)
            IF v_init_rel_type_id IS NOT NULL THEN
                INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id)
                SELECT a.id, a.user_id, v_init_rel_type_id
                FROM audit_logs a
                JOIN entities e_user ON a.user_id = e_user.id
                ON CONFLICT DO NOTHING;
            END IF;

            -- 4. Port associations (Event -> affected_target -> Resource/Entity)
            IF v_target_rel_type_id IS NOT NULL THEN
                INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id)
                SELECT a.id, a.target_id, v_target_rel_type_id
                FROM audit_logs a
                JOIN entities e_target ON a.target_id = e_target.id
                WHERE a.target_id IS NOT NULL
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;
END $$;

-- 5. Create public view for services
CREATE OR REPLACE VIEW unified_audit_logs AS
SELECT 
    e.id, 
    COALESCE(r_init.target_entity_id, '00000000-0000-0000-0000-000000000000'::uuid) as user_id, 
    e.attributes->>'action' as action, 
    e.attributes->>'target_type' as target_type,
    r_target.target_entity_id as target_id,
    e.attributes->'before_state' as before_state,
    e.attributes->'after_state' as after_state,
    e.attributes->'details' as metadata,
    e.created_at
FROM entities e
JOIN classes c ON e.class_id = c.id
LEFT JOIN relationships r_init ON e.id = r_init.source_entity_id 
    AND r_init.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'initiated_by' LIMIT 1)
LEFT JOIN relationships r_target ON e.id = r_target.source_entity_id 
    AND r_target.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'affected_target' LIMIT 1)
WHERE c.name = 'SecurityEvent';
