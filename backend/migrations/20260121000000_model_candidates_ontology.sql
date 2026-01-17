-- Model Policy, ApiKey, and Webhook as Ontology Entities
-- This migration adds ontology classes and syncs existing data

DO $$
DECLARE
    v_system_version_id UUID;
    v_policy_class_id UUID;
    v_apikey_class_id UUID;
    v_webhook_class_id UUID;
    v_user_class_id UUID;
    v_permission_class_id UUID;
    v_entity_class_id UUID;
    rec RECORD;
BEGIN
    -- Get system ontology version
    SELECT id INTO v_system_version_id FROM ontology_versions WHERE is_system = TRUE LIMIT 1;
    IF v_system_version_id IS NULL THEN
        SELECT id INTO v_system_version_id FROM ontology_versions WHERE is_current = TRUE LIMIT 1;
    END IF;

    -- Get User class for relationships
    SELECT id INTO v_user_class_id FROM classes WHERE name = 'User' AND version_id = v_system_version_id;
    SELECT id INTO v_permission_class_id FROM classes WHERE name = 'Permission' AND version_id = v_system_version_id;
    SELECT id INTO v_entity_class_id FROM classes WHERE name = 'Entity' AND version_id = v_system_version_id;

    -- ========================================================================
    -- POLICY CLASS
    -- ========================================================================
    SELECT id INTO v_policy_class_id FROM classes WHERE name = 'Policy' AND version_id = v_system_version_id;
    IF v_policy_class_id IS NULL THEN
        INSERT INTO classes (name, description, version_id, is_abstract)
        VALUES ('Policy', 'Dynamic access control policy with conditions', v_system_version_id, FALSE)
        RETURNING id INTO v_policy_class_id;
    END IF;

    -- Policy Properties
    INSERT INTO properties (name, description, class_id, data_type, version_id, is_required)
    VALUES 
        ('policy_id', 'Reference to policies table', v_policy_class_id, 'UUID', v_system_version_id, TRUE),
        ('effect', 'ALLOW or DENY', v_policy_class_id, 'STRING', v_system_version_id, TRUE),
        ('priority', 'Evaluation priority (higher first)', v_policy_class_id, 'INTEGER', v_system_version_id, FALSE),
        ('conditions', 'JSON DSL for conditions', v_policy_class_id, 'JSON', v_system_version_id, FALSE),
        ('is_active', 'Whether policy is currently active', v_policy_class_id, 'BOOLEAN', v_system_version_id, FALSE),
        ('valid_from', 'Start of validity period', v_policy_class_id, 'DATETIME', v_system_version_id, FALSE),
        ('valid_until', 'End of validity period', v_policy_class_id, 'DATETIME', v_system_version_id, FALSE)
    ON CONFLICT DO NOTHING;

    -- ========================================================================
    -- APIKEY CLASS
    -- ========================================================================
    SELECT id INTO v_apikey_class_id FROM classes WHERE name = 'ApiKey' AND version_id = v_system_version_id;
    IF v_apikey_class_id IS NULL THEN
        INSERT INTO classes (name, description, version_id, is_abstract)
        VALUES ('ApiKey', 'API key for external system access', v_system_version_id, FALSE)
        RETURNING id INTO v_apikey_class_id;
    END IF;

    -- ApiKey Properties
    INSERT INTO properties (name, description, class_id, data_type, version_id, is_required, is_sensitive)
    VALUES 
        ('apikey_id', 'Reference to api_keys table', v_apikey_class_id, 'UUID', v_system_version_id, TRUE, FALSE),
        ('prefix', 'Key prefix for identification', v_apikey_class_id, 'STRING', v_system_version_id, FALSE, FALSE),
        ('scopes', 'Granted scopes/permissions', v_apikey_class_id, 'JSON', v_system_version_id, FALSE, FALSE),
        ('status', 'active, revoked', v_apikey_class_id, 'STRING', v_system_version_id, FALSE, FALSE),
        ('last_used_at', 'Last usage timestamp', v_apikey_class_id, 'DATETIME', v_system_version_id, FALSE, FALSE),
        ('expires_at', 'Expiration timestamp', v_apikey_class_id, 'DATETIME', v_system_version_id, FALSE, FALSE)
    ON CONFLICT DO NOTHING;

    -- ========================================================================
    -- WEBHOOK CLASS
    -- ========================================================================
    SELECT id INTO v_webhook_class_id FROM classes WHERE name = 'Webhook' AND version_id = v_system_version_id;
    IF v_webhook_class_id IS NULL THEN
        INSERT INTO classes (name, description, version_id, is_abstract)
        VALUES ('Webhook', 'External webhook endpoint for event notifications', v_system_version_id, FALSE)
        RETURNING id INTO v_webhook_class_id;
    END IF;

    -- Webhook Properties
    INSERT INTO properties (name, description, class_id, data_type, version_id, is_required, is_sensitive)
    VALUES 
        ('webhook_id', 'Reference to webhooks table', v_webhook_class_id, 'UUID', v_system_version_id, TRUE, FALSE),
        ('url', 'Endpoint URL', v_webhook_class_id, 'STRING', v_system_version_id, TRUE, FALSE),
        ('events', 'Subscribed event types', v_webhook_class_id, 'JSON', v_system_version_id, FALSE, FALSE),
        ('status', 'active, inactive, failing', v_webhook_class_id, 'STRING', v_system_version_id, FALSE, FALSE),
        ('failure_count', 'Consecutive failure count', v_webhook_class_id, 'INTEGER', v_system_version_id, FALSE, FALSE),
        ('last_delivery_at', 'Last successful delivery', v_webhook_class_id, 'DATETIME', v_system_version_id, FALSE, FALSE)
    ON CONFLICT DO NOTHING;

    -- ========================================================================
    -- RELATIONSHIP TYPES
    -- ========================================================================
    
    -- Policy -> targets -> Entity (which entity/class the policy affects)
    INSERT INTO relationship_types (name, description, allowed_source_class_id, allowed_target_class_id)
    VALUES ('targets', 'Policy targets this entity or class scope', v_policy_class_id, NULL)
    ON CONFLICT (name) DO NOTHING;

    -- Policy -> created_by -> User
    INSERT INTO relationship_types (name, description, allowed_source_class_id, allowed_target_class_id)
    VALUES ('created_by', 'Created by this user', NULL, v_user_class_id)
    ON CONFLICT (name) DO NOTHING;

    -- ApiKey -> belongs_to -> User (if we had user association, for now it's global)
    -- Note: current api_keys table doesn't have user_id, so this is for future use
    INSERT INTO relationship_types (name, description, allowed_source_class_id, allowed_target_class_id)
    VALUES ('belongs_to', 'Belongs to this entity', NULL, NULL)
    ON CONFLICT (name) DO NOTHING;

    -- Webhook -> triggers_on -> (conceptual, for event types - stored in attributes for now)
    INSERT INTO relationship_types (name, description, allowed_source_class_id, allowed_target_class_id)
    VALUES ('notifies', 'Webhook notifies on events from this entity', v_webhook_class_id, NULL)
    ON CONFLICT (name) DO NOTHING;

    -- ========================================================================
    -- SYNC EXISTING POLICIES TO ONTOLOGY
    -- ========================================================================
    FOR rec IN SELECT * FROM policies LOOP
        INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
        VALUES (
            rec.id,
            v_policy_class_id,
            rec.name,
            jsonb_build_object(
                'policy_id', rec.id,
                'effect', rec.effect,
                'priority', rec.priority,
                'conditions', rec.conditions,
                'is_active', rec.is_active,
                'valid_from', rec.valid_from,
                'valid_until', rec.valid_until,
                'description', rec.description
            ),
            'APPROVED'
        )
        ON CONFLICT (id) DO UPDATE SET
            attributes = EXCLUDED.attributes,
            updated_at = NOW();

        -- Create relationship to target entity if scope_entity_id is set
        IF rec.scope_entity_id IS NOT NULL THEN
            INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id)
            SELECT rec.id, rec.scope_entity_id, rt.id
            FROM relationship_types rt WHERE rt.name = 'targets'
            ON CONFLICT DO NOTHING;
        END IF;

        -- Create relationship to creator if created_by is set
        IF rec.created_by IS NOT NULL THEN
            -- Find user entity
            DECLARE v_user_entity_id UUID;
            BEGIN
                SELECT e.id INTO v_user_entity_id 
                FROM entities e 
                JOIN classes c ON e.class_id = c.id 
                WHERE c.name = 'User' AND e.attributes->>'user_id' = rec.created_by::text
                LIMIT 1;

                IF v_user_entity_id IS NOT NULL THEN
                    INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id)
                    SELECT rec.id, v_user_entity_id, rt.id
                    FROM relationship_types rt WHERE rt.name = 'created_by'
                    ON CONFLICT DO NOTHING;
                END IF;
            END;
        END IF;
    END LOOP;

    -- ========================================================================
    -- SYNC EXISTING API KEYS TO ONTOLOGY
    -- ========================================================================
    FOR rec IN SELECT * FROM api_keys LOOP
        INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
        VALUES (
            rec.id,
            v_apikey_class_id,
            rec.name,
            jsonb_build_object(
                'apikey_id', rec.id,
                'prefix', rec.prefix,
                'scopes', to_jsonb(rec.scopes),
                'status', rec.status,
                'last_used_at', rec.last_used_at,
                'expires_at', rec.expires_at
            ),
            'APPROVED'
        )
        ON CONFLICT (id) DO UPDATE SET
            attributes = EXCLUDED.attributes,
            updated_at = NOW();
    END LOOP;

    -- ========================================================================
    -- SYNC EXISTING WEBHOOKS TO ONTOLOGY
    -- ========================================================================
    FOR rec IN SELECT * FROM webhooks LOOP
        INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
        VALUES (
            rec.id,
            v_webhook_class_id,
            'Webhook: ' || LEFT(rec.url, 50),
            jsonb_build_object(
                'webhook_id', rec.id,
                'url', rec.url,
                'events', to_jsonb(rec.events),
                'status', rec.status,
                'failure_count', rec.failure_count,
                'last_delivery_at', rec.last_delivery_at
            ),
            'APPROVED'
        )
        ON CONFLICT (id) DO UPDATE SET
            attributes = EXCLUDED.attributes,
            updated_at = NOW();
    END LOOP;

    RAISE NOTICE 'Ontology modeling for Policy, ApiKey, Webhook complete';
END $$;
