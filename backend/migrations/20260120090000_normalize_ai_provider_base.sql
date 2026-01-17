-- Normalize AI provider api_base to include /v1 for OpenAI-compatible clients

DO $$
DECLARE
    v_ai_provider_class_id UUID;
BEGIN
    SELECT id INTO v_ai_provider_class_id FROM classes WHERE name = 'AiProvider' LIMIT 1;

    IF v_ai_provider_class_id IS NOT NULL THEN
        -- Prefer localhost for host-based dev; container overrides can use AI_PREFER_ENV.
        UPDATE entities e
        SET attributes = jsonb_set(
            e.attributes,
            '{api_base}',
            to_jsonb(replace(e.attributes->>'api_base', 'host.docker.internal', 'localhost'))
        )
        WHERE e.class_id = v_ai_provider_class_id
          AND e.attributes ? 'api_base'
          AND e.attributes->>'api_base' LIKE '%host.docker.internal%';

        -- Ensure /v1 suffix for OpenAI-compatible clients
        UPDATE entities e
        SET attributes = jsonb_set(
            e.attributes,
            '{api_base}',
            to_jsonb(regexp_replace(e.attributes->>'api_base', '/+$', '') || '/v1')
        )
        WHERE e.class_id = v_ai_provider_class_id
          AND e.attributes ? 'api_base'
          AND (e.attributes->>'api_base') !~ '/v1/?$';
    END IF;
END $$;
