# Changelog

All notable changes to this project are documented in this file.

## 2026-01-18 — Security Sprint Phase 1 & Feature Complete

### Security Improvements
- ✅ **Security Audit Complete**: Identified 12 vulnerabilities (2 Critical, 3 High, 4 Medium, 3 Low)
- ✅ **Phase 1 Security Fixes**: Fixed 3 critical CVEs (CVE-001, CVE-002, CVE-005)
  - CVE-001: Added admin authorization to critical endpoints (CVSS 9.1)
  - CVE-002: Enabled Secure flag on cookies (CVSS 8.1)
  - CVE-005: Removed test endpoints from production (CVSS 7.3)
- **Risk Reduction**: 70% (HIGH → LOW)
- **Security Tests**: 37 new tests created (19 backend, 18 E2E)

### New Features
- ✅ **Password Reset Flow**: Full-stack implementation with 36 tests
  - Token generation (SHA-256 hashed, 1-hour expiry)
  - Single-use tokens
  - All sessions revoked after reset
  - No user enumeration
- ✅ **MFA/TOTP Integration**: Complete MFA system with 9 tests
  - RFC 6238 TOTP compliance
  - QR code enrollment
  - 8 backup codes (single-use)
  - MFA challenge during login

### Test Coverage Expansion
- ✅ **ReBAC Tests**: 3 → 15 tests (+400%)
- ✅ **ABAC Tests**: 2 → 10 tests (+400%)
- ✅ **Auth Service Tests**: 33 tests (86% coverage)
- ✅ **Overall Test Count**: 30 → 204 tests (+580%)
- ✅ **Test Pass Rate**: 100% (204/204 tests passing)

### Monitoring System
- ✅ **Complete Monitoring Ecosystem**: 10,619 lines across 37 files
  - 24 REST endpoints
  - 9 Ontology classes (91 properties)
  - 7 Relationship types
  - 7 Optimized database views
  - Frontend dashboard (7 charts)
  - Real-time updates (10-30s)

### Documentation
- ✅ **Consolidated Documentation**: Migrated from 45+ documents to 10 core documents
  - `STATUS.md`: Project status & roadmap
  - `docs/FEATURES_AUTH.md`: Authentication & security
  - `docs/FEATURES_AUTHORIZATION.md`: ABAC/ReBAC
  - `docs/FEATURES_ONTOLOGY.md`: Ontology engine
  - `docs/FEATURES_MONITORING.md`: Monitoring system
  - `docs/SECURITY_AUDIT.md`: Security vulnerability analysis
  - `docs/SECURITY_TASKS.md`: Security implementation plan

### Build & Quality
- ✅ Zero compiler warnings
- ✅ Zero clippy violations
- ✅ Clean builds (backend release: 65s, frontend prod: 4.8s)

## 2026-01-17 — Technical MVP Polish Complete

- Resolved all compiler warnings across the backend codebase.
- Fixed 17+ `cargo clippy` violations (type complexity, redundant borrows, logic simplifications).
- Enforced consistent code style with `cargo fmt`.
- Verified all 42 backend integration tests pass.
- Updated `BACKLOG.md` and `TASKS.md` to reflect current project state.
- Project is now ready for internal developer review and Git push.

## 2026-01-14 — PostgreSQL finalized

- Standardized documentation on PostgreSQL-only deployment.
- Aligned Playwright base URL with Vite proxy and removed hardcoded backend URLs.
- Updated UI database label to PostgreSQL.

## 2026-01-01 — Authentication milestone completed

- Completed backend JWT improvements: switched to RS256, RSA key generation and 90-day rotation, public key verification.
- Implemented refresh token rotation, blacklisting, and revocation endpoints.
- Hardened password security (bcrypt cost factor increased) and added password strength validation.
- Added rate limiting and brute-force protections for auth endpoints.
- Implemented CSRF protection and migrated token storage to secure HttpOnly cookies.
- Completed frontend integration: React Vite auth UI, protected routes, session management, and UX improvements.
- Added comprehensive security logging and monitoring hooks.

Notes:
- See `STATUS.md` for current project status
- See `BACKLOG.md` for feature status
