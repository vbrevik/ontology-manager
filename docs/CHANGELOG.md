# Changelog

All notable changes to this project are documented in this file.

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
- See `docs/BACKLOG.md` for feature status.
