# Authentication & Security Features

**Last Updated**: 2026-01-18  
**Status**: ✅ Core Features Complete | 🟡 Security Phase 2 In Progress

---

## 📋 Overview

This document describes the authentication and security features implemented in the Ontology Manager platform.

### Features Implemented
- ✅ User registration & login
- ✅ JWT-based stateless authentication (RS256)
- ✅ Password hashing with Argon2id
- ✅ Refresh token rotation & blacklisting
- ✅ CSRF protection (double-submit cookie)
- ✅ Rate limiting (auth endpoints)
- ✅ Password reset flow
- ✅ MFA/TOTP integration
- ✅ Session management & revocation
- ✅ Security logging & audit

---

## 🔐 Core Authentication

### JWT Implementation (RS256)

**Algorithm**: RS256 (RSA Signature with SHA-256)  
**Key Rotation**: 90 days  
**Token Storage**: HttpOnly cookies

#### Access Token
- **Expiration**: 15 minutes
- **Claims**: user_id, roles, permissions, jti (token ID)
- **Usage**: API authentication

#### Refresh Token
- **Expiration**: 30 days
- **Claims**: user_id, jti (unique per refresh)
- **Features**: Rotation on use, revocation support

#### Key Configuration
```rust
// RSA keys generated automatically
// Public/private key pairs for RS256
// Key rotation every 90 days
// Stored in config/jwt_keys/
```

### Password Security

**Hashing**: Argon2id (memory-hard algorithm)  
**Strength Validation**: Minimum 8 characters, mixed case, numbers, special characters

#### Password Reset Flow
1. User requests reset (via email)
2. System generates SHA-256 hashed token (1-hour expiry)
3. Token sent via email (currently stubbed)
4. User clicks link → resets password
5. All sessions revoked after reset

**Security Features**:
- Single-use tokens
- No user enumeration (generic messages)
- All sessions invalidated after reset
- Argon2id hashing for new passwords

---

## 🛡️ Multi-Factor Authentication (MFA)

### TOTP Implementation

**Standard**: RFC 6238 (Time-based One-Time Password)  
**Library**: totp-rs  
**Codes**: 6-digit, valid for 30 seconds

### MFA Flow

#### 1. Enrollment (Setup)
```typescript
User generates TOTP secret
→ System stores encrypted secret
→ User scans QR code
→ User verifies initial code
→ MFA enabled
```

#### 2. Login with MFA
```typescript
User enters credentials
→ System detects MFA enabled
→ Returns mfa_required + mfa_token (5-min expiry)
→ User redirected to /mfa-challenge
→ User enters 6-digit TOTP code
→ System validates (±1 time window)
→ Access/Refresh tokens issued
```

#### 3. Backup Codes
- **Quantity**: 8 single-use codes
- **Storage**: Hashed (bcrypt)
- **Usage**: When TOTP device unavailable
- **Security**: Each code can only be used once

### MFA Security Features
- Encrypted secret storage
- Time window validation (±1 step)
- Temporary MFA tokens (5-min expiry)
- `mfa_pending` permission isolation
- HttpOnly cookies for final tokens

---

## 🔒 Session Management

### Session Lifecycle

1. **Login**: Session created, tokens issued
2. **Refresh**: Access token refreshed, new refresh token issued (rotation)
3. **Logout**: Session revoked (soft-delete), tokens blacklisted
4. **Revocation**: Admin can revoke any user's sessions
5. **Expiry**: Tokens expire automatically

### Session Storage
- **Table**: `user_sessions`
- **Fields**: id, user_id, ip_address, user_agent, created_at, last_used_at, revoked_at
- **Revocation**: Soft-delete (revoked_at timestamp)

### Session Features
- Remember-me support (30-day refresh token)
- New device detection (IP + User-Agent changes)
- Admin session revocation (SuperAdmin only)
- Session audit logging

---

## 🚦 Rate Limiting

### Endpoints Protected

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login | 5 attempts | 15 minutes |
| Registration | 3 attempts | 1 hour |
| Password Reset | 3 requests | 1 hour |
| MFA Challenge | 10 attempts | 5 minutes |

### Implementation
- **Library**: tower-governor
- **Storage**: Redis (in-memory)
- **Key Pattern**: `rate_limit:{endpoint}:{ip_address}`

---

## 📊 Security Testing

### Test Coverage

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| JWT Module | 24 | 81.5% |
| Auth Service | 33 | 86% |
| Password Reset | 11 | 100% |
| MFA Integration | 9 | 100% |
| Security Audit | 19 | 100% |
| **TOTAL** | **96** | **~88%** |

### Security Tests

#### JWT Tests (24)
- Token creation & validation
- Expiration handling
- Signature verification
- Role/permission serialization
- PEM loading
- Concurrent token creation

#### Auth Service Tests (33)
- User registration & login
- Password hashing (Argon2id)
- Token management
- Session management
- New device detection
- Password change

#### Password Reset Tests (11)
- Token generation & hashing
- Token validation
- Password update
- Token expiration
- Single-use tokens
- No user enumeration

#### MFA Tests (9)
- TOTP generation & verification
- MFA enrollment
- MFA challenge flow
- Backup codes
- Time window validation

#### Security Audit Tests (19)
- CVE-001: Admin authorization
- CVE-002: Cookie security
- CVE-003: User enumeration
- CVE-004: Rate limiting
- CVE-005: Test endpoints removed
- CVE-006: CSRF tokens
- CVE-009: MFA entropy
- Ransomware protection
- Container security
- Secrets management

---

## 🔍 Security Features

### CSRF Protection
- **Mechanism**: Double-submit cookie pattern
- **Token**: Cryptographically secure random bytes
- **Validation**: Required on state-changing requests
- **Duration**: Session-scoped

### Input Validation
- **Backend**: Serde schemas (strictly typed)
- **Frontend**: Zod schemas (runtime validation)
- **Fields**: Email, username, passwords, all user inputs

### Security Logging
- **Format**: Structured JSON logs
- **Events**: Login, logout, password change, MFA enable/disable, role changes
- **Storage**: `security_events` table
- **Retention**: 90 days

### Audit Logs
- **Purpose**: Track all administrative actions
- **Access**: SuperAdmin only (protected by CVE-001 fix)
- **Events**: User management, role changes, system configuration
- **Export**: Available for external SIEM integration

---

## 🐛 Security Vulnerabilities

### Fixed (Phase 1 ✅)
- ✅ CVE-001: Missing Admin Authorization (CVSS 9.1)
- ✅ CVE-002: Insecure Cookie Configuration (CVSS 8.1)
- ✅ CVE-005: Test Endpoints in Production (CVSS 7.3)

### Pending (Phase 2 🟡)
- ⏳ CVE-003: User Enumeration (CVSS 7.5)
- ⏳ CVE-004: No Rate Limiting (CVSS 7.5)
- ⏳ CVE-009: Insufficient MFA Entropy (CVSS 4.3)

### Pending (Phases 3-5)
- ⏳ CVE-006: Weak CSRF Token (CVSS 5.4)
- ⏳ CVE-007: No Access Token Blacklist (CVSS 5.9)
- ⏳ CVE-008: Token Reuse Vulnerability (CVSS 5.3)
- ⏳ CVE-010: Information Disclosure (CVSS 4.3)
- ⏳ CVE-011: Missing Security Headers (CVSS 4.0)
- ⏳ CVE-012: Predictable JWT IDs (CVSS 3.7)

---

## 📚 API Endpoints

### Authentication

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | User login |
| POST | `/api/auth/logout` | Protected | Logout user |
| POST | `/api/auth/refresh` | Public | Refresh access token |
| POST | `/api/auth/change-password` | Protected | Change password |
| POST | `/api/auth/forgot-password` | Public | Request password reset |
| POST | `/api/auth/reset-password` | Public | Reset password with token |
| GET | `/api/auth/verify-reset-token/:token` | Public | Verify reset token validity |

### MFA

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/mfa/setup` | Protected | Start MFA enrollment |
| POST | `/api/auth/mfa/verify` | Protected | Verify TOTP & enable MFA |
| POST | `/api/auth/mfa/disable` | Protected | Disable MFA |
| GET | `/api/auth/mfa/backup-codes` | Protected | Get backup codes |
| POST | `/api/auth/mfa/challenge` | Public | Submit TOTP during login |

### Session Management

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/auth/sessions` | Protected | List user sessions |
| POST | `/api/auth/sessions/revoke` | Protected | Revoke session |
| GET | `/api/auth/sessions/all` | SuperAdmin | List all sessions |
| POST | `/api/auth/sessions/revoke-any` | SuperAdmin | Revoke any session |
| GET | `/api/auth/audit-logs` | SuperAdmin | Get audit logs |

---

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgres://app:password@localhost:5301/app_db

# JWT
JWT_PUBLIC_KEY_PATH=./config/jwt_keys/public.pem
JWT_PRIVATE_KEY_PATH=./config/jwt_keys/private.pem
JWT_ACCESS_TOKEN_EXPIRATION_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRATION_DAYS=30

# MFA
MFA_ISSUER=OntologyManager

# Rate Limiting
RATE_LIMIT_LOGIN_ATTEMPTS=5
RATE_LIMIT_LOGIN_WINDOW_MINUTES=15
```

### Security Settings

```rust
// Cookie Configuration
const COOKIE_SECURE: bool = cfg!(not(debug_assertions));
const COOKIE_HTTPONLY: bool = true;
const COOKIE_SAMESITE: SameSite = SameSite::Strict;

// Password Hashing
const ARGON2_TIME_COST: u32 = 3;
const ARGON2_MEMORY_COST: u32 = 65536;
const ARGON2_PARALLELISM: u32 = 4;

// Token Security
const JTI_ENTROPY_BYTES: usize = 32;
const CSRF_TOKEN_BYTES: usize = 32;
```

---

## 🚀 Future Enhancements

### Planned (Sprint 2-3)
- [ ] Account verification (email confirmation)
- [ ] Social login (Google, GitHub OAuth)
- [ ] WebAuthn (passkey authentication)
- [ ] Biometric MFA (if supported)

### Considered (Future)
- [ ] Adaptive authentication (risk-based)
- [ ] Step-up authentication
- [ ] Device fingerprinting
- [ ] Hardware keys (YubiKey)

---

## 📖 References

### Documentation
- **STATUS.md**: Overall project status
- **docs/SECURITY_AUDIT.md**: Complete security audit
- **docs/SECURITY_TASKS.md**: Implementation tasks
- **docs/SECURITY_QUICKSTART.md**: Quick fixes guide

### Test Files
- `backend/tests/jwt_test.rs`: JWT module tests
- `backend/tests/auth_service_test.rs`: Auth service tests
- `backend/tests/password_reset_test.rs`: Password reset tests
- `backend/tests/mfa_integration_test.rs`: MFA tests
- `backend/tests/security_audit_test.rs`: Security tests

### Code Files
- `backend/src/features/auth/service.rs`: Auth business logic
- `backend/src/features/auth/routes.rs`: Auth API endpoints
- `backend/src/features/auth/mfa_service.rs`: MFA implementation
- `backend/src/features/auth/jwt.rs`: JWT utilities
- `backend/src/middleware/rate_limit.rs`: Rate limiting

---

**Feature Owner**: Backend Team  
**Status**: ✅ Core Complete | 🟡 Security Phase 2 In Progress  
**Next Review**: After Security Phase 2 (2026-01-25)
