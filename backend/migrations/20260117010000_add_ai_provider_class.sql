-- AI Provider Ontology Migration

DO $$
DECLARE
    v_system_version_id UUID;
    v_service_class_id UUID;
    v_ai_provider_class_id UUID;
BEGIN
    -- 1. Get system version
    SELECT id INTO v_system_version_id FROM ontology_versions WHERE is_system = TRUE LIMIT 1;
    
    -- 2. Get Service class ID
    SELECT id INTO v_service_class_id FROM classes WHERE name = 'Service' AND version_id = v_system_version_id LIMIT 1;

    IF v_service_class_id IS NOT NULL THEN
        -- 3. Create AiProvider subclass
        INSERT INTO classes (name, description, parent_class_id, version_id, is_abstract, tenant_id)
        VALUES ('AiProvider', 'Configuration for AI/LLM service providers like Ollama or OpenAI', v_service_class_id, v_system_version_id, FALSE, NULL)
        ON CONFLICT (name, tenant_id, version_id) DO NOTHING
        RETURNING id INTO v_ai_provider_class_id;

        -- If conflict happened, get the existing ID
        IF v_ai_provider_class_id IS NULL THEN
            SELECT id INTO v_ai_provider_class_id FROM classes WHERE name = 'AiProvider' AND version_id = v_system_version_id LIMIT 1;
        END IF;

        -- 4. Add properties to AiProvider
        INSERT INTO properties (name, description, class_id, data_type, is_required, version_id) VALUES
            ('model_name', 'The identifier of the LLM model (e.g., llama3, mistral)', v_ai_provider_class_id, 'string', TRUE, v_system_version_id),
            ('api_base', 'The base URL for the API (e.g., http://localhost:11434)', v_ai_provider_class_id, 'string', TRUE, v_system_version_id),
            ('provider_type', 'Type of provider (Ollama, OpenAI, Anthropic)', v_ai_provider_class_id, 'string', TRUE, v_system_version_id),
            ('is_active', 'Whether this provider is currently active', v_ai_provider_class_id, 'boolean', TRUE, v_system_version_id)
        ON CONFLICT (name, class_id) DO NOTHING;

        -- 5. Seed default Ollama provider entity
        -- Since entities table doesn't have a unique constraint on name, we check manually or just insert
        -- But this migration is just for schema. Seeding entities usually happens in the app or a separate seed.
        -- However, we want a default to exist.
    END IF;
END $$;
