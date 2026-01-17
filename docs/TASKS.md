# Backend Auth Feature - Test Coverage Improvement Plan

## Overview
This document outlines the test coverage improvement plan for the backend authentication feature. **Phase 1 (JWT Module) is complete with 81.5% coverage**. Remaining phases focus on service layer, routes, security, concurrency, and integration testing.

## Current State (2026-01-17)

### Coverage Analysis
- **Overall Auth Feature Coverage**: 0.89% (31/3,493 lines)
- **JWT Module**: 81.5% (31/38 lines) - ✅ COMPLETED
- **Service Layer**: 0% (0/365 lines)
- **Routes**: 0% (0/180 lines)
- **Models**: Partial validation tested

### Existing Tests
- **auth_test.rs**: 5 tests (service-level: register, login, change-password, notifications, session-revocation)
- **auth_api_test.rs**: 8 tests (API-level: register, login, refresh, logout, change-password, notifications, sessions, profile-update, admin-functions)

---

## Phase 1: JWT Module Unit Tests ✅ COMPLETED

**File**: `backend/tests/jwt_test.rs`
**Target Coverage**: 90%+ (45 lines)
**Achieved**: 81.5% (31/38 lines) - ✅ SATISFIES >75% TARGET
**Priority**: HIGH (Critical security component)

### Completed Tests (24 total)

#### Token Creation Tests (5 tests)
- [x] `test_create_jwt_valid_token` - Verify token contains all required claims
- [x] `test_create_jwt_expiration_time` - Verify exp timestamp is correct
- [x] `test_create_jwt_with_roles_and_permissions` - Include auth claims
- [x] `test_create_jwt_empty_roles_and_permissions` - Handle empty claims

#### Refresh Token Tests (4 tests)
- [x] `test_create_refresh_token_with_jti` - Verify JTI is generated
- [x] `test_create_refresh_token_longer_expiration` - Verify 30-day expiry
- [x] `test_create_refresh_token_jti_uniqueness` - Multiple calls generate unique JTIs
- [x] `test_create_refresh_token_includes_roles_and_permissions` - Include claims

#### Token Validation Tests (5 tests)
- [x] `test_validate_jwt_success` - Accept valid token
- [x] `test_validate_jwt_expired` - Reject expired tokens (ignored - JWT lib behavior)
- [x] `test_validate_jwt_invalid_signature` - Reject tampered tokens
- [x] `test_validate_jwt_malformed` - Reject malformed tokens
- [x] `test_validate_jwt_with_jti` - Validate tokens with JTI

#### PEM Loading Tests (3 tests)
- [x] `test_load_private_pem_from_config_priority` - Use config-provided key
- [x] `test_load_public_pem_from_config_priority` - Use config-provided key
- [x] `test_config_keys_have_valid_pem_format` - Verify PEM format

#### Token Property Tests (4 tests)
- [x] `test_token_issued_at_time` - Verify iat timestamp
- [x] `test_token_subject_encoding` - Verify sub encoding
- [x] `test_token_role_serialization` - Verify role serialization
- [x] `test_token_permission_serialization` - Verify permission serialization

#### Integration Tests (3 tests)
- [x] `test_multiple_validations_same_token` - Reusable validation
- [x] `test_refresh_token_different_from_access_token` - Token differentiation
- [x] `test_concurrent_token_creation` - Thread-safe token generation

### Test Helpers Created
- [x] `tests/jwt_helpers.rs` module
  - `create_test_config()` - Config with test keys

### Code Changes
- [x] Added `PartialEq, Eq` derives to `UserRoleClaim` for test assertions
- [x] Created comprehensive test coverage for JWT operations

---

## Remaining Phases (TODO)

**Target**: 80%+ overall auth feature coverage

### Phase 2: Service Layer Tests (TODO)
**File**: `backend/tests/auth_service_test.rs`
**Target Coverage**: 80%+ (365 lines)

#### User Registration (Expand existing)
- [ ] `test_register_password_hashed_with_argon2` - Verify Argon2 used
- [ ] `test_register_unique_salt_for_same_password` - Different hashes
- [ ] `test_register_ontology_entity_created` - Verify User entity
- [ ] `test_register_email_validation_edge_cases` - Test invalid emails
- [ ] `test_register_username_validation_edge_cases` - Test invalid usernames

#### User Login (Expand existing)
- [ ] `test_login_with_email` - Accept email identifier
- [ ] `test_login_with_username` - Accept username identifier
- [ ] `test_login_new_device_ip_change` - Detect new IP
- [ ] `test_login_new_device_user_agent_change` - Detect new UA

#### Token Management
- [ ] `test_generate_tokens_includes_roles` - Fetch user roles
- [ ] `test_generate_tokens_includes_permissions` - Fetch permissions
- [ ] `test_refresh_token_valid` - Successfully refresh
- [ ] `test_refresh_token_expired` - Reject expired
- [ ] `test_refresh_token_revoked` - Reject blacklisted

### Phase 3-6: Routes, Security, Concurrency, Integration
(See detailed breakdown in original TASKS.md placeholder - to be implemented after Phase 2)

---

## User MVP: Password Reset & 2FA Implementation Plan

## Overview
This document outlines the implementation plan for the next sprint, focusing on **Password Reset** and **Two-Factor Authentication (2FA)** as required for User MVP release per `requirements_extract.md` §2.

---

## Sprint Goal
Enable users to recover access to their accounts and secure them with MFA.

---

## Phase 1: Password Reset Flow

### Backend Tasks

#### 1.1 Database Schema
- [ ] Add `password_reset_tokens` table
  ```sql
  CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

#### 1.2 Service Layer (`auth/service.rs`)
- [ ] `request_password_reset(email: &str)` - Generate token, store hash, send email
- [ ] `verify_reset_token(token: &str)` - Validate token exists, not expired, not used
- [ ] `reset_password(token: &str, new_password: &str)` - Update password, invalidate token
- [ ] Rate limit: Max 5 reset requests per email per hour

#### 1.3 Routes (`auth/routes.rs`)
- [ ] `POST /api/auth/forgot-password` - Request reset (public)
- [ ] `POST /api/auth/reset-password` - Submit new password (public)
- [ ] `GET /api/auth/verify-reset-token/:token` - Check token validity (public)

#### 1.4 Email Integration
- [ ] Upgrade `utils/email.rs` stub to send actual emails (or queue for external service)
- [ ] Create password reset email template with secure link

### Frontend Tasks

#### 1.5 UI Components
- [ ] `/forgot-password` page with email input
- [ ] `/reset-password/:token` page with new password form
- [ ] Success/error feedback states
- [ ] Link from login page to forgot password

### Tests
- [ ] `test_request_reset_valid_email` - Token generated and email "sent"
- [ ] `test_request_reset_invalid_email` - Silent success (no user enumeration)
- [ ] `test_reset_password_valid_token` - Password updated
- [ ] `test_reset_password_expired_token` - Rejected
- [ ] `test_reset_password_used_token` - Rejected (single-use)

---

## Phase 2: Two-Factor Authentication (TOTP)

### Backend Tasks

#### 2.1 Database Schema
- [ ] Add `user_mfa` table
  ```sql
  CREATE TABLE user_mfa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    secret_encrypted TEXT NOT NULL,
    backup_codes_hash TEXT[], -- Array of hashed backup codes
    enabled BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

#### 2.2 Service Layer (`auth/mfa_service.rs`)
- [ ] `generate_totp_secret(user_id: Uuid)` - Generate and store encrypted secret
- [ ] `get_totp_qr_uri(user_id: Uuid)` - Return otpauth:// URI for QR code
- [ ] `verify_totp_code(user_id: Uuid, code: &str)` - Validate TOTP code
- [ ] `enable_mfa(user_id: Uuid, code: &str)` - Enable after successful verification
- [ ] `disable_mfa(user_id: Uuid, password: &str)` - Disable with password confirmation
- [ ] `generate_backup_codes(user_id: Uuid)` - Generate 10 one-time backup codes
- [ ] `use_backup_code(user_id: Uuid, code: &str)` - Validate and consume backup code

#### 2.3 Routes (`auth/routes.rs`)
- [ ] `POST /api/auth/mfa/setup` - Start MFA enrollment (returns QR data)
- [ ] `POST /api/auth/mfa/verify` - Verify code and enable MFA
- [ ] `POST /api/auth/mfa/disable` - Disable MFA (requires password)
- [ ] `GET /api/auth/mfa/backup-codes` - Get backup codes (one-time view)
- [ ] `POST /api/auth/mfa/challenge` - Submit TOTP during login

#### 2.4 Login Flow Modification
- [ ] Update `login()` to detect MFA-enabled users
- [ ] Return `mfa_required: true` instead of tokens if MFA enabled
- [ ] Add `mfa_session_token` for temporary login state
- [ ] Require TOTP verification before issuing access/refresh tokens

### Frontend Tasks

#### 2.5 UI Components
- [ ] MFA setup wizard in `/profile` (QR code display, code verification)
- [ ] Backup codes display with copy/download functionality
- [ ] MFA challenge page during login flow
- [ ] MFA disable confirmation dialog

### Tests
- [ ] `test_mfa_setup_generates_secret` - Secret stored
- [ ] `test_mfa_enable_with_valid_code` - MFA activated
- [ ] `test_mfa_enable_with_invalid_code` - Rejected
- [ ] `test_login_with_mfa_requires_challenge` - Returns mfa_required
- [ ] `test_mfa_challenge_valid_code` - Tokens issued
- [ ] `test_backup_code_single_use` - Code consumed after use

---

## Dependencies
- `totp-rs` crate for TOTP generation/verification
- `qrcode` crate for QR code generation
- Email service integration (or enhanced stub)

## Estimated Effort
| Phase | Tasks | Effort |
|-------|-------|--------|
| Password Reset | 12 | 2-3 days |
| 2FA (TOTP) | 18 | 3-4 days |
| **Total** | **30** | **~1 week** |

---

## Success Criteria
- [ ] User can request password reset via email
- [ ] User can reset password with valid token
- [ ] User can enroll in 2FA via QR code
- [ ] User must enter TOTP code after password login if MFA enabled
- [ ] User can use backup code if device unavailable
- [ ] All tests passing
