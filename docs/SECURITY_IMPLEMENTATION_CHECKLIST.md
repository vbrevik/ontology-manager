# Security Implementation Checklist

**Date**: 2026-01-18  
**Purpose**: Step-by-step checklist for implementing security fixes  
**Use this**: Print and check off tasks as you complete them

---

## ✅ PHASE 1: CRITICAL FIXES (4 hours)

### Pre-Flight Check
- [ ] Read `SECURITY_QUICK_START.md` (10 minutes)
- [ ] Review `SECURITY_TASKS.md` Phase 1 section
- [ ] Create feature branch: `git checkout -b security/phase-1-critical`
- [ ] Backup production database (just in case)

### CVE-001: Admin Authorization (30 minutes)

**Step 1**: Add PermissionDenied error
```bash
# Edit: backend/src/features/auth/service.rs
# Line 32: Add to AuthError enum
#[error("Permission denied")]
PermissionDenied,

# Line 76: Add to to_status_code()
Self::PermissionDenied => StatusCode::FORBIDDEN,

# Line 1110: Add to IntoResponse match
AuthError::PermissionDenied => StatusCode::FORBIDDEN,
```

**Step 2**: Add admin checks to 3 handlers
```bash
# Edit: backend/src/features/auth/routes.rs

# Line 462: list_all_sessions_handler - add after line 465:
if !claims.roles.iter().any(|r| r.role_name == "SuperAdmin") {
    return Err(AuthError::PermissionDenied);
}

# Line 481: revoke_any_session_handler - add after line 487:
if !claims.roles.iter().any(|r| r.role_name == "SuperAdmin") {
    return Err(AuthError::PermissionDenied);
}

# Line 492: get_audit_logs_handler - add after line 495:
if !claims.roles.iter().any(|r| r.role_name == "SuperAdmin") {
    return Err(AuthError::PermissionDenied);
}
```

**Step 3**: Test
```bash
cd backend
cargo test test_cve001_non_admin_cannot_list_all_sessions
cargo test test_cve001_non_admin_cannot_revoke_other_sessions
cargo test test_cve001_non_admin_cannot_access_audit_logs
```

**Expected**: All 3 tests should fail initially (documenting vulnerability), then pass after fix

- [ ] CVE-001 implemented
- [ ] CVE-001 tests pass
- [ ] Code committed

---

### CVE-002: Secure Cookies (15 minutes)

**Step 1**: Enable secure flag
```bash
# Edit: backend/src/features/auth/routes.rs

# Line 27: Change from:
.secure(false)
# To:
.secure(cfg!(not(debug_assertions)))

# Line 40: Change from:
.secure(false)
# To:
.secure(cfg!(not(debug_assertions)))
```

**Step 2**: Test
```bash
# Build in release mode
cargo build --release

# Verify secure flag is set (manual check in browser dev tools)
```

- [ ] CVE-002 implemented
- [ ] Cookies have Secure flag in release mode
- [ ] Code committed

---

### CVE-005: Remove Test Endpoints (5 minutes)

**Step 1**: Remove routes
```bash
# Edit: backend/src/features/auth/routes.rs

# Line 80: DELETE entire line:
.route("/test/grant-role", post(grant_role_handler))
```

**Step 2**: Remove handlers
```bash
# Lines 366-400: DELETE grant_role_handler function
# Lines 368-383: DELETE cleanup_handler function
# Lines 356-365: DELETE GrantRoleRequest struct
# Lines 350-358: DELETE CleanupRequest struct
```

**Step 3**: Test
```bash
cargo build
cargo test --test security_audit_test test_cve005
```

- [ ] CVE-005 implemented
- [ ] Test endpoints return 404
- [ ] Code committed

---

### Phase 1 Verification

**Run all tests**:
```bash
# Backend tests
cd backend
cargo test --test security_audit_test

# Expected output:
# test result: ok. 19 passed; 0 failed
```

**E2E tests** (optional for Phase 1):
```bash
cd frontend
npm run test:e2e:security
```

**Manual verification**:
```bash
# 1. Start services
docker-compose up -d

# 2. Register as normal user
curl -X POST http://localhost:5300/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"test","password":"password123"}'

# 3. Try admin endpoint (should fail with 403)
curl http://localhost:5300/api/auth/sessions/all \
  -H "Cookie: access_token=<token from login>"

# Expected: 403 Forbidden ✅

# 4. Try test endpoint (should fail with 404)
curl -X POST http://localhost:5300/api/auth/test/grant-role

# Expected: 404 Not Found ✅
```

- [ ] All security tests pass
- [ ] Manual verification complete
- [ ] Code reviewed by 2 engineers
- [ ] Ready for deployment

---

### Phase 1 Deployment

```bash
# 1. Merge to main
git checkout main
git merge security/phase-1-critical

# 2. Tag release
git tag -a v1.0.1-security -m "Security fixes: CVE-001, CVE-002, CVE-005"
git push origin v1.0.1-security

# 3. Deploy to staging
./scripts/deploy_staging.sh

# 4. Smoke test staging
./scripts/smoke_test.sh

# 5. Deploy to production
./scripts/deploy_production.sh

# 6. Monitor for 24 hours
# - Check error logs: docker-compose logs -f backend
# - Check metrics dashboard
# - Verify no issues
```

- [ ] Deployed to staging
- [ ] Smoke tests pass
- [ ] Deployed to production
- [ ] Monitoring active (24 hours)
- [ ] No issues detected

---

## ✅ PHASE 2: INFRASTRUCTURE (1 week)

### Rate Limiting (Day 1-2)

```bash
# 1. Add dependency
cd backend
cargo add tower-governor

# 2. Create rate limit middleware
# File: src/middleware/rate_limit.rs (new)

# 3. Apply to auth routes
# File: src/main.rs:183

# 4. Add Redis service
# Edit: docker-compose.yml

# 5. Test
cargo test test_cve004
```

- [ ] Rate limiting implemented
- [ ] Tests pass
- [ ] Deployed

---

### Immutable Backups (Day 3-4)

```bash
# 1. Create S3 bucket
aws s3api create-bucket \
  --bucket company-backups-immutable \
  --object-lock-enabled-for-bucket

# 2. Enable Object Lock
aws s3api put-object-lock-configuration \
  --bucket company-backups-immutable \
  --object-lock-configuration '{"ObjectLockEnabled":"Enabled",...}'

# 3. Create backup script
# File: scripts/backup_to_s3.sh

# 4. Create verification script
# File: scripts/verify_backup.sh

# 5. Schedule cron job
crontab -e
# Add: 0 * * * * /path/to/backup_to_s3.sh
```

- [ ] S3 bucket created with Object Lock
- [ ] Backup script running hourly
- [ ] Verification script running daily
- [ ] Recovery tested successfully

---

### Network Segmentation (Day 5)

```bash
# 1. Edit docker-compose.yml
# Add networks: frontend_net, backend_net, data_net

# 2. Test locally
docker-compose down
docker-compose up -d

# 3. Verify isolation
docker network inspect ontology-manager_data_net
# Should show: "Internal": true

# 4. Verify connectivity
curl http://localhost:5300/health
# Should work ✅
```

- [ ] Networks created
- [ ] Services assigned to networks
- [ ] Database isolated (internal network)
- [ ] Application still works

---

### Secrets Management (Day 5)

```bash
# 1. Create secrets directory
mkdir -p secrets
echo "secrets/" >> .gitignore

# 2. Generate strong password
openssl rand -base64 32 > secrets/db_password.txt

# 3. Update docker-compose.yml
# Change: POSTGRES_PASSWORD → POSTGRES_PASSWORD_FILE

# 4. Rotate database password
docker-compose exec db psql -U postgres
ALTER USER app PASSWORD '<new_password>';

# 5. Restart services
docker-compose restart
```

- [ ] Secrets directory created
- [ ] Passwords moved to files
- [ ] Database password rotated
- [ ] Services restart successfully

---

## ✅ VERIFICATION CHECKLIST

### Security Tests
- [ ] Backend: `cargo test --test security_audit_test` (19/19 pass)
- [ ] E2E: `npm run test:e2e:security` (18/18 pass)
- [ ] Integration: All backend tests pass
- [ ] E2E: All Playwright tests pass

### Manual Testing
- [ ] Normal user cannot access admin endpoints (403)
- [ ] Cookies have Secure flag (in production)
- [ ] Test endpoints return 404
- [ ] Rate limiting works (try 10 failed logins)
- [ ] Backups are being created
- [ ] Backups can be restored

### Monitoring
- [ ] Error logs clean (no new errors)
- [ ] Performance normal (response times)
- [ ] No security alerts triggered
- [ ] Backup verification passing

---

## 📈 PROGRESS TRACKING

**How to update progress**:
1. Check off items in this file as you complete them
2. Update corresponding tasks in `SECURITY_TASKS.md`
3. Commit progress: `git add docs/SECURITY_IMPLEMENTATION_CHECKLIST.md && git commit -m "Security: Mark task X complete"`
4. Update team in daily standup

**Progress metrics**:
- Phase 1: ___/15 tasks complete (___%)
- Phase 2: ___/45 tasks complete (___%)
- Overall: ___/110 tasks complete (___%)

---

## 🎯 DAILY GOALS

### Day 1 (TODAY): Critical Fixes
**Goal**: Fix CVE-001, CVE-002, CVE-005  
**Time**: 4 hours  
**Risk Reduction**: 70%

### Day 2-3: Rate Limiting
**Goal**: Implement rate limiting  
**Time**: 8 hours  
**Protection**: Prevent brute force attacks

### Day 4-5: Backups & Segmentation
**Goal**: Immutable backups + network isolation  
**Time**: 16 hours  
**Protection**: Ransomware recovery + containment

### Week 2: Detection & Monitoring
**Goal**: Real-time attack detection  
**Time**: 40 hours  
**Protection**: Expose attack attempts

### Week 3: Performance & DoS Protection
**Goal**: Handle high load + prevent DoS  
**Time**: 40 hours  
**Protection**: Service availability

### Week 4: Monitoring & Metrics
**Goal**: Continuous security monitoring  
**Time**: 32 hours  
**Protection**: Long-term security posture

---

## 🏁 COMPLETION CRITERIA

**Phase 1 complete when**:
- ✅ All critical tasks checked off
- ✅ All tests passing
- ✅ Deployed to production
- ✅ 24-hour monitoring shows no issues

**All phases complete when**:
- ✅ All 110 tasks checked off
- ✅ 99% risk reduction achieved
- ✅ Penetration test passes
- ✅ Team trained and confident

---

**Print this checklist and use it to track your progress!** 📋✅
