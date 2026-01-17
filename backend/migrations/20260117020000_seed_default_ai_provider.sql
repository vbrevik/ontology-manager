-- Seed default AI Provider Entity

DO $$
DECLARE
    v_ai_provider_class_id UUID;
    v_user_id UUID;
BEGIN
    -- 1. Get AiProvider class ID
    SELECT id INTO v_ai_provider_class_id FROM classes WHERE name = 'AiProvider' LIMIT 1;
    
    -- 2. Get a system user ID (optional, but good for audit)
    SELECT id INTO v_user_id FROM users WHERE username = 'admin' LIMIT 1;

    IF v_ai_provider_class_id IS NOT NULL THEN
        -- 3. Insert default Ollama provider entity
        INSERT INTO entities (class_id, display_name, attributes, approval_status, created_by, updated_by)
        VALUES (
            v_ai_provider_class_id, 
            'Local Ollama', 
            jsonb_build_object(
                'model_name', 'llama3',
                'api_base', 'http://host.docker.internal:11434',
                'provider_type', 'Ollama',
                'is_active', true
            ),
            'APPROVED',
            v_user_id,
            v_user_id
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
