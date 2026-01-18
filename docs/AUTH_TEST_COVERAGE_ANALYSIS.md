# Auth Service Test Coverage Analysis

**Date**: 2026-01-18  
**Target**: `backend/src/features/auth/service.rs`  
**Current Tests**: `backend/tests/auth_service_test.rs`

---

## Executive Summary

**Current Status**: ⚠️ **23/27 tests passing (85%)**  
**Coverage**: ~80% of methods tested  
**Issues**: 4 failing tests (session/token management)  
**Target**: 90%+ coverage with all tests passing

---

## Test Results Overview

### ✅ Passing Tests (23)

| Test | Method(s) Tested | Coverage |
|------|-----------------|----------|
| `test_register_ontology_entity_created` | register() | ✅ Ontology integration |
| `test_register_duplicate_email_fails` | register() | ✅ Error handling |
| `test_register_password_hashed_with_argon2` | register() | ✅ Security |
| `test_login_with_email` | login() | ✅ Email identifier |
| `test_login_with_username` | login() | ✅ Username identifier |
| `test_login_wrong_password` | login() | ✅ Error handling |
| `test_login_updates_metadata` | login() | ✅ Metadata tracking |
| `test_login_remember_me_true` | login() | ✅ Session duration |
| `test_login_new_device_notification` | login() + notifications | ✅ Security alerts |
| `test_login_mfa_flow` | login() + MFA | ✅ MFA integration |
| `test_change_password_success` | change_password() | ✅ Happy path |
| `test_change_password_wrong_current` | change_password() | ✅ Validation |
| `test_change_password_creates_notification` | change_password() | ✅ Notifications |
| `test_refresh_token_rotation` | refresh_token() | ✅ Token rotation |
| `test_list_active_sessions` | list_active_sessions() | ✅ User sessions |
| `test_list_all_sessions_admin` | list_all_sessions() | ✅ Admin view |
| `test_revoke_session_not_found` | revoke_session() | ✅ Error handling |
| `test_count_users` | count_users() | ✅ Admin stats |
| `test_recent_users` | recent_users() | ✅ Admin stats |
| `test_delete_users_by_prefix` | delete_users_by_prefix() | ✅ Test helper |
| `test_create_notification_broadcast` | create_notification() | ✅ Broadcasting |
| `test_mark_notification_read` | mark_notification_read() | ✅ Notifications |
| `test_mark_all_notifications_read` | mark_all_notifications_read() | ✅ Notifications |

### ❌ Failing Tests (4)

| Test | Issue | Root Cause |
|------|-------|------------|
| `test_count_active_refresh_tokens` | Expected 3, got 4 | Test isolation issue - tokens from other tests |
| `test_logout_blacklists_refresh_token` | Assertion failure | Token not properly soft-deleted |
| `test_refresh_token_with_roles_and_permissions` | Assertion failure | Roles/permissions query issue |
| `test_revoke_session` | Assertion failure | Session not properly revoked |

---

## Method Coverage Analysis

### AuthService Public Methods (22 total)

| # | Method | Tested? | Test Count | Coverage Level |
|---|--------|---------|------------|----------------|
| 1 | `register()` | ✅ | 3 tests | 🟢 Excellent |
| 2 | `login()` | ✅ | 6 tests | 🟢 Excellent |
| 3 | `change_password()` | ✅ | 3 tests | 🟢 Good |
| 4 | `request_password_reset()` | ✅ | 11 tests | 🟢 Excellent (separate file) |
| 5 | `verify_reset_token()` | ✅ | 11 tests | 🟢 Excellent (separate file) |
| 6 | `reset_password()` | ✅ | 11 tests | 🟢 Excellent (separate file) |
| 7 | `refresh_token()` | ⚠️ | 2 tests (1 failing) | 🟡 Partial |
| 8 | `delete_users_by_prefix()` | ✅ | 1 test | 🟢 Basic |
| 9 | `create_notification()` | ✅ | 1 test | 🟢 Basic |
| 10 | `get_notifications()` | ⚠️ | 0 tests | 🔴 **MISSING** |
| 11 | `mark_notification_read()` | ✅ | 1 test | 🟢 Basic |
| 12 | `mark_all_notifications_read()` | ✅ | 1 test | 🟢 Basic |
| 13 | `logout()` | ⚠️ | 1 test (failing) | 🔴 Broken |
| 14 | `list_active_sessions()` | ✅ | 1 test | 🟢 Basic |
| 15 | `list_all_sessions()` | ✅ | 1 test | 🟢 Basic |
| 16 | `revoke_session()` | ⚠️ | 2 tests (1 failing) | 🟡 Partial |
| 17 | `revoke_any_session()` | ❌ | 0 tests | 🔴 **MISSING** |
| 18 | `get_user_permissions()` | ❌ | 0 tests | 🔴 **MISSING** |
| 19 | `count_users()` | ✅ | 1 test | 🟢 Basic |
| 20 | `count_active_refresh_tokens()` | ⚠️ | 1 test (failing) | 🔴 Broken |
| 21 | `recent_users()` | ✅ | 1 test | 🟢 Basic |
| 22 | `grant_role_for_test()` | ✅ | Used in tests | 🟢 Helper |

**Summary**:
- ✅ **16 methods fully tested** (73%)
- ⚠️ **4 methods partially tested** (18%)
- ❌ **2 methods not tested** (9%)

---

## Detailed Issue Analysis

### Issue 1: `test_count_active_refresh_tokens`

**Problem**: Expects 3 tokens but finds 4

```rust
// Test creates 3 logins
for _ in 0..3 {
    services.auth_service.login(...).await;
}

let count = services.auth_service.count_active_refresh_tokens().await;
assert_eq!(count, 3); // FAILS: count = 4
```

**Root Cause**: 
- `#[sqlx::test]` provides isolated database per test
- But `count_active_refresh_tokens()` counts ALL tokens in database
- Possible that setup_services creates an initial token
- Or test is counting tokens from common setup

**Fix Options**:
1. Query user-specific tokens instead of all tokens
2. Get baseline count before creating tokens
3. Fix the count method to filter by user

### Issue 2: `test_logout_blacklists_refresh_token`

**Problem**: Logout doesn't properly soft-delete token

```rust
services.auth_service.logout(refresh_token).await;

// Verify token is blacklisted (soft-deleted)
let exists: bool = sqlx::query_scalar(
    "SELECT EXISTS(SELECT 1 FROM unified_refresh_tokens WHERE token_id = $1 AND deleted_at IS NULL)"
).fetch_one(&pool).await.unwrap();

assert!(!exists); // FAILS: token still exists
```

**Root Cause**:
- `logout()` updates `entities` table with `deleted_at`
- `unified_refresh_tokens` view may not filter by `deleted_at`
- View definition needs to include `WHERE deleted_at IS NULL`

**Fix**: Update view definition or test query

### Issue 3: `test_refresh_token_with_roles_and_permissions`

**Problem**: Role assignment not working as expected

```rust
// Insert role into user_roles table
sqlx::query("INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)")
    .bind(user_id)
    .bind(role_id)
    .execute(&pool)
    .await
    .unwrap();
```

**Root Cause**:
- `user_roles` table doesn't exist anymore
- System uses ontology relationships: `User -[has_role]-> Role`
- Test uses old schema

**Fix**: Use ontology service to create relationship

### Issue 4: `test_revoke_session`

**Problem**: Session revocation not working

```rust
services.auth_service.revoke_session(user_id, token_id).await;

// Verify session is revoked
let sessions = services.auth_service.list_active_sessions(user_id, None).await;
assert_eq!(sessions.len(), 1); // FAILS: still shows 2
```

**Root Cause**: Same as logout - view not filtering deleted entities

---

## Missing Test Coverage

### 1. `get_notifications()` - NOT TESTED

**Method**: Retrieves notifications for a user

**Missing Tests**:
- ✅ Get notifications for user with notifications
- ✅ Get notifications for user with no notifications
- ✅ Verify notification ordering (newest first)
- ✅ Verify read/unread status

### 2. `revoke_any_session()` (Admin) - NOT TESTED

**Method**: Admin can revoke any user's session

**Missing Tests**:
- ✅ Admin revokes another user's session
- ✅ Verify audit log entry created
- ✅ Error when session doesn't exist
- ✅ Verify user is logged out

### 3. `get_user_permissions()` - NOT TESTED

**Method**: Gets all effective permissions for a user (ABAC + ReBAC)

**Missing Tests**:
- ✅ User with role that grants permissions
- ✅ User with DENY permissions (should be filtered)
- ✅ User with temporal permissions (expired vs active)
- ✅ User with no permissions
- ✅ Permission deduplication

---

## Edge Cases Not Covered

### Registration
- ❌ Username too short (< 3 chars)
- ❌ Email format validation
- ❌ Password too short (< 8 chars)
- ❌ Special characters in username
- ❌ Unicode in email/username

### Login
- ❌ Account lockout after N failed attempts (if implemented)
- ❌ Login with soft-deleted user
- ❌ Concurrent logins (race conditions)
- ❌ Login while MFA setup incomplete

### Sessions
- ❌ Expired token refresh attempt
- ❌ Revoked token refresh attempt
- ❌ Maximum sessions per user limit (if implemented)
- ❌ Session hijacking detection

### Notifications
- ❌ Mark notification as read twice
- ❌ Mark deleted notification as read
- ❌ Notification for non-existent user

---

## Recommended Action Plan

### Phase 1: Fix Failing Tests (Priority: 🔴 HIGH)

1. **Fix `test_count_active_refresh_tokens`**
   - Get baseline count before test
   - Or count user-specific tokens only

2. **Fix `test_logout_blacklists_refresh_token`**
   - Update `unified_refresh_tokens` view to filter deleted
   - Or update test to query entities table directly

3. **Fix `test_refresh_token_with_roles_and_permissions`**
   - Use ontology service to create role relationship
   - Remove direct `user_roles` table insert

4. **Fix `test_revoke_session`**
   - Ensure soft-delete is applied
   - Update view definition

**Estimated Time**: 1-2 hours

### Phase 2: Add Missing Method Tests (Priority: 🟡 MEDIUM)

5. **Test `get_notifications()`** (3 tests)
6. **Test `revoke_any_session()`** (4 tests)
7. **Test `get_user_permissions()`** (5 tests)

**Estimated Time**: 2-3 hours

### Phase 3: Add Edge Case Tests (Priority: 🟢 LOW)

8. **Registration edge cases** (5 tests)
9. **Login edge cases** (4 tests)
10. **Session edge cases** (4 tests)
11. **Notification edge cases** (3 tests)

**Estimated Time**: 2-3 hours

### Phase 4: Integration & Security Tests (Priority: 🟢 LOW)

12. **Concurrent operations** (3 tests)
13. **Token security** (3 tests)
14. **Permission enforcement** (4 tests)

**Estimated Time**: 2-3 hours

---

## Coverage Goals

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Tests Passing** | 85% (23/27) | 100% | 🔴 Below |
| **Methods Tested** | 73% (16/22) | 90%+ | 🟡 Close |
| **Edge Cases** | 30% estimate | 75%+ | 🔴 Below |
| **Security Tests** | Good | Excellent | 🟡 Good |
| **Integration Tests** | Good | Excellent | 🟢 Good |

---

## Test Quality Metrics

### Current Strengths ✅

- ✅ Good use of `#[sqlx::test]` for database isolation
- ✅ Comprehensive password reset tests (11 tests in separate file)
- ✅ Good MFA integration testing
- ✅ Tests verify database state, not just return values
- ✅ Error cases are tested
- ✅ Security features (Argon2, notifications) are tested

### Areas for Improvement ⚠️

- ⚠️ Test isolation issues (count tests affected by other data)
- ⚠️ Some tests use old schema (user_roles table)
- ⚠️ View filtering not handling soft-deletes
- ⚠️ Missing negative test cases
- ⚠️ No concurrency/race condition tests
- ⚠️ Limited validation tests

---

## Conclusion

**Overall Assessment**: 🟡 **Good Foundation, Needs Refinement**

The auth service has good test coverage for core functionality (73% of methods), but has 4 failing tests that need immediate attention. The tests are well-structured and thorough where they exist, but there are gaps in:

1. **Missing method tests** (get_notifications, revoke_any_session, get_user_permissions)
2. **Edge case coverage** (validation, error conditions)
3. **View/schema alignment** (soft-delete filtering)

**Priority**: Fix the 4 failing tests first, then add tests for the 2 untested methods. This will bring coverage to 90%+ with 100% passing rate.

**Estimated Total Effort**: 6-10 hours for comprehensive coverage

---

**Next Steps**: 
1. Fix failing tests (1-2 hours)
2. Add missing method tests (2-3 hours)
3. Document findings in PR

**Related Documents**:
- `CODEBASE_REVIEW.md` - Original review
- `TASKS.md` - Implementation plans
