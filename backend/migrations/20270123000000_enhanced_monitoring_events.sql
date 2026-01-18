-- ================================================================
-- ENHANCED MONITORING EVENTS: Additional Event Types & Analytics
-- Created: 2026-01-18
-- Purpose: Expand monitoring with more event types and analytics support
-- ================================================================

DO $$
DECLARE
    v_version_id UUID;
    v_session_event_class_id UUID;
    v_api_request_class_id UUID;
    v_permission_change_class_id UUID;
    v_data_access_class_id UUID;
    v_system_event_class_id UUID;
    v_user_class_id UUID;
BEGIN
    -- ================================================================
    -- PHASE 1: Get System Version
    -- ================================================================
    
    SELECT id INTO v_version_id FROM ontology_versions WHERE is_system = TRUE LIMIT 1;
    SELECT id INTO v_user_class_id FROM classes WHERE name = 'User';
    
    IF v_version_id IS NULL THEN
        RAISE EXCEPTION 'System ontology version not found';
    END IF;
    
    -- ================================================================
    -- PHASE 2: Create Additional Monitoring Classes
    -- ================================================================
    
    -- SessionEvent Class
    -- Track user session lifecycle events
    INSERT INTO classes (id, name, description, is_abstract, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000005',
        'SessionEvent',
        'User session lifecycle event (login, logout, timeout, etc.)',
        FALSE,
        v_version_id
    ) ON CONFLICT (name, tenant_id, version_id) DO NOTHING;
    
    SELECT id INTO v_session_event_class_id FROM classes WHERE name = 'SessionEvent';
    
    -- APIRequestEvent Class
    -- Track API request patterns and anomalies
    INSERT INTO classes (id, name, description, is_abstract, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000006',
        'APIRequestEvent',
        'API request event for pattern analysis and anomaly detection',
        FALSE,
        v_version_id
    ) ON CONFLICT (name, tenant_id, version_id) DO NOTHING;
    
    SELECT id INTO v_api_request_class_id FROM classes WHERE name = 'APIRequestEvent';
    
    -- PermissionChangeEvent Class
    -- Track permission and role changes
    INSERT INTO classes (id, name, description, is_abstract, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000007',
        'PermissionChangeEvent',
        'Permission or role change event for audit trail',
        FALSE,
        v_version_id
    ) ON CONFLICT (name, tenant_id, version_id) DO NOTHING;
    
    SELECT id INTO v_permission_change_class_id FROM classes WHERE name = 'PermissionChangeEvent';
    
    -- DataAccessEvent Class
    -- Track sensitive data access
    INSERT INTO classes (id, name, description, is_abstract, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000008',
        'DataAccessEvent',
        'Sensitive data access event for compliance and audit',
        FALSE,
        v_version_id
    ) ON CONFLICT (name, tenant_id, version_id) DO NOTHING;
    
    SELECT id INTO v_data_access_class_id FROM classes WHERE name = 'DataAccessEvent';
    
    -- SystemEvent Class
    -- Track system-level events
    INSERT INTO classes (id, name, description, is_abstract, version_id)
    VALUES (
        'a1b2c3d4-e5f6-7890-abcd-300000000009',
        'SystemEvent',
        'System-level event (service start/stop, errors, health)',
        FALSE,
        v_version_id
    ) ON CONFLICT (name, tenant_id, version_id) DO NOTHING;
    
    SELECT id INTO v_system_event_class_id FROM classes WHERE name = 'SystemEvent';
    
    -- ================================================================
    -- PHASE 3: Define Properties for SessionEvent
    -- ================================================================
    
    INSERT INTO properties (class_id, name, data_type, is_required, description, version_id)
    VALUES
        (v_session_event_class_id, 'session_id', 'uuid', TRUE, 'Session identifier', v_version_id),
        (v_session_event_class_id, 'event_type', 'string', TRUE, 'login, logout, timeout, refresh, hijack_attempt', v_version_id),
        (v_session_event_class_id, 'ip_address', 'string', TRUE, 'Source IP address', v_version_id),
        (v_session_event_class_id, 'user_agent', 'string', FALSE, 'Browser/client user agent', v_version_id),
        (v_session_event_class_id, 'device_fingerprint', 'string', FALSE, 'Device identification', v_version_id),
        (v_session_event_class_id, 'location', 'string', FALSE, 'Geographic location', v_version_id),
        (v_session_event_class_id, 'duration_seconds', 'integer', FALSE, 'Session duration', v_version_id),
        (v_session_event_class_id, 'metadata', 'json', FALSE, 'Additional context', v_version_id),
        (v_session_event_class_id, 'occurred_at', 'datetime', TRUE, 'Event timestamp', v_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;
    
    -- ================================================================
    -- PHASE 4: Define Properties for APIRequestEvent
    -- ================================================================
    
    INSERT INTO properties (class_id, name, data_type, is_required, description, version_id)
    VALUES
        (v_api_request_class_id, 'method', 'string', TRUE, 'HTTP method (GET, POST, etc.)', v_version_id),
        (v_api_request_class_id, 'endpoint', 'string', TRUE, 'API endpoint path', v_version_id),
        (v_api_request_class_id, 'status_code', 'integer', TRUE, 'HTTP status code', v_version_id),
        (v_api_request_class_id, 'response_time_ms', 'integer', TRUE, 'Response time in milliseconds', v_version_id),
        (v_api_request_class_id, 'ip_address', 'string', TRUE, 'Source IP address', v_version_id),
        (v_api_request_class_id, 'user_agent', 'string', FALSE, 'Browser/client user agent', v_version_id),
        (v_api_request_class_id, 'request_size_bytes', 'integer', FALSE, 'Request payload size', v_version_id),
        (v_api_request_class_id, 'response_size_bytes', 'integer', FALSE, 'Response payload size', v_version_id),
        (v_api_request_class_id, 'error_message', 'string', FALSE, 'Error message if failed', v_version_id),
        (v_api_request_class_id, 'is_anomaly', 'boolean', FALSE, 'Flagged as anomalous', v_version_id),
        (v_api_request_class_id, 'metadata', 'json', FALSE, 'Additional request details', v_version_id),
        (v_api_request_class_id, 'occurred_at', 'datetime', TRUE, 'Request timestamp', v_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;
    
    -- ================================================================
    -- PHASE 5: Define Properties for PermissionChangeEvent
    -- ================================================================
    
    INSERT INTO properties (class_id, name, data_type, is_required, description, version_id)
    VALUES
        (v_permission_change_class_id, 'change_type', 'string', TRUE, 'grant, revoke, modify', v_version_id),
        (v_permission_change_class_id, 'permission_name', 'string', FALSE, 'Permission that changed', v_version_id),
        (v_permission_change_class_id, 'role_name', 'string', FALSE, 'Role that changed', v_version_id),
        (v_permission_change_class_id, 'target_entity_id', 'uuid', FALSE, 'Entity affected by change', v_version_id),
        (v_permission_change_class_id, 'changed_by_user_id', 'uuid', TRUE, 'User who made the change', v_version_id),
        (v_permission_change_class_id, 'affected_user_id', 'uuid', FALSE, 'User affected by change', v_version_id),
        (v_permission_change_class_id, 'old_value', 'json', FALSE, 'Previous state', v_version_id),
        (v_permission_change_class_id, 'new_value', 'json', FALSE, 'New state', v_version_id),
        (v_permission_change_class_id, 'justification', 'text', FALSE, 'Reason for change', v_version_id),
        (v_permission_change_class_id, 'ip_address', 'string', FALSE, 'Source IP', v_version_id),
        (v_permission_change_class_id, 'occurred_at', 'datetime', TRUE, 'Change timestamp', v_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;
    
    -- ================================================================
    -- PHASE 6: Define Properties for DataAccessEvent
    -- ================================================================
    
    INSERT INTO properties (class_id, name, data_type, is_required, is_sensitive, description, version_id)
    VALUES
        (v_data_access_class_id, 'data_type', 'string', TRUE, FALSE, 'Type: user_data, financial, pii, health, etc.', v_version_id),
        (v_data_access_class_id, 'access_type', 'string', TRUE, FALSE, 'read, write, delete, export', v_version_id),
        (v_data_access_class_id, 'entity_type', 'string', TRUE, FALSE, 'Entity class accessed', v_version_id),
        (v_data_access_class_id, 'entity_id', 'uuid', TRUE, FALSE, 'Specific entity accessed', v_version_id),
        (v_data_access_class_id, 'field_accessed', 'string', FALSE, TRUE, 'Specific field/property', v_version_id),
        (v_data_access_class_id, 'purpose', 'string', FALSE, FALSE, 'Purpose of access', v_version_id),
        (v_data_access_class_id, 'ip_address', 'string', FALSE, FALSE, 'Source IP', v_version_id),
        (v_data_access_class_id, 'is_bulk_operation', 'boolean', FALSE, FALSE, 'Bulk data access', v_version_id),
        (v_data_access_class_id, 'record_count', 'integer', FALSE, FALSE, 'Number of records', v_version_id),
        (v_data_access_class_id, 'metadata', 'json', FALSE, FALSE, 'Additional context', v_version_id),
        (v_data_access_class_id, 'occurred_at', 'datetime', TRUE, FALSE, 'Access timestamp', v_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;
    
    -- ================================================================
    -- PHASE 7: Define Properties for SystemEvent
    -- ================================================================
    
    INSERT INTO properties (class_id, name, data_type, is_required, description, version_id)
    VALUES
        (v_system_event_class_id, 'event_type', 'string', TRUE, 'service_start, service_stop, error, health_check, etc.', v_version_id),
        (v_system_event_class_id, 'severity', 'string', TRUE, 'info, warning, error, critical', v_version_id),
        (v_system_event_class_id, 'service_name', 'string', TRUE, 'Name of the service', v_version_id),
        (v_system_event_class_id, 'component', 'string', FALSE, 'Component/module name', v_version_id),
        (v_system_event_class_id, 'error_message', 'text', FALSE, 'Error details', v_version_id),
        (v_system_event_class_id, 'stack_trace', 'text', FALSE, 'Stack trace if error', v_version_id),
        (v_system_event_class_id, 'metrics', 'json', FALSE, 'System metrics (CPU, memory, etc.)', v_version_id),
        (v_system_event_class_id, 'version', 'string', FALSE, 'Service version', v_version_id),
        (v_system_event_class_id, 'metadata', 'json', FALSE, 'Additional context', v_version_id),
        (v_system_event_class_id, 'occurred_at', 'datetime', TRUE, 'Event timestamp', v_version_id)
    ON CONFLICT (name, class_id) DO NOTHING;
    
    -- ================================================================
    -- PHASE 8: Create Additional Relationship Types
    -- ================================================================
    
    -- performed_on: APIRequestEvent performed_on Entity
    INSERT INTO relationship_types (name, description, source_cardinality, target_cardinality, grants_permission_inheritance)
    VALUES (
        'performed_on',
        'API request was performed on a specific entity',
        'many',
        'one',
        FALSE
    ) ON CONFLICT (name) DO NOTHING;
    
    -- affects: PermissionChangeEvent affects User
    INSERT INTO relationship_types (name, description, source_cardinality, target_cardinality, grants_permission_inheritance)
    VALUES (
        'affects',
        'Permission change affects a specific user',
        'many',
        'one',
        FALSE
    ) ON CONFLICT (name) DO NOTHING;
    
    -- accesses: DataAccessEvent accesses Entity
    INSERT INTO relationship_types (name, description, source_cardinality, target_cardinality, grants_permission_inheritance)
    VALUES (
        'accesses',
        'Data access event accesses a specific entity',
        'many',
        'one',
        FALSE
    ) ON CONFLICT (name) DO NOTHING;
    
    -- ================================================================
    -- PHASE 9: Create Analytics-Focused Permissions
    -- ================================================================
    
    INSERT INTO entities (class_id, display_name, attributes)
    SELECT 
        id,
        'view_analytics_dashboard',
        jsonb_build_object(
            'name', 'view_analytics_dashboard',
            'description', 'Access monitoring analytics dashboard',
            'level', 20
        )
    FROM classes WHERE name = 'Permission'
    ON CONFLICT DO NOTHING;
    
    INSERT INTO entities (class_id, display_name, attributes)
    SELECT 
        id,
        'view_session_events',
        jsonb_build_object(
            'name', 'view_session_events',
            'description', 'View user session events',
            'level', 15
        )
    FROM classes WHERE name = 'Permission'
    ON CONFLICT DO NOTHING;
    
    INSERT INTO entities (class_id, display_name, attributes)
    SELECT 
        id,
        'view_api_requests',
        jsonb_build_object(
            'name', 'view_api_requests',
            'description', 'View API request events',
            'level', 15
        )
    FROM classes WHERE name = 'Permission'
    ON CONFLICT DO NOTHING;
    
    INSERT INTO entities (class_id, display_name, attributes)
    SELECT 
        id,
        'view_permission_changes',
        jsonb_build_object(
            'name', 'view_permission_changes',
            'description', 'View permission change audit trail',
            'level', 25
        )
    FROM classes WHERE name = 'Permission'
    ON CONFLICT DO NOTHING;
    
    INSERT INTO entities (class_id, display_name, attributes)
    SELECT 
        id,
        'view_data_access_logs',
        jsonb_build_object(
            'name', 'view_data_access_logs',
            'description', 'View sensitive data access logs',
            'level', 30
        )
    FROM classes WHERE name = 'Permission'
    ON CONFLICT DO NOTHING;
    
    INSERT INTO entities (class_id, display_name, attributes)
    SELECT 
        id,
        'view_system_events',
        jsonb_build_object(
            'name', 'view_system_events',
            'description', 'View system-level events and errors',
            'level', 20
        )
    FROM classes WHERE name = 'Permission'
    ON CONFLICT DO NOTHING;
    
    -- ================================================================
    -- PHASE 10: Create Analytics Views
    -- ================================================================
    
    -- View: monitoring_events_timeline
    -- Unified timeline of all monitoring events
    CREATE OR REPLACE VIEW monitoring_events_timeline AS
    SELECT 
        e.id,
        c.name as event_class,
        e.display_name,
        COALESCE(
            (e.attributes->>'occurred_at')::TIMESTAMPTZ,
            (e.attributes->>'detected_at')::TIMESTAMPTZ,
            (e.attributes->>'attempted_at')::TIMESTAMPTZ,
            e.created_at
        ) as occurred_at,
        COALESCE(
            e.attributes->>'severity',
            'info'
        ) as severity,
        e.attributes,
        r.target_entity_id as user_id
    FROM entities e
    JOIN classes c ON c.id = e.class_id
    LEFT JOIN relationships r ON r.source_entity_id = e.id 
        AND r.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'triggered_by' LIMIT 1)
    WHERE c.name IN (
        'FailedAuthAttempt',
        'SecurityEvent',
        'SessionEvent',
        'APIRequestEvent',
        'PermissionChangeEvent',
        'DataAccessEvent',
        'SystemEvent'
    )
      AND e.deleted_at IS NULL
    ORDER BY occurred_at DESC;
    
    COMMENT ON VIEW monitoring_events_timeline IS 'Unified timeline view of all monitoring events from ontology';
    
    -- View: monitoring_events_by_hour
    -- Hourly aggregation of events
    CREATE OR REPLACE VIEW monitoring_events_by_hour AS
    SELECT 
        date_trunc('hour', occurred_at) as hour,
        event_class,
        severity,
        COUNT(*) as event_count
    FROM monitoring_events_timeline
    WHERE occurred_at > NOW() - INTERVAL '24 hours'
    GROUP BY date_trunc('hour', occurred_at), event_class, severity
    ORDER BY hour DESC, event_count DESC;
    
    COMMENT ON VIEW monitoring_events_by_hour IS 'Hourly event counts for last 24 hours';
    
    -- View: monitoring_top_attacking_ips
    -- Top IPs by suspicious activity
    CREATE OR REPLACE VIEW monitoring_top_attacking_ips AS
    SELECT 
        COALESCE(
            attributes->>'ip_address',
            ''
        ) as ip_address,
        event_class,
        COUNT(*) as event_count,
        MIN(occurred_at) as first_seen,
        MAX(occurred_at) as last_seen,
        array_agg(DISTINCT severity) as severities
    FROM monitoring_events_timeline
    WHERE occurred_at > NOW() - INTERVAL '24 hours'
      AND (
          severity IN ('warning', 'critical')
          OR event_class IN ('FailedAuthAttempt', 'SuspiciousQuery')
      )
      AND attributes->>'ip_address' IS NOT NULL
    GROUP BY attributes->>'ip_address', event_class
    HAVING COUNT(*) > 3
    ORDER BY event_count DESC
    LIMIT 100;
    
    COMMENT ON VIEW monitoring_top_attacking_ips IS 'Top suspicious IPs in last 24 hours';
    
    -- View: monitoring_user_activity_summary
    -- User activity aggregation
    CREATE OR REPLACE VIEW monitoring_user_activity_summary AS
    SELECT 
        user_id,
        u.attributes->>'username' as username,
        u.attributes->>'email' as email,
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE event_class = 'FailedAuthAttempt') as failed_auths,
        COUNT(*) FILTER (WHERE event_class = 'SessionEvent') as session_events,
        COUNT(*) FILTER (WHERE event_class = 'APIRequestEvent') as api_requests,
        COUNT(*) FILTER (WHERE event_class = 'DataAccessEvent') as data_accesses,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
        MIN(occurred_at) as first_event,
        MAX(occurred_at) as last_event
    FROM monitoring_events_timeline t
    JOIN entities u ON u.id = t.user_id
    WHERE occurred_at > NOW() - INTERVAL '7 days'
      AND user_id IS NOT NULL
    GROUP BY user_id, u.attributes->>'username', u.attributes->>'email'
    ORDER BY total_events DESC
    LIMIT 1000;
    
    COMMENT ON VIEW monitoring_user_activity_summary IS 'User activity summary for last 7 days';
    
    RAISE NOTICE 'Enhanced monitoring events migration complete';
    RAISE NOTICE 'New classes: SessionEvent, APIRequestEvent, PermissionChangeEvent, DataAccessEvent, SystemEvent';
    RAISE NOTICE 'New permissions: 6 analytics-focused permissions';
    RAISE NOTICE 'New views: 4 analytics views';
END $$;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Verify new classes
SELECT name, description FROM classes WHERE name IN (
    'SessionEvent',
    'APIRequestEvent',
    'PermissionChangeEvent',
    'DataAccessEvent',
    'SystemEvent'
);

-- Count properties per class
SELECT c.name as class_name, COUNT(p.id) as property_count
FROM properties p
JOIN classes c ON p.class_id = c.id
WHERE c.name IN (
    'SessionEvent',
    'APIRequestEvent',
    'PermissionChangeEvent',
    'DataAccessEvent',
    'SystemEvent'
)
GROUP BY c.name;

-- Verify views created
SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname LIKE 'monitoring_%';

COMMENT ON SCHEMA public IS 'Enhanced monitoring events - 5 new classes, 4 analytics views';
