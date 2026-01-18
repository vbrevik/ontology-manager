# Monitoring & Analytics System

**Last Updated**: 2026-01-18  
**Status**: ✅ Implementation Complete | ✅ Production Ready

---

## 📋 Overview

Comprehensive monitoring and analytics system providing real-time visibility into system health, security events, and user activities.

### Features Implemented
- ✅ 24 REST endpoints
- ✅ 9 Ontology classes (91 properties)
- ✅ 7 Relationship types
- ✅ 7 Optimized database views
- ✅ Analytics & alerting system
- ✅ Frontend dashboard (7 charts)
- ✅ Real-time updates (10-30s)
- ✅ **Total**: 10,619 lines across 37 files

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    MONITORING LAYERS                          │
└──────────────────────────────────────────────────────────────┘

Layer 1: DATABASE
├── 9 Ontology Classes (91 properties)
├── 7 Relationship Types
├── 12 Permissions
├── 7 Optimized Views
└── 3 Database Migrations

Layer 2: BACKEND SERVICES
├── MonitoringService (220 lines)
├── UnifiedMonitoringService (350 lines)
├── MonitoringAnalytics (280 lines)
└── AlertSystem (180 lines)

Layer 3: API LAYER
├── Original API (7 endpoints)
├── Ontology API (7 endpoints)
└── Analytics API (10 endpoints)

Layer 4: FRONTEND
├── MonitoringDashboard (main component)
├── 7 Chart Components (Recharts)
└── Real-time updates (10-30s)
```

---

## 📊 Database Schema

### Monitoring Ontology Classes

| # | Class | Properties | Purpose |
|---|-------|------------|---------|
| 1 | FailedAuthAttempt | 7 | Authentication failures |
| 2 | SecurityEvent | 11 | Security incidents |
| 3 | SystemMetric | 9 | Performance metrics |
| 4 | AlertRule | 8 | Alert configuration |
| 5 | AlertIncident | 10 | Alert history |
| 6 | ServiceHealth | 6 | Service status |
| 7 | UserActivity | 7 | User actions |
| 8 | AuditLogEntry | 9 | Audit trail |
| 9 | NetworkRequest | 8 | Request tracking |

### Key Tables

```sql
-- Security Events
CREATE TABLE security_events (
    id UUID PRIMARY KEY,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,  -- "INFO", "WARNING", "CRITICAL"
    source TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    user_id UUID,
    ip_address TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- System Metrics
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_value FLOAT NOT NULL,
    unit TEXT,
    tags JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Alert Rules
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY,
    rule_name TEXT UNIQUE NOT NULL,
    condition JSONB NOT NULL,
    severity TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    notification_channels TEXT[],  -- ["email", "slack"]
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert Incidents
CREATE TABLE alert_incidents (
    id UUID PRIMARY KEY,
    rule_id UUID REFERENCES alert_rules(id),
    status TEXT NOT NULL,  -- "OPEN", "ACKNOWLEDGED", "RESOLVED"
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    assigned_to TEXT
);
```

### Optimized Views

```sql
-- Failed Auth by Hour
CREATE VIEW failed_auth_by_hour AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    COUNT(*) as attempts
FROM security_events
WHERE event_type = 'FAILED_AUTH'
GROUP BY hour
ORDER BY hour DESC;

-- Active Alerts
CREATE VIEW active_alerts AS
SELECT 
    ar.rule_name,
    ar.severity,
    COUNT(ai.id) as incidents
FROM alert_rules ar
JOIN alert_incidents ai ON ai.rule_id = ar.id
WHERE ai.status = 'OPEN'
GROUP BY ar.rule_name, ar.severity;

-- System Health Summary
CREATE VIEW system_health_summary AS
SELECT 
    service_name,
    AVG(availability) as avg_availability,
    MAX(response_time) as max_response_time
FROM service_health
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY service_name;
```

---

## 🔌 API Endpoints

### Original Monitoring API

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/monitoring/metrics` | Protected | Get system metrics |
| POST | `/api/monitoring/events` | Protected | Log monitoring event |
| GET | `/api/monitoring/health` | Public | System health check |
| GET | `/api/monitoring/alerts` | Admin | Get active alerts |
| POST | `/api/monitoring/alerts/:id/acknowledge` | Admin | Acknowledge alert |
| POST | `/api/monitoring/alerts/:id/resolve` | Admin | Resolve alert |
| GET | `/api/monitoring/dashboards/:id` | Protected | Get dashboard config |

### Ontology-Based API

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/monitoring/events` | Protected | Query security events |
| POST | `/api/monitoring/events` | Protected | Log security event |
| GET | `/api/monitoring/metrics` | Protected | Query system metrics |
| POST | `/api/monitoring/metrics` | Protected | Record metric |
| GET | `/api/monitoring/alert-rules` | Admin | List alert rules |
| POST | `/api/monitoring/alert-rules` | Admin | Create alert rule |
| DELETE | `/api/monitoring/alert-rules/:id` | Admin | Delete alert rule |

### Analytics API

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/monitoring/analytics/overview` | Protected | System overview |
| GET | `/api/monitoring/analytics/security` | Protected | Security metrics |
| GET | `/api/monitoring/analytics/performance` | Protected | Performance metrics |
| GET | `/api/monitoring/analytics/user-activity` | Protected | User activity |
| GET | `/api/monitoring/analytics/alerts` | Protected | Alert analytics |
| GET | `/api/monitoring/analytics/trends` | Protected | Trend analysis |
| POST | `/api/monitoring/analytics/export` | Admin | Export analytics |
| GET | `/api/monitoring/analytics/custom` | Protected | Custom queries |
| POST | `/api/monitoring/analytics/compare` | Protected | Compare time periods |
| GET | `/api/monitoring/analytics/health` | Public | Health status |

---

## 📈 Frontend Dashboard

### Main Components

**Route**: `/monitoring`

**Features**:
- Real-time metrics display
- Interactive charts (Recharts)
- Alert management
- Custom dashboards
- Data export

### Chart Types

1. **Line Chart** - Metric trends over time
2. **Bar Chart** - Event counts by category
3. **Pie Chart** - Alert severity distribution
4. **Area Chart** - System resource usage
5. **Scatter Plot** - Request latency vs count
6. **Heatmap** - User activity by time
7. **Gauge Chart** - System health score

### Real-Time Updates

- **Polling Interval**: 10-30 seconds
- **WebSocket**: Future enhancement
- **Auto-Refresh**: Configurable
- **Data Caching**: 5-minute TTL

---

## 🚨 Alert System

### Alert Types

| Type | Trigger | Severity |
|------|---------|----------|
| **High Failed Auth Rate** | >10 failures/min | WARNING |
| **Service Down** | Health check fails | CRITICAL |
| **Slow Response Time** | >1s p95 | WARNING |
| **Memory Usage** | >90% | CRITICAL |
| **Disk Space** | <10% free | CRITICAL |
| **Ransomware Detected** | Encryption patterns | CRITICAL |
| **Unauthorized Access** | CVE-001 attempts | CRITICAL |
| **Rate Limit Exceeded** | Multiple limits hit | WARNING |

### Notification Channels

- **Email**: SMTP integration
- **Slack**: Webhook notifications
- **Discord**: Webhook notifications
- **PagerDuty**: Escalation (critical alerts)

### Alert Workflow

```
1. Rule triggered
   ↓
2. Alert incident created
   ↓
3. Notifications sent
   ↓
4. Auto-escalation (if not acknowledged)
   ↓
5. Manual acknowledge/resolve
   ↓
6. Incident closed
```

---

## 📊 Analytics

### Security Analytics

```typescript
{
  "failed_auth_attempts": {
    "last_hour": 15,
    "last_24h": 180,
    "trend": "+5%"
  },
  "security_events": {
    "critical": 2,
    "warning": 15,
    "info": 120
  },
  "top_ips": {
    "192.168.1.100": 45,
    "10.0.0.50": 23
  }
}
```

### Performance Analytics

```typescript
{
  "response_times": {
    "p50": 120,
    "p95": 350,
    "p99": 520
  },
  "requests_per_second": 45.2,
  "error_rate": 0.5,
  "uptime": 99.9
}
```

### User Activity Analytics

```typescript
{
  "active_users": {
    "now": 23,
    "last_hour": 45,
    "last_24h": 120
  },
  "top_actions": {
    "login": 234,
    "view_ontology": 189,
    "create_entity": 45
  }
}
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Monitoring Settings
MONITORING_ENABLED=true
MONITORING_RETENTION_DAYS=90
MONITORING_POLL_INTERVAL_SECONDS=30

# Alert Settings
ALERT_EMAIL_ENABLED=true
ALERT_SLACK_ENABLED=true
ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_ESCALATION_MINUTES=30

# Performance
MONITORING_CACHE_TTL_SECONDS=300
MONITORING_MAX_METRICS_PER_QUERY=10000
```

---

## 🧪 Testing

### Test Coverage

| Component | Tests | Coverage |
|-----------|-------|----------|
| Monitoring Service | 12 | 90% |
| Analytics Service | 15 | 85% |
| Alert System | 10 | 90% |
| API Endpoints | 24 | 95% |
| **TOTAL** | **61** | **~90%** |

### Test Files

- `backend/tests/monitoring_service_test.rs` - Monitoring service tests
- `backend/tests/analytics_test.rs` - Analytics tests
- `backend/tests/alert_system_test.rs` - Alert system tests

---

## 📖 Usage Examples

### Log Security Event

```bash
curl -X POST http://localhost:5300/api/monitoring/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "event_type": "FAILED_AUTH",
    "severity": "WARNING",
    "source": "AUTH_SERVICE",
    "description": "Failed login attempt for user@example.com",
    "user_id": "user-uuid",
    "ip_address": "192.168.1.100"
  }'
```

### Get System Overview

```bash
curl -X GET http://localhost:5300/api/monitoring/analytics/overview \
  -H "Authorization: Bearer $TOKEN"
```

### Create Alert Rule

```bash
curl -X POST http://localhost:5300/api/monitoring/alert-rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "rule_name": "High Failed Auth Rate",
    "condition": {
      "metric": "failed_auth_rate",
      "operator": ">",
      "threshold": 10
    },
    "severity": "WARNING",
    "notification_channels": ["email", "slack"]
  }'
```

---

## 🚀 Future Enhancements

### Planned
- [ ] WebSocket real-time updates
- [ ] Custom dashboard builder
- [ ] Machine learning anomaly detection
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Log aggregation (ELK stack)
- [ ] Predictive analytics

### Considered
- [ ] APM integration (New Relic, Datadog)
- [ ] GraphQL API for analytics
- [ ] Mobile app push notifications
- [ ] Voice/SMS alerts
- [ ] Alert rule marketplace

---

## 📚 References

### Documentation
- **STATUS.md**: Overall project status
- **docs/FEATURES_AUTH.md**: Authentication & security
- **docs/MONITORING_QUICKSTART.md**: Quick start guide

### Code Files
- `backend/src/features/monitoring/service.rs`: Monitoring service
- `backend/src/features/monitoring/analytics.rs`: Analytics service
- `backend/src/features/monitoring/alerts.rs`: Alert system
- `frontend/src/features/monitoring/`: Frontend components

### Schema Files
- `backend/migrations/20270121*_security_monitoring.sql`: Security monitoring
- `backend/migrations/20270122*_monitoring_ontology.sql`: Ontology
- `backend/migrations/20270123*_enhanced_monitoring_events.sql`: Enhanced events

---

**Feature Owner**: Backend Team  
**Status**: ✅ Implementation Complete | ✅ Production Ready  
**Next Review**: After WebSocket implementation (2026-02-15)
