-- Enhanced Context Ontology Expansion

-- 1. Add properties to the base 'Context' class
-- We find the 'Context' class ID from the current ontology version
DO $$
DECLARE
    context_class_id UUID;
    v_id UUID;
BEGIN
    -- Get current version
    SELECT id INTO v_id FROM ontology_versions WHERE is_current = TRUE LIMIT 1;
    
    -- Get 'Context' class ID
    SELECT id INTO context_class_id FROM classes WHERE name = 'Context' AND version_id = v_id LIMIT 1;

    IF context_class_id IS NOT NULL THEN
        -- Add 'start_time' property
        INSERT INTO properties (name, description, class_id, data_type, is_required, version_id)
        VALUES ('start_time', 'ISO8601 start timestamp of the context validity', context_class_id, 'string', FALSE, v_id)
        ON CONFLICT (name, class_id) DO NOTHING;

        -- Add 'end_time' property
        INSERT INTO properties (name, description, class_id, data_type, is_required, version_id)
        VALUES ('end_time', 'ISO8601 end timestamp of the context validity', context_class_id, 'string', FALSE, v_id)
        ON CONFLICT (name, class_id) DO NOTHING;

        -- Add 'spatial_scope' property
        INSERT INTO properties (name, description, class_id, data_type, is_required, version_id)
        VALUES ('spatial_scope', 'Geographical or spatial extent of the context', context_class_id, 'string', FALSE, v_id)
        ON CONFLICT (name, class_id) DO NOTHING;

        -- Add 'confidence' property
        INSERT INTO properties (name, description, class_id, data_type, is_required, version_id)
        VALUES ('confidence', 'Likelihood or certainty of the context assessment (0.0 - 1.0)', context_class_id, 'float', FALSE, v_id)
        ON CONFLICT (name, class_id) DO NOTHING;
    END IF;
END $$;

-- 2. Add Context Subclasses
DO $$
DECLARE
    context_class_id UUID;
    v_id UUID;
BEGIN
    -- Get current version
    SELECT id INTO v_id FROM ontology_versions WHERE is_current = TRUE LIMIT 1;
    
    -- Get 'Context' class ID
    SELECT id INTO context_class_id FROM classes WHERE name = 'Context' AND version_id = v_id LIMIT 1;

    IF context_class_id IS NOT NULL THEN
        -- PoliticalContext
        INSERT INTO classes (name, description, parent_class_id, version_id, is_abstract)
        VALUES ('PoliticalContext', 'Context related to political climate, governance, or international relations', context_class_id, v_id, FALSE)
        ON CONFLICT (name, tenant_id, version_id) DO NOTHING;

        -- CrisisContext
        INSERT INTO classes (name, description, parent_class_id, version_id, is_abstract)
        VALUES ('CrisisContext', 'Context related to ongoing emergencies, conflicts, or humanitarian situations', context_class_id, v_id, FALSE)
        ON CONFLICT (name, tenant_id, version_id) DO NOTHING;

        -- OperationalContext
        INSERT INTO classes (name, description, parent_class_id, version_id, is_abstract)
        VALUES ('OperationalContext', 'Context related to specific organizational operations or field activities', context_class_id, v_id, FALSE)
        ON CONFLICT (name, tenant_id, version_id) DO NOTHING;
        
        -- EnvironmentalContext
        INSERT INTO classes (name, description, parent_class_id, version_id, is_abstract)
        VALUES ('EnvironmentalContext', 'Context related to weather, terrain, or natural environment', context_class_id, v_id, FALSE)
        ON CONFLICT (name, tenant_id, version_id) DO NOTHING;
    END IF;
END $$;
