-- Migration: Test Mode Sessions
-- Description: Creates session-based test mode similar to firefighter mode

-- ========================================================================
-- Test Mode Sessions Table
-- ========================================================================

CREATE TABLE IF NOT EXISTS test_mode_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    test_suite VARCHAR(100) NOT NULL DEFAULT 'manual',
    test_run_id VARCHAR(255),
    justification TEXT NOT NULL,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    entities_marked INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_test_mode_duration CHECK (expires_at > activated_at)
);

CREATE INDEX IF NOT EXISTS idx_test_mode_user ON test_mode_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_test_mode_active ON test_mode_sessions(user_id, expires_at) 
    WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_test_mode_run ON test_mode_sessions(test_run_id) 
    WHERE test_run_id IS NOT NULL;

COMMENT ON TABLE test_mode_sessions IS 'Temporary test mode sessions allowing users to create test data';
COMMENT ON COLUMN test_mode_sessions.test_suite IS 'Name of test suite: e2e, integration, manual, etc.';
COMMENT ON COLUMN test_mode_sessions.test_run_id IS 'Optional unique identifier for grouping test runs';
COMMENT ON COLUMN test_mode_sessions.entities_marked IS 'Counter of entities marked during this session';

-- ========================================================================
-- Test Mode Functions
-- ========================================================================

-- Function: is_in_test_mode
-- Check if a user currently has an active test mode session
CREATE OR REPLACE FUNCTION is_in_test_mode(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_active_session BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM test_mode_sessions
        WHERE user_id = p_user_id
        AND ended_at IS NULL
        AND expires_at > NOW()
    ) INTO v_has_active_session;
    
    RETURN COALESCE(v_has_active_session, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_in_test_mode(UUID) IS 'Returns true if user has an active test mode session';

-- Function: get_active_test_mode_session
-- Get the active test mode session for a user
CREATE OR REPLACE FUNCTION get_active_test_mode_session(p_user_id UUID)
RETURNS TABLE(
    session_id UUID,
    test_suite VARCHAR,
    test_run_id VARCHAR,
    justification TEXT,
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    entities_marked INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tms.id,
        tms.test_suite,
        tms.test_run_id,
        tms.justification,
        tms.activated_at,
        tms.expires_at,
        tms.entities_marked
    FROM test_mode_sessions tms
    WHERE tms.user_id = p_user_id
    AND tms.ended_at IS NULL
    AND tms.expires_at > NOW()
    ORDER BY tms.activated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_active_test_mode_session(UUID) IS 'Returns active test mode session details for a user';

-- Function: end_expired_test_mode_sessions
-- Automatically end expired test mode sessions
CREATE OR REPLACE FUNCTION end_expired_test_mode_sessions()
RETURNS TABLE(ended_session_id UUID, user_id UUID) AS $$
BEGIN
    RETURN QUERY
    UPDATE test_mode_sessions
    SET ended_at = NOW()
    WHERE ended_at IS NULL
    AND expires_at <= NOW()
    RETURNING id, test_mode_sessions.user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION end_expired_test_mode_sessions() IS 'Ends all expired test mode sessions';

-- Function: mark_entity_in_test_session
-- Mark an entity as test data and increment session counter
CREATE OR REPLACE FUNCTION mark_entity_in_test_session(
    p_entity_id UUID,
    p_session_id UUID,
    p_test_suite VARCHAR DEFAULT 'manual',
    p_test_name VARCHAR DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Mark the entity as test data
    PERFORM mark_as_test_data(p_entity_id, p_test_suite, p_test_name);
    
    -- Increment the session counter
    UPDATE test_mode_sessions
    SET entities_marked = entities_marked + 1
    WHERE id = p_session_id;
    
    RAISE NOTICE 'Entity % marked in test session %', p_entity_id, p_session_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_entity_in_test_session(UUID, UUID, VARCHAR, VARCHAR) IS 'Marks entity as test data and updates session counter';

-- ========================================================================
-- Trigger: Auto-mark entities created by test mode users
-- ========================================================================

CREATE OR REPLACE FUNCTION auto_mark_test_mode_entities()
RETURNS TRIGGER AS $$
DECLARE
    v_session_record RECORD;
BEGIN
    -- Only process inserts for non-test-marker entities
    IF TG_OP = 'INSERT' AND NEW.class_id != (SELECT id FROM classes WHERE name = 'TestMarker') THEN
        -- Check if the creating user (from attributes or context) is in test mode
        -- This assumes entities store creator_id in attributes or we track via session
        -- For now, we'll rely on explicit marking via the service layer
        
        -- We can also check if there's an active test mode session context
        -- stored in session variables (set via SET LOCAL in transaction)
        DECLARE
            v_test_mode_user_id UUID;
            v_test_mode_session_id UUID;
        BEGIN
            -- Try to get from session variable
            SELECT current_setting('app.test_mode_user_id', true)::UUID INTO v_test_mode_user_id;
            SELECT current_setting('app.test_mode_session_id', true)::UUID INTO v_test_mode_session_id;
            
            IF v_test_mode_user_id IS NOT NULL AND v_test_mode_session_id IS NOT NULL THEN
                -- Auto-mark this entity
                PERFORM mark_entity_in_test_session(
                    NEW.id,
                    v_test_mode_session_id,
                    COALESCE(current_setting('app.test_suite', true), 'auto'),
                    'auto-marked'
                );
                
                RAISE NOTICE 'Auto-marked entity % for test mode user %', NEW.id, v_test_mode_user_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- If session variables not set, that's OK, just skip auto-marking
            NULL;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_mark_test_mode_entities ON entities;
CREATE TRIGGER trigger_auto_mark_test_mode_entities
    AFTER INSERT ON entities
    FOR EACH ROW
    EXECUTE FUNCTION auto_mark_test_mode_entities();

COMMENT ON FUNCTION auto_mark_test_mode_entities() IS 'Automatically marks entities created during active test mode sessions';

-- ========================================================================
-- View: Active Test Mode Sessions
-- ========================================================================

CREATE OR REPLACE VIEW active_test_mode_sessions AS
SELECT 
    tms.id,
    tms.user_id,
    e.display_name as username,
    tms.test_suite,
    tms.test_run_id,
    tms.justification,
    tms.activated_at,
    tms.expires_at,
    tms.entities_marked,
    EXTRACT(EPOCH FROM (tms.expires_at - NOW())) / 60 as minutes_remaining
FROM test_mode_sessions tms
JOIN entities e ON tms.user_id = e.id
WHERE tms.ended_at IS NULL
AND tms.expires_at > NOW()
ORDER BY tms.activated_at DESC;

COMMENT ON VIEW active_test_mode_sessions IS 'Currently active test mode sessions with user details';

-- ========================================================================
-- Create audit log trigger for test mode sessions
-- ========================================================================

CREATE OR REPLACE FUNCTION audit_test_mode_session()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (user_id, action, details)
        VALUES (
            NEW.user_id,
            'test_mode_activated',
            jsonb_build_object(
                'session_id', NEW.id,
                'test_suite', NEW.test_suite,
                'duration_minutes', EXTRACT(EPOCH FROM (NEW.expires_at - NEW.activated_at)) / 60,
                'justification', NEW.justification
            )
        );
    ELSIF TG_OP = 'UPDATE' AND OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
        INSERT INTO audit_logs (user_id, action, details)
        VALUES (
            NEW.user_id,
            'test_mode_ended',
            jsonb_build_object(
                'session_id', NEW.id,
                'entities_marked', NEW.entities_marked,
                'duration_actual_minutes', EXTRACT(EPOCH FROM (COALESCE(NEW.ended_at, NOW()) - NEW.activated_at)) / 60
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_test_mode_session ON test_mode_sessions;
CREATE TRIGGER trigger_audit_test_mode_session
    AFTER INSERT OR UPDATE ON test_mode_sessions
    FOR EACH ROW
    EXECUTE FUNCTION audit_test_mode_session();

COMMENT ON FUNCTION audit_test_mode_session() IS 'Audits test mode session activation and termination';
