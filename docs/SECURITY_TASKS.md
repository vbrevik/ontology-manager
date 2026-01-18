# Security Implementation Tasks

**Created**: 2026-01-18  
**Based On**: Security Audit + Ransomware Threat Analysis  
**Status**: Ready for Sprint Planning

---

## 🔴 PHASE 1: CRITICAL SECURITY FIXES (P0 - Deploy TODAY)

**Priority**: 🔴 CRITICAL  
**Estimated Time**: 4 hours  
**Risk Reduction**: 70% (HIGH → LOW)  
**Owner**: Security Team + On-call Engineer  
**Deadline**: Within 24 hours

### CVE-001: Missing Admin Authorization (CVSS 9.1)

- [ ] **Task 1.1**: Add `PermissionDenied` error variant
  - File: `backend/src/features/auth/service.rs:32`
  - Code: Add `#[error("Permission denied")] PermissionDenied,`
  - Time: 5 minutes
  
- [ ] **Task 1.2**: Add PermissionDenied status code handler
  - File: `backend/src/features/auth/service.rs:76`
  - Code: `Self::PermissionDenied => StatusCode::FORBIDDEN,`
  - Time: 5 minutes
  
- [ ] **Task 1.3**: Add admin check to `list_all_sessions_handler`
  - File: `backend/src/features/auth/routes.rs:462`
  - Code:
    ```rust
    if !claims.roles.iter().any(|r| r.role_name == "SuperAdmin") {
        return Err(AuthError::PermissionDenied);
    }
    ```
  - Time: 10 minutes
  - Test: `cargo test test_cve001_non_admin_cannot_list_all_sessions`
  
- [ ] **Task 1.4**: Add admin check to `revoke_any_session_handler`
  - File: `backend/src/features/auth/routes.rs:481`
  - Same code as 1.3
  - Time: 10 minutes
  - Test: `cargo test test_cve001_non_admin_cannot_revoke_other_sessions`
  
- [ ] **Task 1.5**: Add admin check to `get_audit_logs_handler`
  - File: `backend/src/features/auth/routes.rs:492`
  - Same code as 1.3
  - Time: 10 minutes
  - Test: `cargo test test_cve001_non_admin_cannot_access_audit_logs`

**Acceptance Criteria**:
- ✅ All 3 admin endpoints protected
- ✅ Non-admin users get 403 Forbidden
- ✅ All CVE-001 tests pass
- ✅ Admin access logged in audit logs

---

### CVE-002: Insecure Cookie Configuration (CVSS 8.1)

- [ ] **Task 2.1**: Enable Secure flag on access_token cookie
  - File: `backend/src/features/auth/routes.rs:27`
  - Change: `.secure(false)` → `.secure(cfg!(not(debug_assertions)))`
  - Time: 2 minutes
  
- [ ] **Task 2.2**: Enable Secure flag on refresh_token cookie
  - File: `backend/src/features/auth/routes.rs:40`
  - Change: `.secure(false)` → `.secure(cfg!(not(debug_assertions)))`
  - Time: 2 minutes
  
- [ ] **Task 2.3**: Run E2E cookie security tests
  - Command: `cd frontend && npm run test:e2e:security -- --grep "CVE-002"`
  - Time: 5 minutes

**Acceptance Criteria**:
- ✅ Cookies have Secure flag in release builds
- ✅ Development (debug) builds still work over HTTP
- ✅ E2E tests verify cookie security

---

### CVE-005: Test Endpoints in Production (CVSS 7.3)

- [ ] **Task 5.1**: Remove `/test/grant-role` route
  - File: `backend/src/features/auth/routes.rs:80`
  - Action: Delete line `.route("/test/grant-role", post(grant_role_handler))`
  - Time: 1 minute
  
- [ ] **Task 5.2**: Remove `grant_role_handler` function
  - File: `backend/src/features/auth/routes.rs:386-400`
  - Action: Delete entire function
  - Time: 1 minute
  
- [ ] **Task 5.3**: Remove `cleanup_handler` function
  - File: `backend/src/features/auth/routes.rs:368-383`
  - Action: Delete entire function
  - Time: 1 minute
  
- [ ] **Task 5.4**: Verify endpoints return 404
  - Test: `npm run test:e2e:security -- --grep "CVE-005"`
  - Time: 2 minutes

**Acceptance Criteria**:
- ✅ Test endpoints completely removed
- ✅ Endpoints return 404 Not Found
- ✅ E2E tests confirm removal

---

### Phase 1 Deployment

- [ ] **Task D.1**: Create feature branch `security/phase-1-critical`
- [ ] **Task D.2**: Apply all Phase 1 fixes
- [ ] **Task D.3**: Run security test suite: `cargo test --test security_audit_test`
- [ ] **Task D.4**: Run E2E security tests: `npm run test:e2e:security`
- [ ] **Task D.5**: Code review (2 approvals minimum)
- [ ] **Task D.6**: Deploy to staging
- [ ] **Task D.7**: Smoke test staging (manual verification)
- [ ] **Task D.8**: Deploy to production
- [ ] **Task D.9**: Monitor for 24 hours (error logs, metrics)
- [ ] **Task D.10**: Update security audit status

**Total Time**: ~1 hour implementation + 3 hours testing/deployment

---

## 🟠 PHASE 2: HIGH PRIORITY (P1 - Deploy This Week)

**Priority**: 🟠 HIGH  
**Estimated Time**: 1 week  
**Risk Reduction**: 25% (LOW → VERY LOW)  
**Owner**: Platform Team  
**Deadline**: Within 7 days

### CVE-004: Rate Limiting

- [ ] **Task 4.1**: Add tower-governor dependency
  - File: `backend/Cargo.toml`
  - Add: `tower-governor = "0.3"`
  - Time: 10 minutes
  
- [ ] **Task 4.2**: Create rate limiting middleware
  - File: `backend/src/middleware/rate_limit.rs` (new)
  - Implement rate limiters for:
    - Login: 5 attempts / 15 min per IP
    - MFA: 10 attempts / 5 min per token
    - Password reset: 3 requests / hour per IP
    - Registration: 3 accounts / hour per IP
  - Time: 4 hours
  
- [ ] **Task 4.3**: Apply rate limiting to auth routes
  - File: `backend/src/main.rs:183`
  - Add layer to auth routes
  - Time: 1 hour
  
- [ ] **Task 4.4**: Set up Redis for rate limit storage
  - File: `docker-compose.yml`
  - Add Redis service
  - Time: 2 hours
  
- [ ] **Task 4.5**: Add rate limit tests
  - Test: `cargo test test_cve004`
  - Time: 2 hours

**Acceptance Criteria**:
- ✅ Login limited to 5 attempts per 15 minutes
- ✅ MFA brute force prevented
- ✅ Tests verify rate limiting
- ✅ 429 status code returned when limited

---

### CVE-003: User Enumeration

- [ ] **Task 3.1**: Add timing delay for non-existent users
  - File: `backend/src/features/auth/service.rs:434`
  - Code: `tokio::time::sleep(Duration::from_millis(150)).await;`
  - Time: 15 minutes
  
- [ ] **Task 3.2**: Make registration error generic
  - File: `backend/src/features/auth/service.rs:157`
  - Change: "User already exists" → "Invalid input"
  - Time: 10 minutes
  
- [ ] **Task 3.3**: Add random timing jitter
  - Add ±25ms random delay to all auth operations
  - Time: 1 hour

**Acceptance Criteria**:
- ✅ Timing difference < 50ms
- ✅ Error messages don't reveal user existence
- ✅ Timing tests pass

---

### Ransomware Protection: Immutable Backups

- [ ] **Task R.1**: Create S3 bucket with Object Lock
  - Provider: AWS S3 or Azure Blob
  - Config: COMPLIANCE mode, 30-day retention
  - Time: 1 hour
  - Script: `scripts/setup_s3_backup.sh`
  
- [ ] **Task R.2**: Implement automated backup script
  - File: `scripts/backup_to_s3.sh` (new)
  - Schedule: Hourly pg_basebackup + continuous WAL archiving
  - Time: 3 hours
  
- [ ] **Task R.3**: Create backup verification script
  - File: `scripts/verify_backup.sh` (new)
  - Actions:
    - Verify checksums
    - Test restore to temporary database
    - Alert on failures
  - Time: 2 hours
  
- [ ] **Task R.4**: Set up backup monitoring
  - Tool: Prometheus + Grafana or cloud monitoring
  - Alerts: Backup failures, verification failures
  - Time: 2 hours
  
- [ ] **Task R.5**: Document recovery procedures
  - File: `docs/DISASTER_RECOVERY.md` (new)
  - Include: Step-by-step restore process
  - Time: 1 hour

**Acceptance Criteria**:
- ✅ Backups in immutable storage (cannot be deleted for 30 days)
- ✅ Backups verified daily
- ✅ Recovery tested successfully
- ✅ Geographic separation (different region/cloud)

---

### Network Segmentation

- [ ] **Task N.1**: Create isolated networks
  - File: `docker-compose.yml`
  - Networks: `frontend_net`, `backend_net`, `data_net`
  - Config: `data_net` set to `internal: true`
  - Time: 2 hours
  
- [ ] **Task N.2**: Update service network assignments
  - Frontend → frontend_net only
  - Backend → frontend_net + backend_net
  - Database → backend_net + data_net (internal)
  - Time: 1 hour
  
- [ ] **Task N.3**: Remove host volume mounts
  - Remove: `./backend/data:/app/data` (if not needed)
  - Use: Named volumes instead
  - Time: 30 minutes
  
- [ ] **Task N.4**: Add firewall rules documentation
  - File: `docs/NETWORK_ARCHITECTURE.md` (new)
  - Diagram: Show network zones
  - Time: 1 hour

**Acceptance Criteria**:
- ✅ Database not accessible from internet
- ✅ Backend can only reach database
- ✅ Each tier isolated
- ✅ Documentation complete

---

### Secrets Management

- [ ] **Task S.1**: Remove hardcoded passwords
  - File: `docker-compose.yml:29`
  - Remove: `POSTGRES_PASSWORD=app_password`
  - Time: 10 minutes
  
- [ ] **Task S.2**: Implement Docker secrets
  - File: `docker-compose.yml`
  - Add secrets section
  - Create: `secrets/db_password.txt` (git-ignored)
  - Time: 1 hour
  
- [ ] **Task S.3**: Generate strong database password
  - Command: `openssl rand -base64 32`
  - Update: All references to use secrets file
  - Time: 30 minutes
  
- [ ] **Task S.4**: Rotate database password
  - Connect to DB, run: `ALTER USER app PASSWORD 'new_password';`
  - Update secrets file
  - Restart services
  - Time: 30 minutes
  
- [ ] **Task S.5**: Move JWT keys to Vault (optional advanced)
  - Tool: HashiCorp Vault or AWS Secrets Manager
  - Time: 4 hours (if implemented)

**Acceptance Criteria**:
- ✅ No secrets in git history
- ✅ Secrets loaded from files
- ✅ Database password rotated
- ✅ Services work with new secrets

---

## 🔍 PHASE 3: ATTACK DETECTION (P1 - Deploy Within 2 Weeks)

**Priority**: 🟠 HIGH  
**Estimated Time**: 1 week  
**Purpose**: Detect and expose attack attempts in real-time

### Database Activity Monitoring

- [ ] **Task DAM.1**: Install pgaudit extension
  - File: `backend/migrations/YYYYMMDD_add_pgaudit.sql` (new)
  - SQL: `CREATE EXTENSION IF NOT EXISTS pgaudit;`
  - Time: 30 minutes
  
- [ ] **Task DAM.2**: Configure pgaudit logging
  - Config: Log all DDL, suspicious queries
  - File: Database postgresql.conf
  - Time: 1 hour
  
- [ ] **Task DAM.3**: Create ransomware detection triggers
  - File: `backend/migrations/YYYYMMDD_ransomware_detection.sql` (new)
  - Detect: `pgp_sym_encrypt` calls, mass UPDATE/DELETE
  - Action: Block query + alert
  - Time: 3 hours
  
- [ ] **Task DAM.4**: Set up database alert webhook
  - Send alerts to Slack/Discord/PagerDuty
  - Time: 2 hours

**Acceptance Criteria**:
- ✅ All DDL operations logged
- ✅ Ransomware encryption blocked
- ✅ Alerts sent within 1 minute
- ✅ False positive rate < 1%

---

### File Integrity Monitoring

- [ ] **Task FIM.1**: Install AIDE
  - Command: `apt-get install aide`
  - Initialize: `aide --init`
  - Time: 30 minutes
  
- [ ] **Task FIM.2**: Configure monitored paths
  - Paths: `/app/config`, `/etc/postgresql`, `/usr/local/bin`
  - File: `/etc/aide/aide.conf`
  - Time: 1 hour
  
- [ ] **Task FIM.3**: Schedule daily integrity checks
  - Cron: `0 2 * * * /usr/bin/aide --check`
  - Email results to security team
  - Time: 30 minutes
  
- [ ] **Task FIM.4**: Create alert integration
  - Send alerts on unauthorized changes
  - Time: 1 hour

**Acceptance Criteria**:
- ✅ File changes detected within 24 hours
- ✅ Alerts sent to security team
- ✅ Baseline updated weekly

---

### Failed Authentication Tracking

- [ ] **Task AUTH.1**: Create failed auth log table
  - File: `backend/migrations/YYYYMMDD_failed_auth_log.sql` (new)
  - Columns: user_id, ip, endpoint, timestamp, reason
  - Time: 1 hour
  
- [ ] **Task AUTH.2**: Log all failed auth attempts
  - Locations: login, MFA, token refresh
  - Store: IP, user-agent, failure reason
  - Time: 2 hours
  
- [ ] **Task AUTH.3**: Create failed auth alert rules
  - Alert: 10+ failures from single IP in 5 minutes
  - Alert: 50+ failures across system in 1 hour
  - Time: 2 hours
  
- [ ] **Task AUTH.4**: Build failed auth dashboard
  - Tool: Grafana
  - Show: Failed attempts per hour, top IPs, top users
  - Time: 3 hours

**Acceptance Criteria**:
- ✅ All failed auth attempts logged
- ✅ Suspicious patterns detected
- ✅ Team alerted to attack attempts
- ✅ Dashboard shows real-time data

---

### Real-Time Alerting System

- [ ] **Task ALERT.1**: Create Slack/Discord webhook
  - File: `backend/src/utils/alerts.rs` (new)
  - Function: `send_security_alert(message: &str)`
  - Time: 1 hour
  
- [ ] **Task ALERT.2**: Integrate alerts into detection systems
  - Trigger alerts for:
    - CVE-001 attempts (non-admin accessing admin endpoints)
    - Rate limit exceeded
    - Ransomware detected
    - File integrity violation
    - 10+ failed logins
  - Time: 2 hours
  
- [ ] **Task ALERT.3**: Create security metrics dashboard
  - Tool: Grafana
  - Metrics:
    - Failed logins per hour
    - Rate limit triggers
    - Admin endpoint access
    - Database queries per second
    - Response times
  - Time: 4 hours
  
- [ ] **Task ALERT.4**: Set up audit log export to external SIEM
  - Target: External logging service (can't be tampered)
  - Benefit: Attacker cannot delete audit trail
  - Time: 3 hours

**Acceptance Criteria**:
- ✅ Security team receives alerts within 1 minute
- ✅ Dashboard shows real-time metrics
- ✅ Audit logs preserved externally
- ✅ Alert fatigue managed (< 10 alerts/day in normal operation)

---

### Honeypot & Canary Tokens

- [ ] **Task HONEY.1**: Create honeypot admin endpoint
  - Endpoint: `/api/admin/legacy` (fake, logs all access)
  - Action: Log + alert on any access
  - Purpose: Detect reconnaissance
  - Time: 2 hours
  
- [ ] **Task HONEY.2**: Add canary tokens to database
  - Create: 5 fake user accounts
  - Action: Alert if accessed
  - Purpose: Detect unauthorized database access
  - Time: 2 hours
  
- [ ] **Task HONEY.3**: Implement request fingerprinting
  - Track: IP, User-Agent, Request patterns
  - Identify: Automated attack tools (SQLMap, etc.)
  - Time: 3 hours

**Acceptance Criteria**:
- ✅ Honeypot accessed → immediate alert
- ✅ Canary tokens trigger → attacker detected
- ✅ Bot traffic identified

---

## 🐢 PHASE 4: DOS/DDOS & PERFORMANCE (P1 - Deploy Within 2 Weeks)

**Priority**: 🟠 HIGH  
**Estimated Time**: 1 week  
**Purpose**: Prevent denial of service + fix slow system

### DDoS Protection (Application Layer)

- [ ] **Task DDOS.1**: Configure connection pool limits
  - File: `backend/src/main.rs`
  - Config: `max_connections=50`, `min_connections=2`
  - Time: 30 minutes
  
- [ ] **Task DDOS.2**: Add request timeout limits
  - Timeouts: 30s per request, 10s per query
  - File: `backend/src/main.rs`
  - Time: 1 hour
  
- [ ] **Task DDOS.3**: Implement request size limits
  - Limits: 10MB per request, 1MB JSON body
  - Middleware: tower-http `RequestBodyLimit`
  - Time: 1 hour
  
- [ ] **Task DDOS.4**: Add concurrent request limits per IP
  - Limit: 100 concurrent requests per IP
  - Time: 2 hours
  
- [ ] **Task DDOS.5**: Deploy WAF (Web Application Firewall)
  - Option 1: Cloudflare (recommended - easiest)
  - Option 2: ModSecurity (self-hosted)
  - Protection: SQL injection, XSS, DDoS
  - Time: 4 hours

**Acceptance Criteria**:
- ✅ System survives 1000 req/sec
- ✅ Slow requests timeout gracefully
- ✅ Large payloads rejected
- ✅ Single IP cannot exhaust resources

---

### DDoS Protection (Network Layer)

- [ ] **Task DDOS.6**: Enable SYN flood protection
  - Command: `sysctl -w net.ipv4.tcp_syncookies=1`
  - Make permanent: `/etc/sysctl.conf`
  - Time: 30 minutes
  
- [ ] **Task DDOS.7**: Configure iptables rate limiting
  - Limit: 100 new connections per second per IP
  - Time: 1 hour
  
- [ ] **Task DDOS.8**: Set up reverse proxy rate limiting
  - Tool: Nginx or Traefik
  - Config: limit_req_zone, limit_conn_zone
  - Time: 2 hours
  
- [ ] **Task DDOS.9**: Deploy DDoS mitigation service
  - Provider: Cloudflare, AWS Shield, or Akamai
  - Protection: Layer 3/4 DDoS attacks
  - Time: 4 hours

**Acceptance Criteria**:
- ✅ System survives SYN flood
- ✅ Network layer DDoS filtered
- ✅ Legitimate traffic unaffected

---

### Performance Optimization

- [ ] **Task PERF.1**: Enable pg_stat_statements
  - Extension: Track slow queries
  - Alert: Queries > 1 second
  - Time: 1 hour
  
- [ ] **Task PERF.2**: Create database indexes
  - Indexes on: user_id, entity_id, created_at, class_id
  - Expected: 10-100x speedup
  - Time: 3 hours
  
- [ ] **Task PERF.3**: Implement Redis caching
  - Cache: User permissions, ontology classes
  - TTL: 5 minutes
  - Time: 6 hours
  
- [ ] **Task PERF.4**: Add read replica
  - Use: Reporting, dashboards, analytics
  - Reduce: Primary database load
  - Time: 4 hours
  
- [ ] **Task PERF.5**: Fix N+1 query problems
  - Tool: SQL EXPLAIN ANALYZE
  - Fix: Use JOINs instead of loops
  - Time: 4 hours
  
- [ ] **Task PERF.6**: Implement connection pooling tiers
  - Pools: read_only (30), write (10), admin (2)
  - Prevent: Admin queries blocking user queries
  - Time: 3 hours
  
- [ ] **Task PERF.7**: Add response compression
  - Middleware: tower-http CompressionLayer
  - Savings: 70-90% bandwidth
  - Time: 1 hour

**Acceptance Criteria**:
- ✅ 95th percentile response time < 200ms
- ✅ Database queries < 100ms average
- ✅ Cache hit rate > 80%
- ✅ System handles 500+ concurrent users

---

### Slow Query Detection

- [ ] **Task SLOW.1**: Enable slow query logging
  - Config: `log_min_duration_statement = 1000ms`
  - File: postgresql.conf
  - Time: 15 minutes
  
- [ ] **Task SLOW.2**: Create slow query dashboard
  - Show: Top 10 slowest, query count, avg time
  - Tool: Grafana
  - Time: 2 hours
  
- [ ] **Task SLOW.3**: Alert on repeated slow queries
  - Alert: Same query slow 5+ times → needs optimization
  - Time: 1 hour

**Acceptance Criteria**:
- ✅ Slow queries identified within 5 minutes
- ✅ Team alerted to performance regressions
- ✅ Historical trends visible

---

## 📊 PHASE 5: MONITORING & METRICS (P2 - Deploy Within 1 Month)

**Priority**: 🟡 MEDIUM  
**Estimated Time**: 4 days

### Security Metrics Dashboard

- [ ] **Task METRICS.1**: Track failed auth attempts per hour
- [ ] **Task METRICS.2**: Monitor rate limit triggers per endpoint
- [ ] **Task METRICS.3**: Track admin endpoint access (successful + denied)
- [ ] **Task METRICS.4**: Monitor database connection count
- [ ] **Task METRICS.5**: Track backup success/failure rate
- [ ] **Task METRICS.6**: Monitor file integrity check results
- [ ] **Task METRICS.7**: Track security test pass rate (CI/CD)
- [ ] **Task METRICS.8**: Create executive security dashboard
  - Metrics: Overall security score, open vulnerabilities, incident count
  - Audience: Management, executives
  - Time: 4 hours

**Acceptance Criteria**:
- ✅ All metrics tracked in real-time
- ✅ Dashboard accessible to security team
- ✅ Historical trends visible (90 days)

---

## 🧪 CONTINUOUS SECURITY

### CI/CD Integration

- [ ] **Task CI.1**: Add security tests to GitHub Actions
  - File: `.github/workflows/security.yml` (new)
  - Run: Backend security tests
  - Run: E2E security tests
  - Time: 2 hours
  
- [ ] **Task CI.2**: Fail pipeline on critical vulnerabilities
  - Check: Security test results
  - Action: Block merge if critical issues found
  - Time: 1 hour
  
- [ ] **Task CI.3**: Run dependency vulnerability scan
  - Tool: `cargo audit` for Rust
  - Tool: `npm audit` for Node
  - Schedule: Daily
  - Time: 1 hour

**Acceptance Criteria**:
- ✅ Security tests run on every PR
- ✅ Pipeline fails on vulnerabilities
- ✅ Dependencies scanned daily

---

## 📋 TASK SUMMARY

| Phase | Priority | Tasks | Time | Risk Reduction |
|-------|----------|-------|------|----------------|
| Phase 1: Critical | 🔴 P0 | 15 | 4 hours | 70% |
| Phase 2: High Priority | 🟠 P1 | 45 | 1 week | 25% |
| Phase 3: Detection | 🟠 P1 | 20 | 1 week | - |
| Phase 4: DoS/Performance | 🟠 P1 | 20 | 1 week | - |
| Phase 5: Monitoring | 🟡 P2 | 10 | 4 days | 4% |
| **TOTAL** | | **110** | **~1 month** | **99%** |

---

## 🎯 SUCCESS CRITERIA

**Phase 1 Complete When**:
- ✅ All critical CVEs fixed (CVE-001, CVE-002, CVE-005)
- ✅ 100% security test pass rate
- ✅ Deployed to production
- ✅ 70% risk reduction achieved

**All Phases Complete When**:
- ✅ 99% risk reduction achieved
- ✅ Ransomware attack probability < 1%
- ✅ System survives DDoS attacks
- ✅ Performance targets met (< 200ms p95)
- ✅ Real-time monitoring active
- ✅ Audit logs immutable + externalized
- ✅ Penetration test shows no critical findings

---

**Next Action**: Begin Phase 1 implementation (4 hours to 70% risk reduction)
