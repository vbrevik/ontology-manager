-- Fix and Enhance Context Ontology
-- Ensures 'Context' class exists and adds subclasses/properties to the system version.

DO $$
DECLARE
    v_system_version_id UUID;
    context_class_id UUID;
BEGIN
    -- 1. Get the system version ID
    SELECT id INTO v_system_version_id 
    FROM ontology_versions 
    WHERE is_system = TRUE 
    LIMIT 1;

    IF v_system_version_id IS NULL THEN
        RAISE EXCEPTION 'System ontology version not found';
    END IF;

    -- 2. Ensure 'Context' class exists in system version
    INSERT INTO classes (name, description, version_id, is_abstract, tenant_id)
    VALUES ('Context', 'Base class for all situational awareness contexts', v_system_version_id, FALSE, NULL)
    ON CONFLICT (name, tenant_id, version_id) DO UPDATE SET is_abstract = FALSE
    RETURNING id INTO context_class_id;

    -- 3. Add Properties to Context class
    -- start_time
    INSERT INTO properties (name, description, class_id, data_type, is_required, version_id)
    VALUES ('start_time', 'ISO8601 start timestamp of the context validity', context_class_id, 'string', FALSE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- end_time
    INSERT INTO properties (name, description, class_id, data_type, is_required, version_id)
    VALUES ('end_time', 'ISO8601 end timestamp of the context validity', context_class_id, 'string', FALSE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- spatial_scope
    INSERT INTO properties (name, description, class_id, data_type, is_required, version_id)
    VALUES ('spatial_scope', 'Geographical or spatial extent of the context', context_class_id, 'string', FALSE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- confidence
    INSERT INTO properties (name, description, class_id, data_type, is_required, version_id)
    VALUES ('confidence', 'Likelihood or certainty of the context assessment (0.0 - 1.0)', context_class_id, 'float', FALSE, v_system_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;

    -- 4. Add Context Subclasses
    -- PoliticalContext
    INSERT INTO classes (name, description, parent_class_id, version_id, is_abstract, tenant_id)
    VALUES ('PoliticalContext', 'Context related to political climate, governance, or international relations', context_class_id, v_system_version_id, FALSE, NULL)
    ON CONFLICT (name, tenant_id, version_id) DO NOTHING;

    -- CrisisContext
    INSERT INTO classes (name, description, parent_class_id, version_id, is_abstract, tenant_id)
    VALUES ('CrisisContext', 'Context related to ongoing emergencies, conflicts, or humanitarian situations', context_class_id, v_system_version_id, FALSE, NULL)
    ON CONFLICT (name, tenant_id, version_id) DO NOTHING;

    -- OperationalContext
    INSERT INTO classes (name, description, parent_class_id, version_id, is_abstract, tenant_id)
    VALUES ('OperationalContext', 'Context related to specific organizational operations or field activities', context_class_id, v_system_version_id, FALSE, NULL)
    ON CONFLICT (name, tenant_id, version_id) DO NOTHING;
    
    -- EnvironmentalContext
    INSERT INTO classes (name, description, parent_class_id, version_id, is_abstract, tenant_id)
    VALUES ('EnvironmentalContext', 'Context related to weather, terrain, or natural environment', context_class_id, v_system_version_id, FALSE, NULL)
    ON CONFLICT (name, tenant_id, version_id) DO NOTHING;

END $$;
