# Codebase Review: Incomplete Work & Loose Ends

**Review Date**: 2026-01-18  
**Scope**: Complete codebase scan for partial implementations, placeholders, TODOs, and untested features

---

## Executive Summary

This review identifies **5 major categories** of incomplete work:

1. **Projects Feature** (NEW) - Recently added, missing backend tests
2. **Password Reset & 2FA** (PLANNED) - Backend implemented, frontend missing
3. **Email Integration** - Stub implementation only
4. **MFA/2FA Feature** - Backend complete, not integrated into login flow
5. **Test Coverage Gaps** - Several features lack comprehensive tests

---

## 1. Projects Module (⚠️ HIGH PRIORITY)

### Status: Backend Complete, Frontend Partial, **NO BACKEND TESTS**

### What's Implemented

**Backend** (`backend/src/features/projects/`):
- ✅ Full CRUD for Projects and Tasks
- ✅ Project membership management
- ✅ Task dependencies (Gantt support)
- ✅ Sub-projects hierarchy
- ✅ Permission checks via ReBAC
- ✅ Routes registered in main.rs

**Database** (Migrations):
- ✅ `20270119000000_projects_ontology.sql` - Project/Task classes, relationship types, permissions
- ✅ `20270120000000_update_tasks_gantt.sql` - Start date & depends_on relationship
- ✅ `20270120000001_add_sub_projects.sql` - has_sub_project relationship
- ✅ `20270118120001_add_get_user_entity_permissions.sql` - Permission checking function

**Frontend** (`frontend/src/features/projects/`):
- ✅ ProjectList.tsx - Project cards with status
- ✅ ProjectDetail.tsx - Tabs for Overview, Timeline, Sub-projects
- ✅ GanttChart.tsx - Gantt visualization
- ✅ DigitalTwinViewer.tsx - 3D visualization
- ✅ E2E tests in `frontend/tests/projects.spec.ts` (3 tests)

### What's Missing

**Backend**:
- ❌ **NO INTEGRATION TESTS** - Critical gap! No `backend/tests/project_test.rs` or `backend/tests/projects_test.rs`
- ❌ No tests for project CRUD operations
- ❌ No tests for task management
- ❌ No tests for permission enforcement
- ❌ No tests for sub-project relationships
- ❌ No tests for task dependencies

**Frontend**:
- ⚠️ E2E tests exist but **require running servers** (tests fail with ERR_CONNECTION_REFUSED)
- ⚠️ No unit tests for project components
- ⚠️ No API mocking tests for project API calls

**Integration**:
- ⚠️ Feature not documented in README.md "Key Features" section
- ⚠️ Not mentioned in CHANGELOG.md

### Recommendation

**IMMEDIATE**: Create `backend/tests/projects_test.rs` with:
- Test project creation with ReBAC permissions
- Test task CRUD operations
- Test project member management
- Test task dependency graph
- Test sub-project hierarchy
- Target: 75%+ coverage

---

## 2. Password Reset Flow

### Status: Backend Complete, Frontend Missing

### What's Implemented

**Backend** (`backend/src/features/auth/service.rs`):
- ✅ `request_password_reset()` - Generates token, sends email
- ✅ `verify_reset_token()` - Validates token (expiry, single-use)
- ✅ `reset_password()` - Updates password with new hash

**Routes** (`backend/src/features/auth/routes.rs`):
- ✅ `POST /api/auth/forgot-password` - Request reset
- ✅ `POST /api/auth/reset-password` - Submit new password

**Database**:
- ✅ Migration `20260117160000_add_password_reset_tokens.sql`
- ✅ Table: `password_reset_tokens` (id, user_id, token_hash, expires_at, used_at)

**Email**:
- ⚠️ **STUB ONLY** - Writes to `data/emails.log` file (see Email Integration section)

### What's Missing

**Frontend**:
- ❌ No `/forgot-password` page
- ❌ No `/reset-password/:token` page
- ❌ No link from login page to "Forgot password?"

**Tests**:
- ❌ No backend tests for password reset flow
- ❌ No E2E tests for password reset

### Recommendation

**Phase 1** (Frontend):
1. Create `frontend/src/routes/forgot-password.tsx`
2. Create `frontend/src/routes/reset-password/$token.tsx`
3. Add link to login page
4. Add success/error feedback states

**Phase 2** (Tests):
1. Backend: `test_request_reset_valid_email`
2. Backend: `test_reset_password_valid_token`
3. Backend: `test_reset_password_expired_token`
4. E2E: Full password reset journey

---

## 3. MFA/2FA Feature

### Status: Backend Complete, Not Integrated into Login Flow

### What's Implemented

**Backend** (`backend/src/features/auth/mfa.rs`):
- ✅ `setup_mfa()` - Generate TOTP secret, QR code, backup codes
- ✅ `verify_totp_code()` - Validate TOTP code
- ✅ `enable_mfa()` - Enable after verification
- ✅ `disable_mfa()` - Disable with password
- ✅ `use_backup_code()` - Consume backup code
- ✅ All functions use `unified_users` table with MFA fields

**Database**:
- ✅ MFA fields in users table: `mfa_enabled`, `mfa_secret`, `mfa_verified`, `backup_codes`, `mfa_last_used_at`

**Tests**:
- ✅ `backend/tests/mfa_test.rs` exists with tests

### What's Missing

**Login Flow Integration**:
- ❌ Login does NOT check `mfa_enabled` flag
- ❌ No MFA challenge step during login
- ❌ No `mfa_session_token` for temporary login state
- ❌ Tokens issued immediately without MFA verification

**Frontend**:
- ❌ No MFA setup wizard in `/profile`
- ❌ No QR code display component
- ❌ No MFA challenge page during login
- ❌ No backup codes display/download

**Routes**:
- ⚠️ MFA routes may not be registered (need to verify in routes.rs)

### Recommendation

**Phase 1** (Login Integration):
1. Modify `login()` to detect MFA-enabled users
2. Return `{ mfa_required: true, mfa_session_token: "..." }` instead of tokens
3. Add `POST /api/auth/mfa/challenge` route for code submission

**Phase 2** (Frontend):
1. MFA challenge page (TOTP input)
2. MFA setup wizard in profile
3. Backup codes display

**Phase 3** (Tests):
1. `test_login_with_mfa_requires_challenge`
2. `test_mfa_challenge_valid_code`
3. E2E: Full MFA enrollment and login

---

## 4. Email Integration

### Status: Stub Implementation Only

### Current Implementation

**File**: `backend/src/utils/email.rs`

```rust
pub fn send_password_change_email(to: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Writes to data/emails.log file
}

pub fn send_password_reset_email(to: &str, token: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Writes to data/emails.log file with reset link
}
```

### What's Missing

- ❌ No actual SMTP integration
- ❌ No email templating system
- ❌ No email queue for async delivery
- ❌ No new device login notification emails (logged but not sent)

### Recommendation

**Option 1** (Quick - External Service):
- Integrate with SendGrid, Mailgun, or AWS SES
- Replace stub with HTTP API calls
- Add API key to environment variables

**Option 2** (Production - Queue):
- Add job queue (e.g., `tokio-cron` or external service)
- Store emails in database table
- Background worker sends emails
- Retry logic for failures

**Option 3** (Dev - Keep Stub):
- Document that stub is intentional for development
- Add configuration flag: `EMAIL_MODE=stub|smtp|api`

---

## 5. Test Coverage Gaps

### Backend Tests

**Excellent Coverage** (>75%):
- ✅ JWT module: 81.5% (24 tests passing)
- ✅ Auth service: Basic tests (5 tests)
- ✅ Auth API: 10 tests
- ✅ MFA: Tests exist

**Missing/Incomplete**:
- ❌ **Projects feature: 0 tests**
- ⚠️ Auth service: Only 5 tests, many functions untested
- ⚠️ ReBAC service: Limited test coverage
- ⚠️ ABAC service: Limited test coverage
- ⚠️ Navigation service: Basic tests only

### Frontend Tests

**Unit Tests** (✅ PASSING):
- ✅ 54 tests passing in 4 test files
- ✅ `auth/lib/context.test.tsx` - 13 tests
- ✅ `ontology/lib/api.test.ts` - 19 tests
- ✅ `rebac/lib/policyParser.test.ts` - 14 tests
- ✅ `users/lib/api.test.ts` - 8 tests

**E2E Tests** (⚠️ REQUIRE SERVERS):
- ⚠️ 5 passed, 5 failed (servers not running)
- ✅ `e2e-auth.spec.ts` - Register/login flow
- ✅ `change-password.spec.ts` - Password change
- ✅ `ontology-roles.spec.ts` - ABAC/ReBAC
- ✅ `ai-health.spec.ts` - AI provider status
- ✅ `navigation-eval.spec.ts` - Navigation API
- ⚠️ `projects.spec.ts` - 3 tests (ERR_CONNECTION_REFUSED)
- ⚠️ `navigation-simulator.spec.ts` - (ERR_CONNECTION_REFUSED)
- ⚠️ `ai-admin-ui.spec.ts` - (ERR_CONNECTION_REFUSED)

**Missing**:
- ❌ No unit tests for project components
- ❌ No tests for password reset flow
- ❌ No tests for MFA flow

---

## 6. Database Migration Issues

### Modern ReBAC Kernel

**File**: `backend/migrations/20270118120000_modern_rebac_kernel.sql`

**Status**: ✅ Complete - Unified ABAC/ReBAC functions

- Drops old ambiguous functions
- Creates unified `check_entity_permission()` function
- Creates unified `get_accessible_entities()` function
- Supports DENY rules, temporal checks, inheritance

### Compilation Issues

**Current Issue**: Backend does not compile without `DATABASE_URL` set.

```
error: set `DATABASE_URL` to use query macros online, or run `cargo sqlx prepare` to update the query cache
```

**Affected Files**:
- `backend/src/features/auth/mfa.rs` (8 `sqlx::query!` macros)
- `backend/src/features/auth/service.rs` (1 `sqlx::query!` macro)

**Recommendation**:
- Run `cargo sqlx prepare` to generate offline query cache
- Or ensure `DATABASE_URL` is set in `.env` file
- Or convert `sqlx::query!` to `sqlx::query_as` for offline compilation

---

## 7. Orphaned & Test Artifacts

### Untracked Files (from git status)

**Backend**:
- `backend/cookies.txt`
- `backend/cookies_final.txt`
- `backend/cookies_new.txt`
- `backend/cookies_test.txt`

**Frontend**:
- `frontend/test-results/` - Playwright artifacts (3 subdirectories)

**Root**:
- `cookies.txt`
- `login_response.json`
- `reg_response.json`
- `revoke_res.txt`
- `sessions_after.json`
- `audit_logs.json`
- `memory.jsonl`

### Recommendation

**Clean up test artifacts**:
```bash
# Add to .gitignore
echo "cookies*.txt" >> .gitignore
echo "*_response.json" >> .gitignore
echo "*.jsonl" >> .gitignore
echo "audit_logs.json" >> .gitignore
echo "sessions_after.json" >> .gitignore
echo "revoke_res.txt" >> .gitignore

# Remove files
git rm --cached cookies*.txt *.json *.jsonl
```

---

## 8. Documentation Gaps

### README.md

**Missing**:
- ❌ Projects feature not documented in "Key Features"
- ❌ No mention of MFA capability
- ❌ No mention of password reset flow

### CHANGELOG.md

**Last Entry**: 2026-01-17

**Missing**:
- ❌ Projects feature implementation
- ❌ Modern ReBAC kernel migration
- ❌ MFA feature addition
- ❌ Password reset implementation

---

## 9. Mock Data & Compatibility Hacks

### Mock ID Generation (auth/service.rs:726-770)

```rust
// Mock ID for backward compatibility in NotificationEvent
let mock_id = (u64::from_str_radix(&entity_id.to_string().replace("-", "")[..16], 16)
    .unwrap_or(0) % (i64::MAX as u64)) as i64;
```

**Issue**: Converting UUID to i64 for legacy compatibility
**Location**: `backend/src/features/auth/service.rs:726-770`
**Impact**: Fragile, potential collisions
**Recommendation**: Migrate to UUID-based notifications entirely

### Temporary MFA Session Token (auth/service.rs:229)

```rust
// Generate a temporary MFA token (e.g. valid for 5 mins) to identify the user session during challenge
```

**Issue**: Comment indicates planned feature, not implemented
**Location**: `backend/src/features/auth/service.rs:229`
**Recommendation**: Implement MFA session token or remove comment

---

## 10. Frontend Test Mocks

### Mock API Patterns

Multiple frontend tests use mock fetch responses:
- `frontend/src/features/ontology/lib/api.test.ts` - 19 tests with mocked fetch
- `frontend/src/features/users/lib/api.test.ts` - 8 tests with fallback to mock data
- `frontend/src/features/auth/lib/context.test.tsx` - Mocked router, auth API, idle timer

**Status**: ✅ Good practice - Tests are properly isolated

---

## Summary Table

| Category | Status | Backend | Frontend | Tests | Priority |
|----------|--------|---------|----------|-------|----------|
| **Projects Module** | ⚠️ Partial | ✅ Complete | ✅ Complete | ❌ NO BACKEND TESTS | 🔴 HIGH |
| **Password Reset** | ⚠️ Partial | ✅ Complete | ❌ Missing | ❌ No Tests | 🟡 MEDIUM |
| **MFA/2FA** | ⚠️ Partial | ✅ Complete | ❌ Not Integrated | ⚠️ Some Tests | 🟡 MEDIUM |
| **Email Integration** | 🟠 Stub | 🟠 Stub Only | N/A | N/A | 🟢 LOW |
| **Test Coverage** | ⚠️ Gaps | ⚠️ 0-80% varies | ✅ 54 passing | ⚠️ E2E needs servers | 🔴 HIGH |
| **Build Issues** | 🔴 Broken | 🔴 Won't compile | ✅ OK | N/A | 🔴 HIGH |
| **Documentation** | ⚠️ Incomplete | N/A | N/A | N/A | 🟢 LOW |

---

## Priority Action Items

### Immediate (This Week)

1. **Fix Build Issues** 🔴
   - Set `DATABASE_URL` or run `cargo sqlx prepare`
   - Verify backend compiles

2. **Create Projects Backend Tests** 🔴
   - File: `backend/tests/projects_test.rs`
   - Target: 75%+ coverage
   - Include permission checks

3. **Clean Up Test Artifacts** 🟢
   - Add to `.gitignore`
   - Remove from git tracking

### Short Term (Next Sprint)

4. **Integrate MFA into Login Flow** 🟡
   - Modify login to check `mfa_enabled`
   - Create MFA challenge endpoint
   - Add MFA session tokens

5. **Complete Password Reset Frontend** 🟡
   - Create forgot-password page
   - Create reset-password page
   - Add E2E tests

6. **Improve Auth Test Coverage** 🟡
   - Auth service: Target 80%+
   - ReBAC: Target 75%+
   - ABAC: Target 75%+

### Long Term (Future Sprints)

7. **Email Integration** 🟢
   - Choose integration strategy
   - Implement real email sending
   - Add email templates

8. **Documentation Update** 🟢
   - Update README with new features
   - Update CHANGELOG
   - Document stub vs production features

---

## Conclusion

The codebase has **strong technical foundations** with excellent architecture and security practices. The main gaps are:

1. **Projects feature needs backend tests** (critical blocker for production)
2. **MFA is 90% complete** but not integrated into login
3. **Password reset is backend-complete** but needs frontend
4. **Build broken** without DATABASE_URL (easy fix)

**Overall Assessment**: 🟡 **Good Progress, Needs Testing & Integration Work**

**Estimated Effort to Complete**:
- Projects tests: 1-2 days
- MFA integration: 2-3 days
- Password reset UI: 1-2 days
- **Total**: ~1 week of focused work

---

**Next Steps**: See `docs/TASKS.md` for detailed implementation plans.
