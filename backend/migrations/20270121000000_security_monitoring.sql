-- ================================================================
-- PHASE 3: SECURITY MONITORING & ATTACK DETECTION
-- Created: 2026-01-18
-- Purpose: Comprehensive security event tracking and alerting
-- ================================================================

-- ================================================================
-- 1. PGAUDIT EXTENSION (Database Activity Monitoring)
-- ================================================================

-- Install pgaudit for comprehensive database audit logging (skip if not available)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_available_extensions WHERE name = 'pgaudit'
    ) THEN
        CREATE EXTENSION IF NOT EXISTS pgaudit;
        RAISE NOTICE 'pgaudit extension enabled';
    ELSE
        RAISE NOTICE 'pgaudit extension not available - skipping (development mode)';
    END IF;
END $$;

-- Configure pgaudit settings (will be set in postgresql.conf)
-- pgaudit.log = 'ddl, role, function'
-- pgaudit.log_catalog = on
-- pgaudit.log_parameter = on
-- pgaudit.log_relation = on

-- COMMENT ON EXTENSION pgaudit IS 'PostgreSQL Audit Extension for comprehensive database activity logging' (commented out - extension not available);

-- ================================================================
-- 2. FAILED AUTHENTICATION TRACKING
-- ================================================================

-- Table: failed_auth_attempts
-- Tracks all failed authentication attempts for attack detection
CREATE TABLE IF NOT EXISTS failed_auth_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who tried to authenticate
    attempted_identifier VARCHAR(255) NOT NULL, -- email, username, or user_id
    user_id UUID REFERENCES entities(id) ON DELETE SET NULL, -- NULL if user entity doesn't exist
    
    -- Where did they try from
    ip_address INET NOT NULL,
    user_agent TEXT,
    request_id UUID,
    
    -- What failed
    endpoint VARCHAR(100) NOT NULL, -- 'login', 'mfa_verify', 'refresh_token', 'password_reset'
    failure_reason VARCHAR(100) NOT NULL, -- 'invalid_password', 'invalid_mfa', 'account_locked', etc.
    
    -- Additional context
    metadata JSONB DEFAULT '{}', -- Store additional context
    
    -- Timestamps
    attempted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes for fast lookups
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_failed_auth_ip ON failed_auth_attempts(ip_address, attempted_at DESC);
CREATE INDEX idx_failed_auth_user ON failed_auth_attempts(user_id, attempted_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_failed_auth_identifier ON failed_auth_attempts(attempted_identifier, attempted_at DESC);
CREATE INDEX idx_failed_auth_time ON failed_auth_attempts(attempted_at DESC);
CREATE INDEX idx_failed_auth_endpoint ON failed_auth_attempts(endpoint, attempted_at DESC);

COMMENT ON TABLE failed_auth_attempts IS 'Logs all failed authentication attempts for attack detection and forensics';
COMMENT ON COLUMN failed_auth_attempts.attempted_identifier IS 'Email, username, or user_id that was attempted';
COMMENT ON COLUMN failed_auth_attempts.failure_reason IS 'Reason for failure: invalid_password, invalid_mfa, account_locked, rate_limited, etc.';

-- ================================================================
-- 3. SECURITY EVENTS LOG
-- ================================================================

-- Table: security_events
-- Centralized log for all security-related events
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event classification
    event_type VARCHAR(50) NOT NULL, -- 'admin_access', 'privilege_escalation', 'suspicious_query', 'rate_limit_exceeded', etc.
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    
    -- Actor information
    user_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    
    -- Event details
    resource VARCHAR(100), -- What was accessed: 'audit_logs', 'all_sessions', 'admin_panel', etc.
    action VARCHAR(50), -- 'read', 'write', 'delete', 'execute', etc.
    outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('success', 'failure', 'blocked')),
    
    -- Context
    details JSONB DEFAULT '{}', -- Additional event-specific data
    request_id UUID,
    session_id UUID,
    
    -- Timestamps
    detected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Alert status
    alerted BOOLEAN DEFAULT FALSE,
    alerted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_security_events_type ON security_events(event_type, detected_at DESC);
CREATE INDEX idx_security_events_severity ON security_events(severity, detected_at DESC);
CREATE INDEX idx_security_events_user ON security_events(user_id, detected_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_security_events_time ON security_events(detected_at DESC);
CREATE INDEX idx_security_events_not_alerted ON security_events(alerted, severity, detected_at) WHERE NOT alerted;

COMMENT ON TABLE security_events IS 'Centralized security event log for attack detection and forensics';
COMMENT ON COLUMN security_events.event_type IS 'Type: admin_access, privilege_escalation, suspicious_query, rate_limit_exceeded, ransomware_detected, etc.';
COMMENT ON COLUMN security_events.severity IS 'Severity level: info, warning, critical';

-- ================================================================
-- 4. ALERT RULES & THRESHOLDS
-- ================================================================

-- Table: alert_rules
-- Configurable alert rules for security event detection
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Rule identification
    rule_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    
    -- Detection criteria
    event_type VARCHAR(50), -- Match specific event type or NULL for all
    min_severity VARCHAR(20) CHECK (min_severity IN ('info', 'warning', 'critical')),
    
    -- Threshold-based rules
    threshold_count INTEGER, -- Number of events
    threshold_window_minutes INTEGER, -- Within this time window
    
    -- Group by (for counting)
    group_by VARCHAR(50), -- 'ip_address', 'user_id', 'endpoint', 'global'
    
    -- Alert configuration
    alert_channel VARCHAR(50) NOT NULL, -- 'slack', 'discord', 'email', 'pagerduty', 'webhook'
    alert_cooldown_minutes INTEGER DEFAULT 15, -- Don't re-alert for same condition within this time
    
    -- Status
    last_triggered_at TIMESTAMPTZ,
    total_triggers INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE alert_rules IS 'Configurable alert rules for security event detection';

-- Insert default alert rules
INSERT INTO alert_rules (rule_name, description, event_type, min_severity, threshold_count, threshold_window_minutes, group_by, alert_channel)
VALUES
    ('brute_force_single_ip', 'Detect brute force from single IP', 'failed_login', 'warning', 10, 5, 'ip_address', 'slack'),
    ('mass_failed_auth', 'Detect coordinated attack', 'failed_login', 'warning', 50, 60, 'global', 'slack'),
    ('admin_access_attempt', 'Alert on admin endpoint access', 'admin_access', 'warning', 1, 1, NULL, 'slack'),
    ('ransomware_detected', 'Immediate alert on ransomware', 'ransomware_detected', 'critical', 1, 1, NULL, 'pagerduty'),
    ('privilege_escalation', 'Alert on privilege escalation', 'privilege_escalation', 'critical', 1, 1, NULL, 'slack'),
    ('rate_limit_mass_trigger', 'Multiple rate limits hit', 'rate_limit_exceeded', 'warning', 20, 10, 'global', 'slack')
ON CONFLICT (rule_name) DO NOTHING;

-- ================================================================
-- 5. RANSOMWARE DETECTION TRIGGERS
-- ================================================================

-- Table: suspicious_query_log
-- Logs queries that match ransomware patterns
CREATE TABLE IF NOT EXISTS suspicious_query_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Query information
    query_text TEXT NOT NULL,
    query_hash TEXT, -- Hash of query for grouping
    
    -- Detection
    pattern_matched VARCHAR(100) NOT NULL, -- 'mass_update', 'pgp_encrypt', 'mass_delete', etc.
    risk_score INTEGER CHECK (risk_score BETWEEN 1 AND 100),
    
    -- Context
    user_id UUID,
    ip_address INET,
    database_name VARCHAR(100),
    
    -- Action taken
    action_taken VARCHAR(50) NOT NULL, -- 'blocked', 'logged', 'alerted'
    
    detected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_suspicious_query_time ON suspicious_query_log(detected_at DESC);
CREATE INDEX idx_suspicious_query_pattern ON suspicious_query_log(pattern_matched, detected_at DESC);

COMMENT ON TABLE suspicious_query_log IS 'Logs queries matching ransomware or attack patterns';

-- Function: detect_ransomware_patterns
-- Analyzes query text for ransomware indicators
CREATE OR REPLACE FUNCTION detect_ransomware_patterns()
RETURNS TRIGGER AS $$
DECLARE
    risk_score INTEGER := 0;
    pattern_type VARCHAR(100) := 'unknown';
BEGIN
    -- Check for encryption functions (ransomware indicator)
    IF NEW.query ILIKE '%pgp_sym_encrypt%' OR NEW.query ILIKE '%pgp_pub_encrypt%' THEN
        risk_score := risk_score + 80;
        pattern_type := 'encryption_function';
    END IF;
    
    -- Check for mass UPDATE (potential ransomware)
    IF NEW.query ILIKE '%UPDATE % SET%' AND NEW.query NOT ILIKE '%WHERE%' THEN
        risk_score := risk_score + 70;
        pattern_type := 'mass_update_no_where';
    END IF;
    
    -- Check for mass DELETE
    IF NEW.query ILIKE '%DELETE FROM%' AND NEW.query NOT ILIKE '%WHERE%' THEN
        risk_score := risk_score + 90;
        pattern_type := 'mass_delete_no_where';
    END IF;
    
    -- Check for DROP commands
    IF NEW.query ILIKE '%DROP TABLE%' OR NEW.query ILIKE '%DROP DATABASE%' THEN
        risk_score := risk_score + 100;
        pattern_type := 'drop_command';
    END IF;
    
    -- If risky, log it
    IF risk_score > 50 THEN
        INSERT INTO suspicious_query_log (query_text, pattern_matched, risk_score, user_id, database_name, action_taken)
        VALUES (
            LEFT(NEW.query, 1000), -- Limit query length
            pattern_type,
            risk_score,
            NULLIF(current_setting('app.current_user_id', true), '')::UUID,
            current_database(),
            CASE WHEN risk_score > 80 THEN 'blocked' ELSE 'logged' END
        );
        
        -- Insert security event
        INSERT INTO security_events (event_type, severity, resource, action, outcome, details)
        VALUES (
            'ransomware_detected',
            'critical',
            'database',
            'query_execution',
            CASE WHEN risk_score > 80 THEN 'blocked' ELSE 'logged' END,
            jsonb_build_object(
                'risk_score', risk_score,
                'pattern', pattern_type,
                'query_preview', LEFT(NEW.query, 200)
            )
        );
        
        -- Block high-risk queries
        IF risk_score > 80 THEN
            RAISE EXCEPTION 'SECURITY: Suspicious query blocked (risk score: %)', risk_score
                USING HINT = 'This query matches ransomware patterns and has been blocked for security',
                      ERRCODE = 'P0001';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Actual trigger would be on pg_stat_statements or via application layer
-- This is a reference implementation for pattern detection

-- ================================================================
-- 6. MONITORING VIEWS
-- ================================================================

-- View: recent_failed_auth_by_ip
-- Shows failed auth attempts grouped by IP for last 24 hours
CREATE OR REPLACE VIEW recent_failed_auth_by_ip AS
SELECT 
    ip_address,
    COUNT(*) as attempt_count,
    COUNT(DISTINCT attempted_identifier) as unique_identifiers,
    array_agg(DISTINCT endpoint) as endpoints_attempted,
    MIN(attempted_at) as first_attempt,
    MAX(attempted_at) as last_attempt,
    EXTRACT(EPOCH FROM (MAX(attempted_at) - MIN(attempted_at)))/60 as duration_minutes
FROM failed_auth_attempts
WHERE attempted_at > NOW() - INTERVAL '24 hours'
GROUP BY ip_address
HAVING COUNT(*) > 3
ORDER BY attempt_count DESC;

COMMENT ON VIEW recent_failed_auth_by_ip IS 'Failed authentication attempts by IP in last 24 hours';

-- View: security_event_summary
-- Real-time security event dashboard
CREATE OR REPLACE VIEW security_event_summary AS
SELECT 
    event_type,
    severity,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ips,
    MAX(detected_at) as last_occurrence,
    SUM(CASE WHEN NOT alerted THEN 1 ELSE 0 END) as pending_alerts
FROM security_events
WHERE detected_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type, severity
ORDER BY 
    CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'warning' THEN 2 
        ELSE 3 
    END,
    event_count DESC;

COMMENT ON VIEW security_event_summary IS 'Security events summary for last hour';

-- View: alert_effectiveness
-- Shows alert rule performance
CREATE OR REPLACE VIEW alert_effectiveness AS
SELECT 
    rule_name,
    description,
    enabled,
    total_triggers,
    last_triggered_at,
    EXTRACT(EPOCH FROM (NOW() - last_triggered_at))/3600 as hours_since_last_trigger,
    threshold_count,
    threshold_window_minutes,
    alert_channel
FROM alert_rules
ORDER BY total_triggers DESC;

COMMENT ON VIEW alert_effectiveness IS 'Alert rule performance and effectiveness metrics';

-- ================================================================
-- 7. HELPER FUNCTIONS
-- ================================================================

-- Function: log_failed_auth
-- Convenience function to log failed authentication attempts
CREATE OR REPLACE FUNCTION log_failed_auth(
    p_attempted_identifier VARCHAR,
    p_user_id UUID,
    p_ip_address INET,
    p_user_agent TEXT,
    p_endpoint VARCHAR,
    p_failure_reason VARCHAR,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO failed_auth_attempts (
        attempted_identifier,
        user_id,
        ip_address,
        user_agent,
        endpoint,
        failure_reason,
        metadata
    ) VALUES (
        p_attempted_identifier,
        p_user_id,
        p_ip_address,
        p_user_agent,
        p_endpoint,
        p_failure_reason,
        p_metadata
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_failed_auth IS 'Log a failed authentication attempt';

-- Function: log_security_event
-- Convenience function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_event_type VARCHAR,
    p_severity VARCHAR,
    p_user_id UUID,
    p_ip_address INET,
    p_resource VARCHAR,
    p_action VARCHAR,
    p_outcome VARCHAR,
    p_details JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO security_events (
        event_type,
        severity,
        user_id,
        ip_address,
        resource,
        action,
        outcome,
        details
    ) VALUES (
        p_event_type,
        p_severity,
        p_user_id,
        p_ip_address,
        p_resource,
        p_action,
        p_outcome,
        p_details
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_security_event IS 'Log a security event';

-- Function: check_alert_rules
-- Evaluate alert rules and return triggered rules
CREATE OR REPLACE FUNCTION check_alert_rules()
RETURNS TABLE(
    rule_id UUID,
    rule_name VARCHAR,
    event_count BIGINT,
    should_alert BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ar.id as rule_id,
        ar.rule_name,
        COUNT(se.id) as event_count,
        (
            COUNT(se.id) >= ar.threshold_count
            AND
            (ar.last_triggered_at IS NULL OR ar.last_triggered_at < NOW() - (ar.alert_cooldown_minutes || ' minutes')::INTERVAL)
        ) as should_alert
    FROM alert_rules ar
    LEFT JOIN security_events se ON 
        (ar.event_type IS NULL OR se.event_type = ar.event_type)
        AND se.detected_at > NOW() - (ar.threshold_window_minutes || ' minutes')::INTERVAL
        AND (ar.min_severity IS NULL OR 
             (ar.min_severity = 'info') OR
             (ar.min_severity = 'warning' AND se.severity IN ('warning', 'critical')) OR
             (ar.min_severity = 'critical' AND se.severity = 'critical'))
    WHERE ar.enabled
    GROUP BY ar.id, ar.rule_name, ar.threshold_count, ar.alert_cooldown_minutes, ar.last_triggered_at
    HAVING COUNT(se.id) > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_alert_rules IS 'Evaluate alert rules and return which should fire';

-- ================================================================
-- 8. CLEANUP & RETENTION
-- ================================================================

-- Function: cleanup_old_security_logs
-- Remove old logs based on retention policy
CREATE OR REPLACE FUNCTION cleanup_old_security_logs()
RETURNS TABLE(
    failed_auth_deleted INTEGER,
    security_events_deleted INTEGER,
    suspicious_queries_deleted INTEGER
) AS $$
DECLARE
    v_failed_auth_deleted INTEGER;
    v_security_events_deleted INTEGER;
    v_suspicious_queries_deleted INTEGER;
BEGIN
    -- Delete failed auth attempts older than 90 days
    DELETE FROM failed_auth_attempts
    WHERE attempted_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS v_failed_auth_deleted = ROW_COUNT;
    
    -- Delete info-level security events older than 30 days
    DELETE FROM security_events
    WHERE severity = 'info'
    AND detected_at < NOW() - INTERVAL '30 days';
    
    -- Delete warning-level security events older than 90 days
    DELETE FROM security_events
    WHERE severity = 'warning'
    AND detected_at < NOW() - INTERVAL '90 days';
    
    -- Keep critical events for 1 year
    DELETE FROM security_events
    WHERE severity = 'critical'
    AND detected_at < NOW() - INTERVAL '365 days';
    
    GET DIAGNOSTICS v_security_events_deleted = ROW_COUNT;
    
    -- Delete suspicious queries older than 90 days
    DELETE FROM suspicious_query_log
    WHERE detected_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS v_suspicious_queries_deleted = ROW_COUNT;
    
    RETURN QUERY SELECT v_failed_auth_deleted, v_security_events_deleted, v_suspicious_queries_deleted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_security_logs IS 'Cleanup old security logs based on retention policy (90 days for most, 1 year for critical)';

-- ================================================================
-- 9. PERMISSIONS
-- ================================================================

-- Grant read access to app user for logging
GRANT SELECT, INSERT ON failed_auth_attempts TO app;
GRANT SELECT, INSERT ON security_events TO app;
GRANT SELECT, INSERT ON suspicious_query_log TO app;
GRANT SELECT ON alert_rules TO app;

-- Grant access to views
GRANT SELECT ON recent_failed_auth_by_ip TO app;
GRANT SELECT ON security_event_summary TO app;
GRANT SELECT ON alert_effectiveness TO app;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION log_failed_auth TO app;
GRANT EXECUTE ON FUNCTION log_security_event TO app;
GRANT EXECUTE ON FUNCTION check_alert_rules TO app;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Verify tables created
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'failed_auth_attempts',
    'security_events',
    'alert_rules',
    'suspicious_query_log'
);

-- Verify indexes created
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN (
    'failed_auth_attempts',
    'security_events'
);

-- Verify functions created
SELECT proname FROM pg_proc WHERE proname IN (
    'log_failed_auth',
    'log_security_event',
    'check_alert_rules',
    'cleanup_old_security_logs',
    'detect_ransomware_patterns'
);

-- Verify views created
SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname IN (
    'recent_failed_auth_by_ip',
    'security_event_summary',
    'alert_effectiveness'
);

-- Test logging functions
SELECT log_security_event(
    'test_event',
    'info',
    NULL,
    '127.0.0.1'::INET,
    'test_resource',
    'test_action',
    'success',
    '{"test": true}'::JSONB
);

COMMENT ON SCHEMA public IS 'Security monitoring migration complete - Phase 3 deployed';
