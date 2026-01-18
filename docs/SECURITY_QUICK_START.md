# Security Audit - Quick Start Guide

**Date**: 2026-01-18  
**Status**: 🔴 **CRITICAL FIXES REQUIRED**

---

## 🚨 **IMMEDIATE ACTIONS** (Deploy Today)

### 1. Fix Missing Admin Authorization (30 min)

**File**: `backend/src/features/auth/routes.rs`

**Lines**: 462-468, 481-489, 492-498

**Fix**:
```rust
async fn list_all_sessions_handler(
    State(auth_service): State<AuthService>,
    Extension(claims): Extension<crate::features::auth::jwt::Claims>,
) -> Result<Json<Vec<...>>, AuthError> {
    // ✅ ADD THIS CHECK
    if !claims.roles.iter().any(|r| r.role_name == "SuperAdmin") {
        return Err(AuthError::PermissionDenied);
    }
    
    let sessions = auth_service.list_all_sessions(100).await?;
    Ok(Json(sessions))
}

// Apply same check to:
// - revoke_any_session_handler (line 481)
// - get_audit_logs_handler (line 492)
```

**Also add new error**:
```rust
// service.rs:32
#[derive(Error, Debug)]
pub enum AuthError {
    // ... existing errors
    #[error("Permission denied")]
    PermissionDenied,  // ← ADD THIS
}

// service.rs:76
impl AuthError {
    pub fn to_status_code(&self) -> StatusCode {
        match self {
            // ... existing
            Self::PermissionDenied => StatusCode::FORBIDDEN,  // ← ADD THIS
        }
    }
}
```

---

### 2. Fix Insecure Cookies (15 min)

**File**: `backend/src/features/auth/routes.rs`

**Lines**: 27, 40

**Fix**:
```rust
// Line 27:
.secure(cfg!(not(debug_assertions)))  // ✅ Secure=true in release mode

// Line 40:
.secure(cfg!(not(debug_assertions)))  // ✅ Secure=true in release mode
```

**For local dev**: HTTP will still work in debug builds

---

### 3. Remove Test Endpoints (5 min)

**File**: `backend/src/features/auth/routes.rs`

**Line 80**: DELETE this line:
```rust
.route("/test/grant-role", post(grant_role_handler))  // ← DELETE ENTIRE LINE
```

**Lines 366-400**: DELETE entire `grant_role_handler` function

---

## ⏭️ **NEXT ACTIONS** (Deploy This Week)

### 4. Add Rate Limiting

**Priority**: HIGH  
**Time**: 2-4 hours  
**File**: `backend/src/main.rs`

Add rate limit middleware to auth routes:
```rust
.nest(
    "/auth",
    Router::new()
        .merge(
            features::auth::routes::public_auth_routes()
                .layer(/* RATE LIMIT HERE */)
        )
)
```

**Limits**:
- Login: 5 attempts / 15 min per IP
- MFA: 10 attempts / 5 min per token
- Password reset: 3 requests / hour per IP
- Register: 3 accounts / hour per IP

---

### 5. Fix User Enumeration

**Priority**: HIGH  
**Time**: 1 hour  
**File**: `backend/src/features/auth/service.rs`

**Line 434**: Add timing delay:
```rust
None => {
    // ✅ Match timing of real flow
    tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
    return Ok(None);
}
```

**Line 157**: Make error generic:
```rust
if existing_user.is_some() {
    return Err(AuthError::ValidationError("Invalid input".to_string()));  // ✅ Generic
}
```

---

### 6. Fix CSRF Token Generation

**Priority**: MEDIUM  
**Time**: 30 min  
**File**: `backend/src/middleware/csrf.rs`

**Line 17**: Use crypto-secure RNG:
```rust
use rand::rngs::OsRng;  // ← ADD THIS IMPORT

pub fn set_csrf_cookie(cookies: &Cookies) {
    let token: String = OsRng  // ✅ Changed from thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();
    // ...
}
```

---

## 🧪 **TESTING CHECKLIST**

After fixes, run these manual tests:

### Test 1: Admin Authorization
```bash
# Register as normal user
curl -X POST http://localhost:5300/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"test","password":"password123"}'

# Try to list all sessions (should fail with 403 Forbidden)
curl http://localhost:5300/api/auth/sessions/all \
  -H "Cookie: access_token=<normal_user_token>"

# Expected: 403 Forbidden ✅
```

### Test 2: Secure Cookies
```bash
# Check cookie attributes in release build
cargo build --release
./target/release/backend

# Login and check Set-Cookie header
curl -v http://localhost:5300/api/auth/login ...

# Expected: Secure flag present in Set-Cookie ✅
```

### Test 3: Test Endpoints Removed
```bash
# Try to access test endpoint (should 404)
curl -X POST http://localhost:5300/api/auth/test/grant-role

# Expected: 404 Not Found ✅
```

---

## 📊 **RISK REDUCTION**

| Vulnerability | Before | After Fix | Risk Reduction |
|---------------|--------|-----------|----------------|
| Missing Admin Auth | 🔴 Critical | ✅ Secure | 95% |
| Insecure Cookies | 🔴 Critical | ✅ Secure | 100% |
| Test Endpoints | 🟠 High | ✅ Removed | 100% |

**Overall Risk**: HIGH → **LOW** (after Phase 1 fixes)

---

## 📝 **DEPLOYMENT CHECKLIST**

- [ ] Create feature branch: `security/critical-fixes`
- [ ] Apply Fix #1 (admin authorization)
- [ ] Apply Fix #2 (secure cookies)
- [ ] Apply Fix #3 (remove test endpoints)
- [ ] Run test suite: `cargo test`
- [ ] Manual security tests (above)
- [ ] Code review (2 approvals required)
- [ ] Deploy to staging
- [ ] Smoke test staging
- [ ] Deploy to production
- [ ] Monitor error logs for 24h
- [ ] Update security audit status

---

## 🎯 **SUCCESS METRICS**

**Phase 1 Complete When**:
- ✅ No unauthorized users can access admin endpoints
- ✅ All cookies have `Secure` flag in production
- ✅ Test endpoints return 404
- ✅ All tests passing
- ✅ No new security warnings

**Time to Deploy**: 1-2 hours (fixes) + 2 hours (testing) = **4 hours total**

---

## 📞 **QUESTIONS?**

- **For urgent security issues**: Contact security team immediately
- **For implementation questions**: Review full audit report: `docs/SECURITY_AUDIT_2026-01-18.md`
- **For testing help**: See `backend/tests/security_test.rs` (to be created)

---

**Remember**: Security fixes are **never breaking changes**. Deploy with confidence! 🚀
