-- ================================================================
-- MONITORING ONTOLOGY: Failed Auth, Security Events, Alert Rules
-- Created: 2026-01-18
-- Purpose: Ontology-first approach for security monitoring entities
-- ================================================================

DO $$
DECLARE
    v_version_id UUID;
    v_user_class_id UUID;
    v_failed_auth_class_id UUID;
    v_security_event_class_id UUID;
    v_alert_rule_class_id UUID;
    v_suspicious_query_class_id UUID;
    
    -- Relationship type IDs
    v_triggered_by_type_id UUID;
    v_detected_in_type_id UUID;
    v_monitors_type_id UUID;
    v_targets_type_id UUID;
BEGIN
    -- ================================================================
    -- PHASE 1: Get System Version and Base Classes
    -- ================================================================
    
    -- Get system version
    SELECT id INTO v_version_id FROM ontology_versions WHERE is_system = TRUE LIMIT 1;
    
    IF v_version_id IS NULL THEN
        RAISE EXCEPTION 'System ontology version not found';
    END IF;
    
    -- Get User class
    SELECT id INTO v_user_class_id FROM classes WHERE name = 'User';
    
    IF v_user_class_id IS NULL THEN
        RAISE EXCEPTION 'User class not found';
    END IF;
    
    -- ================================================================
    -- PHASE 2: Create Monitoring Classes
    -- ================================================================
    
    -- FailedAuthAttempt Class
    -- Represents a failed authentication attempt (login, MFA, token refresh, etc.)
    INSERT INTO classes (id, name, description, is_abstract, parent_class_id, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000001',
        'FailedAuthAttempt',
        'A failed authentication attempt tracked for security analysis',
        FALSE,
        NULL,
        v_version_id
    ) ON CONFLICT (name, tenant_id, version_id) DO NOTHING;
    
    SELECT id INTO v_failed_auth_class_id FROM classes WHERE name = 'FailedAuthAttempt';
    
    -- SecurityEvent Class
    -- Represents a security-related event (admin access, privilege escalation, etc.)
    INSERT INTO classes (id, name, description, is_abstract, parent_class_id, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000002',
        'SecurityEvent',
        'A security event detected by the monitoring system',
        FALSE,
        NULL,
        v_version_id
    ) ON CONFLICT (name, tenant_id, version_id) DO NOTHING;
    
    SELECT id INTO v_security_event_class_id FROM classes WHERE name = 'SecurityEvent';
    
    -- AlertRule Class
    -- Represents a configurable alert rule
    INSERT INTO classes (id, name, description, is_abstract, parent_class_id, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000003',
        'AlertRule',
        'A configurable rule for security alerting',
        FALSE,
        NULL,
        v_version_id
    ) ON CONFLICT (name, tenant_id, version_id) DO NOTHING;
    
    SELECT id INTO v_alert_rule_class_id FROM classes WHERE name = 'AlertRule';
    
    -- SuspiciousQuery Class
    -- Represents a potentially malicious database query
    INSERT INTO classes (id, name, description, is_abstract, parent_class_id, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000004',
        'SuspiciousQuery',
        'A database query matching ransomware or attack patterns',
        FALSE,
        NULL,
        v_version_id
    ) ON CONFLICT (name, tenant_id, version_id) DO NOTHING;
    
    SELECT id INTO v_suspicious_query_class_id FROM classes WHERE name = 'SuspiciousQuery';
    
    -- ================================================================
    -- PHASE 3: Create Properties for FailedAuthAttempt
    -- ================================================================
    
    INSERT INTO properties (class_id, name, data_type, is_required, is_sensitive, description, version_id)
    VALUES
        (v_failed_auth_class_id, 'attempted_identifier', 'string', TRUE, FALSE, 'Email, username, or user_id that was attempted', v_version_id),
        (v_failed_auth_class_id, 'ip_address', 'string', TRUE, FALSE, 'IP address of the attempt', v_version_id),
        (v_failed_auth_class_id, 'user_agent', 'string', FALSE, FALSE, 'Browser/client user agent', v_version_id),
        (v_failed_auth_class_id, 'endpoint', 'string', TRUE, FALSE, 'Endpoint: login, mfa_verify, refresh_token, etc.', v_version_id),
        (v_failed_auth_class_id, 'failure_reason', 'string', TRUE, FALSE, 'Reason: invalid_password, invalid_mfa, rate_limited, etc.', v_version_id),
        (v_failed_auth_class_id, 'metadata', 'json', FALSE, FALSE, 'Additional context about the attempt', v_version_id),
        (v_failed_auth_class_id, 'attempted_at', 'datetime', TRUE, FALSE, 'Timestamp of the attempt', v_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;
    
    -- ================================================================
    -- PHASE 4: Create Properties for SecurityEvent
    -- ================================================================
    
    INSERT INTO properties (class_id, name, data_type, is_required, is_sensitive, description, version_id)
    VALUES
        (v_security_event_class_id, 'event_type', 'string', TRUE, FALSE, 'Type: failed_login, admin_access, privilege_escalation, etc.', v_version_id),
        (v_security_event_class_id, 'severity', 'string', TRUE, FALSE, 'Severity: info, warning, critical', v_version_id),
        (v_security_event_class_id, 'ip_address', 'string', FALSE, FALSE, 'IP address of the actor', v_version_id),
        (v_security_event_class_id, 'user_agent', 'string', FALSE, FALSE, 'Browser/client user agent', v_version_id),
        (v_security_event_class_id, 'resource', 'string', FALSE, FALSE, 'Resource accessed: audit_logs, all_sessions, etc.', v_version_id),
        (v_security_event_class_id, 'action', 'string', FALSE, FALSE, 'Action: read, write, delete, execute', v_version_id),
        (v_security_event_class_id, 'outcome', 'string', TRUE, FALSE, 'Outcome: success, failure, blocked', v_version_id),
        (v_security_event_class_id, 'details', 'json', FALSE, FALSE, 'Additional event-specific data', v_version_id),
        (v_security_event_class_id, 'detected_at', 'datetime', TRUE, FALSE, 'When the event was detected', v_version_id),
        (v_security_event_class_id, 'alerted', 'boolean', FALSE, FALSE, 'Whether an alert was sent', v_version_id),
        (v_security_event_class_id, 'alerted_at', 'datetime', FALSE, FALSE, 'When the alert was sent', v_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;
    
    -- ================================================================
    -- PHASE 5: Create Properties for AlertRule
    -- ================================================================
    
    INSERT INTO properties (class_id, name, data_type, is_required, is_sensitive, description, version_id)
    VALUES
        (v_alert_rule_class_id, 'rule_name', 'string', TRUE, FALSE, 'Unique name for the rule', v_version_id),
        (v_alert_rule_class_id, 'description', 'text', FALSE, FALSE, 'Human-readable description', v_version_id),
        (v_alert_rule_class_id, 'enabled', 'boolean', TRUE, FALSE, 'Whether the rule is active', v_version_id),
        (v_alert_rule_class_id, 'event_type', 'string', FALSE, FALSE, 'Event type to match (NULL = all)', v_version_id),
        (v_alert_rule_class_id, 'min_severity', 'string', FALSE, FALSE, 'Minimum severity: info, warning, critical', v_version_id),
        (v_alert_rule_class_id, 'threshold_count', 'integer', FALSE, FALSE, 'Number of events to trigger', v_version_id),
        (v_alert_rule_class_id, 'threshold_window_minutes', 'integer', FALSE, FALSE, 'Time window for threshold', v_version_id),
        (v_alert_rule_class_id, 'group_by', 'string', FALSE, FALSE, 'Group by: ip_address, user_id, endpoint, global', v_version_id),
        (v_alert_rule_class_id, 'alert_channel', 'string', TRUE, FALSE, 'Channel: slack, discord, email, pagerduty', v_version_id),
        (v_alert_rule_class_id, 'alert_cooldown_minutes', 'integer', FALSE, FALSE, 'Cooldown between alerts', v_version_id),
        (v_alert_rule_class_id, 'last_triggered_at', 'datetime', FALSE, FALSE, 'Last time the rule triggered', v_version_id),
        (v_alert_rule_class_id, 'total_triggers', 'integer', FALSE, FALSE, 'Total number of times triggered', v_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;
    
    -- ================================================================
    -- PHASE 6: Create Properties for SuspiciousQuery
    -- ================================================================
    
    INSERT INTO properties (class_id, name, data_type, is_required, is_sensitive, description, version_id)
    VALUES
        (v_suspicious_query_class_id, 'query_text', 'text', TRUE, TRUE, 'The suspicious SQL query', v_version_id),
        (v_suspicious_query_class_id, 'query_hash', 'string', FALSE, FALSE, 'Hash of query for grouping', v_version_id),
        (v_suspicious_query_class_id, 'pattern_matched', 'string', TRUE, FALSE, 'Pattern: mass_update, pgp_encrypt, mass_delete, etc.', v_version_id),
        (v_suspicious_query_class_id, 'risk_score', 'integer', TRUE, FALSE, 'Risk score (1-100)', v_version_id),
        (v_suspicious_query_class_id, 'ip_address', 'string', FALSE, FALSE, 'IP address of the query source', v_version_id),
        (v_suspicious_query_class_id, 'database_name', 'string', FALSE, FALSE, 'Which database was targeted', v_version_id),
        (v_suspicious_query_class_id, 'action_taken', 'string', TRUE, FALSE, 'Action: blocked, logged, alerted', v_version_id),
        (v_suspicious_query_class_id, 'detected_at', 'datetime', TRUE, FALSE, 'When the query was detected', v_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;
    
    -- ================================================================
    -- PHASE 7: Create Relationship Types
    -- ================================================================
    
    -- triggered_by: SecurityEvent triggered_by User
    INSERT INTO relationship_types (id, name, description, source_cardinality, target_cardinality, allowed_source_class_id, allowed_target_class_id, grants_permission_inheritance)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000001',
        'triggered_by',
        'Security event was triggered by a specific user',
        'many',
        'one',
        v_security_event_class_id,
        v_user_class_id,
        FALSE
    ) ON CONFLICT (name) DO NOTHING;
    
    SELECT id INTO v_triggered_by_type_id FROM relationship_types WHERE name = 'triggered_by';
    
    -- detected_in: FailedAuthAttempt detected_in SecurityEvent
    INSERT INTO relationship_types (id, name, description, source_cardinality, target_cardinality, allowed_source_class_id, allowed_target_class_id, grants_permission_inheritance)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000002',
        'detected_in',
        'Failed auth attempt was detected as a security event',
        'many',
        'one',
        v_failed_auth_class_id,
        v_security_event_class_id,
        FALSE
    ) ON CONFLICT (name) DO NOTHING;
    
    SELECT id INTO v_detected_in_type_id FROM relationship_types WHERE name = 'detected_in';
    
    -- monitors: AlertRule monitors SecurityEvent
    INSERT INTO relationship_types (id, name, description, source_cardinality, target_cardinality, allowed_source_class_id, allowed_target_class_id, grants_permission_inheritance)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000003',
        'monitors',
        'Alert rule monitors for specific security events',
        'many',
        'many',
        v_alert_rule_class_id,
        v_security_event_class_id,
        FALSE
    ) ON CONFLICT (name) DO NOTHING;
    
    SELECT id INTO v_monitors_type_id FROM relationship_types WHERE name = 'monitors';
    
    -- targets: SuspiciousQuery targets User
    INSERT INTO relationship_types (id, name, description, source_cardinality, target_cardinality, allowed_source_class_id, allowed_target_class_id, grants_permission_inheritance)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-400000000004',
        'targets',
        'Suspicious query was executed by a user',
        'many',
        'one',
        v_suspicious_query_class_id,
        v_user_class_id,
        FALSE
    ) ON CONFLICT (name) DO NOTHING;
    
    SELECT id INTO v_targets_type_id FROM relationship_types WHERE name = 'targets';
    
    -- ================================================================
    -- PHASE 8: Port Existing Monitoring Data to Ontology
    -- ================================================================
    
    -- Port failed_auth_attempts to entities
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'failed_auth_attempts') THEN
        INSERT INTO entities (id, class_id, display_name, attributes, created_at)
        SELECT 
            fa.id,
            v_failed_auth_class_id,
            'Failed auth: ' || fa.attempted_identifier || ' from ' || fa.ip_address,
            jsonb_build_object(
                'attempted_identifier', fa.attempted_identifier,
                'ip_address', fa.ip_address,
                'user_agent', fa.user_agent,
                'endpoint', fa.endpoint,
                'failure_reason', fa.failure_reason,
                'metadata', fa.metadata,
                'attempted_at', fa.attempted_at
            ),
            fa.created_at
        FROM failed_auth_attempts fa
        WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = fa.id)
        ON CONFLICT (id) DO NOTHING;
        
        -- Create relationships for failed auth attempts with known users
        INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id)
        SELECT DISTINCT
            fa.id,
            fa.user_id,
            v_triggered_by_type_id
        FROM failed_auth_attempts fa
        WHERE fa.user_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM entities e WHERE e.id = fa.user_id)
          AND NOT EXISTS (
              SELECT 1 FROM relationships r
              WHERE r.source_entity_id = fa.id
                AND r.target_entity_id = fa.user_id
                AND r.relationship_type_id = v_triggered_by_type_id
          )
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Port security_events to entities
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_events') THEN
        INSERT INTO entities (id, class_id, display_name, attributes, created_at)
        SELECT 
            se.id,
            v_security_event_class_id,
            se.event_type || ': ' || COALESCE(se.resource, 'system'),
            jsonb_build_object(
                'event_type', se.event_type,
                'severity', se.severity,
                'ip_address', se.ip_address,
                'user_agent', se.user_agent,
                'resource', se.resource,
                'action', se.action,
                'outcome', se.outcome,
                'details', se.details,
                'detected_at', se.detected_at,
                'alerted', se.alerted,
                'alerted_at', se.alerted_at
            ),
            se.created_at
        FROM security_events se
        WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = se.id)
        ON CONFLICT (id) DO NOTHING;
        
        -- Create relationships for security events with users
        INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id)
        SELECT DISTINCT
            se.id,
            se.user_id,
            v_triggered_by_type_id
        FROM security_events se
        WHERE se.user_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM entities e WHERE e.id = se.user_id)
          AND NOT EXISTS (
              SELECT 1 FROM relationships r
              WHERE r.source_entity_id = se.id
                AND r.target_entity_id = se.user_id
                AND r.relationship_type_id = v_triggered_by_type_id
          )
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Port alert_rules to entities
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alert_rules') THEN
        INSERT INTO entities (id, class_id, display_name, attributes, created_at)
        SELECT 
            ar.id,
            v_alert_rule_class_id,
            ar.rule_name,
            jsonb_build_object(
                'rule_name', ar.rule_name,
                'description', ar.description,
                'enabled', ar.enabled,
                'event_type', ar.event_type,
                'min_severity', ar.min_severity,
                'threshold_count', ar.threshold_count,
                'threshold_window_minutes', ar.threshold_window_minutes,
                'group_by', ar.group_by,
                'alert_channel', ar.alert_channel,
                'alert_cooldown_minutes', ar.alert_cooldown_minutes,
                'last_triggered_at', ar.last_triggered_at,
                'total_triggers', ar.total_triggers
            ),
            ar.created_at
        FROM alert_rules ar
        WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = ar.id)
        ON CONFLICT (id) DO NOTHING;
    END IF;
    
    -- Port suspicious_query_log to entities
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suspicious_query_log') THEN
        INSERT INTO entities (id, class_id, display_name, attributes, created_at)
        SELECT 
            sq.id,
            v_suspicious_query_class_id,
            sq.pattern_matched || ' (risk: ' || sq.risk_score || ')',
            jsonb_build_object(
                'query_text', LEFT(sq.query_text, 500),  -- Truncate for display
                'query_hash', sq.query_hash,
                'pattern_matched', sq.pattern_matched,
                'risk_score', sq.risk_score,
                'ip_address', sq.ip_address,
                'database_name', sq.database_name,
                'action_taken', sq.action_taken,
                'detected_at', sq.detected_at
            ),
            sq.created_at
        FROM suspicious_query_log sq
        WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = sq.id)
        ON CONFLICT (id) DO NOTHING;
        
        -- Create relationships for suspicious queries with users
        INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id)
        SELECT DISTINCT
            sq.id,
            sq.user_id,
            v_targets_type_id
        FROM suspicious_query_log sq
        WHERE sq.user_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM entities e WHERE e.id = sq.user_id)
          AND NOT EXISTS (
              SELECT 1 FROM relationships r
              WHERE r.source_entity_id = sq.id
                AND r.target_entity_id = sq.user_id
                AND r.relationship_type_id = v_targets_type_id
          )
        ON CONFLICT DO NOTHING;
    END IF;
    
    RAISE NOTICE 'Monitoring ontology migration complete';
    RAISE NOTICE 'Classes created: FailedAuthAttempt, SecurityEvent, AlertRule, SuspiciousQuery';
    RAISE NOTICE 'Relationship types created: triggered_by, detected_in, monitors, targets';
    RAISE NOTICE 'Existing monitoring data ported to ontology entities';
END $$;

-- ================================================================
-- PHASE 9: Create Monitoring-Specific Permissions
-- ================================================================

-- Get Permission class
DO $$
DECLARE
    v_permission_class_id UUID;
    v_version_id UUID;
BEGIN
    SELECT id INTO v_permission_class_id FROM classes WHERE name = 'Permission';
    SELECT id INTO v_version_id FROM ontology_versions WHERE is_system = TRUE LIMIT 1;
    
    IF v_permission_class_id IS NOT NULL THEN
        -- Create monitoring permissions
        INSERT INTO entities (class_id, display_name, attributes)
        VALUES
            (v_permission_class_id, 'view_failed_auth', jsonb_build_object('name', 'view_failed_auth', 'description', 'View failed authentication attempts', 'level', 10)),
            (v_permission_class_id, 'view_security_events', jsonb_build_object('name', 'view_security_events', 'description', 'View security events', 'level', 15)),
            (v_permission_class_id, 'view_alert_rules', jsonb_build_object('name', 'view_alert_rules', 'description', 'View alert rules', 'level', 10)),
            (v_permission_class_id, 'manage_alert_rules', jsonb_build_object('name', 'manage_alert_rules', 'description', 'Create and modify alert rules', 'level', 50)),
            (v_permission_class_id, 'view_suspicious_queries', jsonb_build_object('name', 'view_suspicious_queries', 'description', 'View suspicious database queries', 'level', 20)),
            (v_permission_class_id, 'view_monitoring_dashboard', jsonb_build_object('name', 'view_monitoring_dashboard', 'description', 'Access monitoring dashboard', 'level', 10))
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ================================================================
-- PHASE 10: Create Views for Ontology-Based Monitoring
-- ================================================================

-- View: monitoring_failed_auth_ontology
-- Unified view of failed auth attempts from ontology
CREATE OR REPLACE VIEW monitoring_failed_auth_ontology AS
SELECT 
    e.id,
    e.display_name,
    (e.attributes->>'attempted_identifier')::VARCHAR as attempted_identifier,
    (e.attributes->>'ip_address')::VARCHAR as ip_address,
    (e.attributes->>'user_agent')::VARCHAR as user_agent,
    (e.attributes->>'endpoint')::VARCHAR as endpoint,
    (e.attributes->>'failure_reason')::VARCHAR as failure_reason,
    (e.attributes->'metadata') as metadata,
    (e.attributes->>'attempted_at')::TIMESTAMPTZ as attempted_at,
    r.target_entity_id as user_id,
    e.created_at
FROM entities e
JOIN classes c ON e.class_id = c.id
LEFT JOIN relationships r ON r.source_entity_id = e.id 
    AND r.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'triggered_by' LIMIT 1)
WHERE c.name = 'FailedAuthAttempt'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW monitoring_failed_auth_ontology IS 'Ontology-based view of failed authentication attempts';

-- View: monitoring_security_events_ontology
-- Unified view of security events from ontology
CREATE OR REPLACE VIEW monitoring_security_events_ontology AS
SELECT 
    e.id,
    e.display_name,
    (e.attributes->>'event_type')::VARCHAR as event_type,
    (e.attributes->>'severity')::VARCHAR as severity,
    (e.attributes->>'ip_address')::VARCHAR as ip_address,
    (e.attributes->>'user_agent')::VARCHAR as user_agent,
    (e.attributes->>'resource')::VARCHAR as resource,
    (e.attributes->>'action')::VARCHAR as action,
    (e.attributes->>'outcome')::VARCHAR as outcome,
    (e.attributes->'details') as details,
    (e.attributes->>'detected_at')::TIMESTAMPTZ as detected_at,
    (e.attributes->>'alerted')::BOOLEAN as alerted,
    (e.attributes->>'alerted_at')::TIMESTAMPTZ as alerted_at,
    r.target_entity_id as user_id,
    e.created_at
FROM entities e
JOIN classes c ON e.class_id = c.id
LEFT JOIN relationships r ON r.source_entity_id = e.id 
    AND r.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'triggered_by' LIMIT 1)
WHERE c.name = 'SecurityEvent'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW monitoring_security_events_ontology IS 'Ontology-based view of security events';

-- View: monitoring_alert_rules_ontology
-- Unified view of alert rules from ontology
CREATE OR REPLACE VIEW monitoring_alert_rules_ontology AS
SELECT 
    e.id,
    e.display_name as rule_name,
    (e.attributes->>'description')::TEXT as description,
    (e.attributes->>'enabled')::BOOLEAN as enabled,
    (e.attributes->>'event_type')::VARCHAR as event_type,
    (e.attributes->>'min_severity')::VARCHAR as min_severity,
    (e.attributes->>'threshold_count')::INTEGER as threshold_count,
    (e.attributes->>'threshold_window_minutes')::INTEGER as threshold_window_minutes,
    (e.attributes->>'group_by')::VARCHAR as group_by,
    (e.attributes->>'alert_channel')::VARCHAR as alert_channel,
    (e.attributes->>'alert_cooldown_minutes')::INTEGER as alert_cooldown_minutes,
    (e.attributes->>'last_triggered_at')::TIMESTAMPTZ as last_triggered_at,
    (e.attributes->>'total_triggers')::INTEGER as total_triggers,
    e.created_at,
    e.updated_at
FROM entities e
JOIN classes c ON e.class_id = c.id
WHERE c.name = 'AlertRule'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW monitoring_alert_rules_ontology IS 'Ontology-based view of alert rules';

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Verify classes created
SELECT name, description FROM classes WHERE name IN (
    'FailedAuthAttempt',
    'SecurityEvent',
    'AlertRule',
    'SuspiciousQuery'
);

-- Verify properties created
SELECT c.name as class_name, p.name as property_name, p.data_type
FROM properties p
JOIN classes c ON p.class_id = c.id
WHERE c.name IN ('FailedAuthAttempt', 'SecurityEvent', 'AlertRule', 'SuspiciousQuery')
ORDER BY c.name, p.name;

-- Verify relationship types created
SELECT name, description FROM relationship_types WHERE name IN (
    'triggered_by',
    'detected_in',
    'monitors',
    'targets'
);

-- Verify entities created
SELECT c.name as class_name, COUNT(e.id) as entity_count
FROM entities e
JOIN classes c ON e.class_id = c.id
WHERE c.name IN ('FailedAuthAttempt', 'SecurityEvent', 'AlertRule', 'SuspiciousQuery')
GROUP BY c.name;

COMMENT ON SCHEMA public IS 'Monitoring ontology migration complete - Entities integrated with ontology';
