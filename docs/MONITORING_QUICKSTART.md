# 🔍 Security Monitoring - Quick Start Guide

## TL;DR - Get Monitoring Running in 5 Minutes

### **Step 1: Run Migration** (1 minute)

```bash
cd backend
sqlx migrate run
```

### **Step 2: Configure Webhooks** (2 minutes)

```bash
# Create .env file
cat > ../.env << 'EOF'
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/WEBHOOK/URL
RUST_LOG=info,monitoring=debug
EOF
```

### **Step 3: Restart Backend** (2 minutes)

```bash
cd ..
docker-compose restart backend
```

### **Step 4: Test It** (1 minute)

```bash
# View dashboard
curl http://localhost:5300/api/monitoring/dashboard | jq

# Trigger test alert (11 failed logins)
for i in {1..11}; do
  curl -X POST http://localhost:5300/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -s > /dev/null
done

# Check Slack/Discord for alert 🔔
```

---

## 🎯 What You Get

```
✅ Failed login tracking (all attempts logged)
✅ Security event logging (admin access, escalation, etc.)
✅ Real-time alerts (Slack, Discord, PagerDuty)
✅ Attack detection (brute force, ransomware, privilege escalation)
✅ Dashboard API (metrics, events, failed auth by IP)
✅ Auto-cleanup (90-day retention for normal events)
```

---

## 📊 Dashboard Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/monitoring/dashboard` | Real-time stats |
| `/api/monitoring/events/recent` | Recent security events |
| `/api/monitoring/events/summary` | Events by type/severity |
| `/api/monitoring/auth/failed` | Failed login attempts |
| `/api/monitoring/auth/by-ip` | Failed auth grouped by IP |
| `/api/monitoring/alerts/rules` | Alert rule configuration |

---

## 🔔 Pre-Configured Alerts

| Alert | Trigger | Action |
|-------|---------|--------|
| **Brute Force (Single IP)** | 10 failed logins in 5 min | → Slack |
| **Mass Attack** | 50 failed logins in 1 hour | → Slack |
| **Admin Access Attempt** | Non-admin tries admin endpoint | → Slack |
| **Ransomware Detected** | Encryption/mass delete query | → PagerDuty |
| **Privilege Escalation** | Unauthorized role change | → Slack |
| **Rate Limit Abuse** | 20+ rate limits in 10 min | → Slack |

---

## 🧪 Test Scenarios

### **Test 1: Brute Force Detection**

```bash
# Make 11 failed login attempts (threshold: 10)
for i in {1..11}; do
  curl -X POST http://localhost:5300/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"attacker@evil.com","password":"wrong"}'
  sleep 1
done

# Check alert was sent
curl http://localhost:5300/api/monitoring/auth/by-ip | jq
```

**Expected**: Slack/Discord alert with "Brute Force" message

### **Test 2: View Dashboard**

```bash
curl http://localhost:5300/api/monitoring/dashboard | jq
```

**Expected Output:**
```json
{
  "failed_auth_last_hour": 11,
  "security_events_last_hour": 5,
  "critical_events_24h": 0,
  "unique_attacking_ips": 1,
  "alerts_triggered_24h": 1
}
```

### **Test 3: Check Recent Events**

```bash
curl http://localhost:5300/api/monitoring/events/recent?limit=5 | jq
```

**Expected**: List of recent security events with details

---

## 🔧 Configuration

### **Slack Setup** (2 minutes)

1. Go to https://api.slack.com/messaging/webhooks
2. Create incoming webhook
3. Copy webhook URL
4. Add to `.env`: `SLACK_WEBHOOK_URL=https://hooks.slack.com/...`

### **Discord Setup** (2 minutes)

1. Open Discord server settings
2. Integrations → Webhooks → New Webhook
3. Copy webhook URL
4. Add to `.env`: `DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...`

### **PagerDuty Setup** (5 minutes)

1. Log into PagerDuty
2. Services → Add Integration → Events API V2
3. Copy Integration Key
4. Add to `.env`: `PAGERDUTY_INTEGRATION_KEY=your_key`

---

## 📈 Monitoring Queries

### **Check Failed Logins (Last Hour)**
```sql
SELECT ip_address, COUNT(*) as attempts
FROM failed_auth_attempts
WHERE attempted_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
ORDER BY attempts DESC;
```

### **Check Critical Events (Last 24h)**
```sql
SELECT event_type, COUNT(*) as count
FROM security_events
WHERE severity = 'critical'
AND detected_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type;
```

### **Check Alert Status**
```sql
SELECT * FROM check_alert_rules();
```

---

## 🚨 What Gets Alerted

### **Immediate Alerts (Critical):**
- ⚠️ Ransomware pattern detected
- ⚠️ Mass database deletion
- ⚠️ DROP TABLE/DATABASE commands
- ⚠️ Privilege escalation attempts

### **Threshold Alerts (Warning):**
- 10+ failed logins from single IP (5 min window)
- 50+ failed logins system-wide (1 hour window)
- 20+ rate limit triggers (10 min window)
- Non-admin accessing admin endpoints

---

## 📊 Dashboard Preview

```bash
$ curl http://localhost:5300/api/monitoring/dashboard | jq

{
  "failed_auth_last_hour": 3,
  "security_events_last_hour": 15,
  "critical_events_24h": 0,
  "unique_attacking_ips": 1,
  "alerts_triggered_24h": 2
}

$ curl http://localhost:5300/api/monitoring/auth/by-ip | jq

[
  {
    "ip_address": "192.168.1.100",
    "attempt_count": 11,
    "unique_identifiers": 3,
    "endpoints_attempted": ["login", "refresh_token"],
    "first_attempt": "2026-01-18T16:25:00Z",
    "last_attempt": "2026-01-18T16:30:00Z",
    "duration_minutes": 5.0
  }
]
```

---

## 🔍 Troubleshooting

### **Issue: Alerts not sending**

```bash
# Check environment variables
docker exec ontology-manager-backend-1 env | grep WEBHOOK

# Test webhook manually
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test from monitoring system"}'
```

### **Issue: No events showing**

```bash
# Check if migration ran
docker exec ontology-manager-db-1 psql -U app -d app_db \
  -c "SELECT tablename FROM pg_tables WHERE tablename = 'failed_auth_attempts';"

# Check if logging is working
docker exec ontology-manager-db-1 psql -U app -d app_db \
  -c "SELECT COUNT(*) FROM failed_auth_attempts;"
```

### **Issue: Too many alerts**

```bash
# Adjust alert thresholds
docker exec ontology-manager-db-1 psql -U app -d app_db -c "
UPDATE alert_rules 
SET threshold_count = 20 
WHERE rule_name = 'brute_force_single_ip';
"
```

---

## 🎯 Next Steps

1. **Set up webhooks** - Configure Slack/Discord
2. **Test alerts** - Trigger test scenarios
3. **Review dashboard** - Check metrics
4. **Tune rules** - Adjust thresholds if needed
5. **Train team** - Document alert response procedures

---

## 📚 Full Documentation

- [PHASE_3_MONITORING_COMPLETE.md](./PHASE_3_MONITORING_COMPLETE.md) - Complete guide
- [SECURITY_TASKS.md](./SECURITY_TASKS.md) - Task list
- [docker-compose.yml.monitoring-example](../docker-compose.yml.monitoring-example) - Config example

---

**🎉 Your system is now monitored and protected!**

**Deployment Time**: 5 minutes  
**Maintenance**: < 30 minutes/week  
**Protection**: 24/7 attack detection
