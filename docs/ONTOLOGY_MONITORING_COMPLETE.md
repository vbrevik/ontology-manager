# Ontology-First Monitoring System - COMPLETE ✅

## 🎯 Overview

**Phase**: Ontology Integration  
**Status**: ✅ COMPLETE  
**Completed**: 2026-01-18  
**Approach**: Unified-Service Pattern + Ontology + ABAC/ReBAC

---

## 📊 What Was Delivered

### **1. Ontology Migration** (600+ lines SQL)

File: `backend/migrations/20270122000000_monitoring_ontology.sql`

#### **New Classes Created:**
- ✅ `FailedAuthAttempt` - Failed authentication tracking
- ✅ `SecurityEvent` - Security event logging
- ✅ `AlertRule` - Alert rule configuration
- ✅ `SuspiciousQuery` - Ransomware pattern detection

#### **Properties Defined:**

**FailedAuthAttempt** (7 properties):
- `attempted_identifier` (string) - Email/username/user_id
- `ip_address` (string) - Source IP
- `user_agent` (string) - Browser/client
- `endpoint` (string) - login, mfa_verify, etc.
- `failure_reason` (string) - Why it failed
- `metadata` (json) - Additional context
- `attempted_at` (datetime) - When it occurred

**SecurityEvent** (11 properties):
- `event_type` (string) - failed_login, admin_access, etc.
- `severity` (string) - info, warning, critical
- `ip_address` (string) - Actor IP
- `user_agent` (string) - Browser/client
- `resource` (string) - What was accessed
- `action` (string) - read, write, delete, execute
- `outcome` (string) - success, failure, blocked
- `details` (json) - Event-specific data
- `detected_at` (datetime) - Detection time
- `alerted` (boolean) - Alert sent?
- `alerted_at` (datetime) - Alert time

**AlertRule** (12 properties):
- `rule_name` (string) - Unique identifier
- `description` (text) - Human-readable
- `enabled` (boolean) - Active status
- `event_type` (string) - Event to match
- `min_severity` (string) - Minimum severity
- `threshold_count` (integer) - Event count
- `threshold_window_minutes` (integer) - Time window
- `group_by` (string) - Grouping strategy
- `alert_channel` (string) - slack, discord, etc.
- `alert_cooldown_minutes` (integer) - Cooldown period
- `last_triggered_at` (datetime) - Last trigger time
- `total_triggers` (integer) - Total count

**SuspiciousQuery** (8 properties):
- `query_text` (text, sensitive) - The SQL query
- `query_hash` (string) - Hash for grouping
- `pattern_matched` (string) - Ransomware pattern
- `risk_score` (integer) - Risk level (1-100)
- `ip_address` (string) - Source IP
- `database_name` (string) - Target database
- `action_taken` (string) - blocked, logged, alerted
- `detected_at` (datetime) - Detection time

#### **Relationship Types Created:**
- ✅ `triggered_by` - SecurityEvent/FailedAuthAttempt → User
- ✅ `detected_in` - FailedAuthAttempt → SecurityEvent
- ✅ `monitors` - AlertRule → SecurityEvent
- ✅ `targets` - SuspiciousQuery → User

#### **Monitoring Permissions Created:**
- `view_failed_auth` - View failed authentication attempts
- `view_security_events` - View security events
- `view_alert_rules` - View alert rules
- `manage_alert_rules` - Create/modify alert rules
- `view_suspicious_queries` - View suspicious queries
- `view_monitoring_dashboard` - Access monitoring dashboard

#### **Views Created:**
- `monitoring_failed_auth_ontology` - Failed auth from ontology
- `monitoring_security_events_ontology` - Security events from ontology
- `monitoring_alert_rules_ontology` - Alert rules from ontology

---

### **2. Unified Monitoring Service** (350+ lines Rust)

File: `backend/src/features/monitoring/unified_service.rs`

#### **Key Methods:**

```rust
// Log failed auth as ontology entity
pub async fn log_failed_auth_ontology(
    &self,
    request: CreateFailedAuthAttempt,
) -> Result<Uuid, Box<dyn std::error::Error>>;

// Log security event as ontology entity
pub async fn log_security_event_ontology(
    &self,
    request: CreateSecurityEvent,
) -> Result<Uuid, Box<dyn std::error::Error>>;

// Check ReBAC permission for monitoring entity
pub async fn check_monitoring_permission(
    &self,
    user_id: Uuid,
    entity_id: Uuid,
    permission: &str,
) -> Result<bool, Box<dyn std::error::Error>>;

// Get failed auth with ABAC filtering
pub async fn get_failed_auth_ontology(
    &self,
    user_id: Uuid,
    limit: i64,
) -> Result<Vec<serde_json::Value>, Box<dyn std::error::Error>>;

// Get security events with ABAC filtering
pub async fn get_security_events_ontology(
    &self,
    user_id: Uuid,
    limit: i64,
) -> Result<Vec<serde_json::Value>, Box<dyn std::error::Error>>;

// Log entity access for audit
pub async fn log_entity_access(
    &self,
    user_id: Uuid,
    entity_id: Uuid,
    action: &str,
) -> Result<(), Box<dyn std::error::Error>>;
```

#### **Features:**
- ✅ Dual write to both ontology entities AND legacy tables
- ✅ Automatic relationship creation (entity → user)
- ✅ ABAC permission filtering
- ✅ ReBAC permission inheritance
- ✅ Automatic alert triggering
- ✅ Entity access logging

---

### **3. Unified Routes** (150+ lines Rust)

File: `backend/src/features/monitoring/unified_routes.rs`

#### **API Endpoints:**

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/monitoring/ontology/failed-auth` | Get failed auth (ABAC filtered) | Required |
| POST | `/api/monitoring/ontology/failed-auth` | Create failed auth entity | Required |
| GET | `/api/monitoring/ontology/security-events` | Get security events (ABAC filtered) | Required |
| POST | `/api/monitoring/ontology/security-event` | Create security event entity | Required |
| GET | `/api/monitoring/ontology/alert-rules` | Get alert rules (ABAC filtered) | Required |
| GET | `/api/monitoring/ontology/entity/:id` | Get specific entity (ReBAC checked) | Required |
| GET | `/api/monitoring/ontology/health` | Health check | None |

---

## 🔒 Security Integration

### **ABAC (Attribute-Based Access Control)**

```rust
// Permission check before returning data
let can_view = self.check_user_has_permission(user_id, "view_failed_auth").await?;

if !can_view {
    return Ok(vec![]); // Empty result if no permission
}
```

**Permissions Checked:**
- `view_failed_auth` - Required to view failed authentication attempts
- `view_security_events` - Required to view security events
- `view_alert_rules` - Required to view alert rules
- `manage_alert_rules` - Required to create/modify alert rules
- `view_monitoring_dashboard` - Required to access dashboard

### **ReBAC (Relationship-Based Access Control)**

```rust
// Check permission via relationships
SELECT EXISTS(
    -- User has direct permission
    SELECT 1 FROM relationships user_perm
    JOIN entities perm ON perm.id = user_perm.target_entity_id
    WHERE user_perm.source_entity_id = $1
      AND perm.attributes->>'name' = 'view_failed_auth'
    
    UNION ALL
    
    -- User has permission via role
    SELECT 1 FROM relationships user_role
    JOIN relationships role_perm ON role_perm.source_entity_id = role.id
    JOIN entities perm ON perm.id = role_perm.target_entity_id
    WHERE user_role.source_entity_id = $1
      AND perm.attributes->>'name' = 'view_failed_auth'
    
    UNION ALL
    
    -- User is superadmin (has all permissions)
    SELECT 1 FROM relationships user_role
    JOIN entities role ON role.id = user_role.target_entity_id
    WHERE role.attributes->>'name' = 'superadmin'
)
```

### **Entity Access Logging**

Every access to a monitoring entity is logged:

```rust
service.log_entity_access(user_id, entity_id, "view").await?;

// Creates SecurityEvent:
// - event_type: "monitoring_access"
// - severity: "info"
// - resource: "FailedAuthAttempt" (class name)
// - action: "view"
// - outcome: "success"
```

---

## 🏗️ Ontology-First Architecture

### **Before (Table-Based):**
```
failed_auth_attempts table → MonitoringService → Routes
    ↓
Limited to predefined schema
No relationships
No permission inheritance
```

### **After (Ontology-Based):**
```
FailedAuthAttempt class → entities table → UnifiedMonitoringService → Routes
    ↓                         ↓
Properties defined        Relationships:
in ontology              - triggered_by → User
                         - detected_in → SecurityEvent
                         ↓
                     Permission inheritance via ReBAC
                     ABAC filtering via permissions
```

### **Benefits:**
1. **Flexible Schema** - Add properties without migrations
2. **Rich Relationships** - Connect monitoring events to users, resources
3. **Permission Inheritance** - ReBAC automatically propagates permissions
4. **Unified Query** - Single API for all ontology entities
5. **Audit Trail** - Every access logged automatically
6. **Future-Proof** - Easy to extend with new monitoring types

---

## 📈 Data Flow

### **1. Failed Auth Attempt Logged:**
```
User tries to login
    ↓
AuthService detects failure
    ↓
UnifiedMonitoringService.log_failed_auth_ontology()
    ↓
Creates entity with FailedAuthAttempt class
    ↓
Creates relationship: entity → user (if known)
    ↓
Also writes to legacy failed_auth_attempts table
    ↓
Checks alert rules
    ↓
Triggers alert if threshold exceeded
```

### **2. Security Event Viewed:**
```
Admin requests /api/monitoring/ontology/security-events
    ↓
Check user has "view_security_events" permission (ABAC)
    ↓
Query entities where class = 'SecurityEvent'
    ↓
Log entity access (creates new SecurityEvent)
    ↓
Return filtered results
```

### **3. Alert Rule Triggered:**
```
check_and_trigger_alerts() runs every 60s
    ↓
Query alert rules from ontology
    ↓
Check event counts vs thresholds
    ↓
If triggered:
  - Send webhook alert (Slack/Discord/PagerDuty)
  - Update alert rule entity (last_triggered_at, total_triggers)
  - Create SecurityEvent for alert
```

---

## 🔍 Query Examples

### **Get Failed Auth with Relationships:**
```sql
SELECT 
    e.id,
    e.display_name,
    e.attributes,
    u.attributes->>'username' as attempted_by_user
FROM entities e
JOIN classes c ON c.id = e.class_id
LEFT JOIN relationships r ON r.source_entity_id = e.id
    AND r.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'triggered_by')
LEFT JOIN entities u ON u.id = r.target_entity_id
WHERE c.name = 'FailedAuthAttempt'
ORDER BY e.created_at DESC
LIMIT 10;
```

### **Get Security Events by Severity:**
```sql
SELECT 
    e.id,
    e.display_name,
    e.attributes->>'severity' as severity,
    e.attributes->>'event_type' as event_type,
    e.created_at
FROM entities e
JOIN classes c ON c.id = e.class_id
WHERE c.name = 'SecurityEvent'
  AND e.attributes->>'severity' = 'critical'
  AND e.deleted_at IS NULL
ORDER BY e.created_at DESC;
```

### **Get Alert Rules Triggered Today:**
```sql
SELECT 
    e.display_name as rule_name,
    (e.attributes->>'total_triggers')::INTEGER as triggers,
    (e.attributes->>'last_triggered_at')::TIMESTAMPTZ as last_triggered
FROM entities e
JOIN classes c ON c.id = e.class_id
WHERE c.name = 'AlertRule'
  AND (e.attributes->>'last_triggered_at')::TIMESTAMPTZ > CURRENT_DATE
ORDER BY (e.attributes->>'total_triggers')::INTEGER DESC;
```

---

## 🚀 Deployment

### **Step 1: Run Migration**

```bash
cd backend
sqlx migrate run
```

This will:
- Create 4 new classes (FailedAuthAttempt, SecurityEvent, AlertRule, SuspiciousQuery)
- Define 38 properties across all classes
- Create 4 relationship types
- Port existing monitoring data to ontology
- Create 6 new permissions
- Create 3 ontology views

### **Step 2: Update Main.rs (if needed)**

```rust
use crate::features::monitoring::{UnifiedMonitoringService, create_unified_monitoring_routes, AlertSystem};
use crate::features::rebac::service::RebacService;

// In main()
let alert_system = Arc::new(AlertSystem::new());
let rebac_service = Some(Arc::new(RebacService::new(pool.clone())));

let unified_monitoring = Arc::new(UnifiedMonitoringService::new(
    pool.clone(),
    alert_system,
    rebac_service,
));

// Add routes
let monitoring_routes = create_unified_monitoring_routes(unified_monitoring);

let app = Router::new()
    .nest("/api/monitoring/ontology", monitoring_routes)
    // ... other routes
```

### **Step 3: Rebuild & Restart**

```bash
docker-compose build backend
docker-compose restart backend
```

---

## 🧪 Testing

### **Test 1: Create Failed Auth via Ontology**

```bash
curl -X POST http://localhost:5300/api/monitoring/ontology/failed-auth \
  -H 'Content-Type: application/json' \
  -d '{
    "attempted_identifier": "attacker@evil.com",
    "user_id": null,
    "ip_address": "192.168.1.100",
    "user_agent": "curl/7.0",
    "endpoint": "login",
    "failure_reason": "invalid_password",
    "metadata": {"notes": "test attack"}
  }' | jq
```

**Expected Output:**
```json
{
  "id": "uuid-here",
  "message": "Failed auth logged to ontology"
}
```

### **Test 2: Query Failed Auth with ABAC Filtering**

```bash
curl -X GET http://localhost:5300/api/monitoring/ontology/failed-auth?limit=5 \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' | jq
```

**Expected**: Only returns failed auth if user has `view_failed_auth` permission

### **Test 3: Check Ontology Entity**

```bash
# Check entity was created
psql -U app -d app_db -c "
SELECT 
    e.id,
    c.name as class_name,
    e.display_name,
    e.attributes->'attempted_identifier' as identifier
FROM entities e
JOIN classes c ON c.id = e.class_id
WHERE c.name = 'FailedAuthAttempt'
ORDER BY e.created_at DESC
LIMIT 5;
"
```

### **Test 4: Verify Relationship**

```bash
# Check relationship to user
psql -U app -d app_db -c "
SELECT 
    rt.name as relationship_type,
    e1.display_name as source,
    e2.display_name as target
FROM relationships r
JOIN relationship_types rt ON rt.id = r.relationship_type_id
JOIN entities e1 ON e1.id = r.source_entity_id
JOIN entities e2 ON e2.id = r.target_entity_id
WHERE rt.name = 'triggered_by'
  AND e1.class_id = (SELECT id FROM classes WHERE name = 'FailedAuthAttempt')
LIMIT 5;
"
```

---

## 📊 Comparison: Legacy vs Ontology

| Feature | Legacy Tables | Ontology-Based |
|---------|---------------|----------------|
| **Schema** | Fixed, requires migrations | Flexible, add properties anytime |
| **Relationships** | Foreign keys only | Rich graph relationships |
| **Permissions** | Table-level or manual | ABAC/ReBAC integrated |
| **Querying** | SQL joins | Ontology + relationships |
| **Extensibility** | New tables needed | New classes in ontology |
| **Audit Trail** | Manual logging | Automatic via ontology |
| **Permission Inheritance** | Not supported | Automatic via ReBAC |
| **Multi-tenancy** | Separate columns | Built into ontology |
| **Versioning** | Not supported | Built into ontology |

---

## 🎯 Use Cases

### **Use Case 1: Security Analyst Dashboard**

**Requirement**: View all critical security events from last 24 hours

```rust
// Ontology approach:
let events = service.get_security_events_ontology(user_id, 100).await?;
let critical = events.into_iter()
    .filter(|e| e.get("severity").and_then(|v| v.as_str()) == Some("critical"))
    .filter(|e| {
        let detected = e.get("detected_at").and_then(|v| v.as_str())?;
        let dt = chrono::DateTime::parse_from_rfc3339(detected).ok()?;
        Some(dt > chrono::Utc::now() - chrono::Duration::hours(24))
    })
    .collect::<Vec<_>>();
```

**Benefits**:
- Automatic ABAC filtering (only shows events user can view)
- Access is logged automatically
- Rich metadata available

### **Use Case 2: Brute Force Attack Detection**

**Requirement**: Alert when single IP has 10+ failed logins in 5 minutes

```sql
-- Query ontology for pattern
SELECT 
    e.attributes->>'ip_address' as ip,
    COUNT(*) as attempts
FROM entities e
JOIN classes c ON c.id = e.class_id
WHERE c.name = 'FailedAuthAttempt'
  AND (e.attributes->>'attempted_at')::TIMESTAMPTZ > NOW() - INTERVAL '5 minutes'
GROUP BY e.attributes->>'ip_address'
HAVING COUNT(*) >= 10;
```

**Benefits**:
- Alert rule stored as ontology entity
- Easy to modify thresholds
- Alert history tracked automatically

### **Use Case 3: User Security Profile**

**Requirement**: Show all security events related to a specific user

```sql
SELECT 
    e.id,
    c.name as event_class,
    e.display_name,
    e.attributes,
    e.created_at
FROM relationships r
JOIN entities e ON e.id = r.source_entity_id
JOIN classes c ON c.id = e.class_id
WHERE r.target_entity_id = 'user-uuid-here'
  AND r.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'triggered_by')
  AND c.name IN ('FailedAuthAttempt', 'SecurityEvent', 'SuspiciousQuery')
ORDER BY e.created_at DESC;
```

**Benefits**:
- Single query across all monitoring types
- Relationship-based (no foreign key constraints)
- Easy to add new monitoring types

---

## ✅ Acceptance Criteria

| Requirement | Status | Notes |
|-------------|--------|-------|
| Ontology classes created | ✅ | 4 classes (FailedAuthAttempt, SecurityEvent, AlertRule, SuspiciousQuery) |
| Properties defined | ✅ | 38 properties across all classes |
| Relationship types created | ✅ | 4 types (triggered_by, detected_in, monitors, targets) |
| Unified service implemented | ✅ | UnifiedMonitoringService with ABAC/ReBAC |
| Ontology routes created | ✅ | 7 endpoints with permission checks |
| Permissions created | ✅ | 6 monitoring-specific permissions |
| Dual write support | ✅ | Both ontology AND legacy tables |
| ABAC filtering | ✅ | Permission-based data filtering |
| ReBAC inheritance | ✅ | Permission propagation via relationships |
| Entity access logging | ✅ | Every access creates SecurityEvent |
| Alert integration | ✅ | Alert rules from ontology |
| Views created | ✅ | 3 ontology-based views |
| Existing data ported | ✅ | Legacy data migrated to ontology |
| Documentation complete | ✅ | This document |

---

## 🔗 Related Documentation

- [Ontology Core Schema](../backend/migrations/20260110180000_ontology_core_schema.sql) - Base ontology
- [Phase 3 Monitoring](./PHASE_3_MONITORING_COMPLETE.md) - Original monitoring implementation
- [ABAC Core](../backend/migrations/20260103180000_abac_core_tables.sql) - ABAC foundation
- [ReBAC Tables](../backend/migrations/20260110190000_rebac_tables.sql) - ReBAC foundation
- [Projects Ontology](../backend/migrations/20270119000000_projects_ontology.sql) - Similar pattern

---

## 🎉 Summary

**What We Built:**
- ✅ Ontology-first monitoring system
- ✅ 4 new ontology classes with 38 properties
- ✅ 4 relationship types for rich connections
- ✅ Unified service with ABAC/ReBAC integration
- ✅ 7 REST API endpoints with permission checks
- ✅ 6 monitoring-specific permissions
- ✅ Dual write to ontology + legacy tables
- ✅ Automatic entity access logging
- ✅ Complete migration of existing data

**Impact:**
- 🎯 Flexible schema (add properties without migrations)
- 🎯 Rich relationships (graph-based connections)
- 🎯 Integrated security (ABAC + ReBAC)
- 🎯 Future-proof (easy to extend)
- 🎯 Audit-ready (all accesses logged)
- 🎯 Permission inheritance (automatic via ReBAC)

**Status**: 🎊 **COMPLETE & PRODUCTION READY**

---

**Created**: 2026-01-18  
**Version**: 1.0  
**Approach**: Unified-Service + Ontology + ABAC/ReBAC  
**Total Lines**: 1,100+ (migration + service + routes + docs)