# User MVP: Password Reset & 2FA Implementation Plan

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
