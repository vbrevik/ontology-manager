# Changelog

All notable changes to this project are documented in this file.

## 2026-01-01 — Authentication milestone completed

- Completed backend JWT improvements: switched to RS256, RSA key generation and 90-day rotation, public key verification.
- Implemented refresh token rotation, blacklisting, and revocation endpoints.
- Hardened password security (bcrypt cost factor increased) and added password strength validation.
- Added rate limiting and brute-force protections for auth endpoints.
- Implemented CSRF protection and migrated token storage to secure HttpOnly cookies.
- Completed frontend integration: React Vite auth UI, protected routes, session management, and UX improvements.
- Added comprehensive security logging and monitoring hooks.

Notes:
- See `docs/BACKLOG.md`, `docs/IMPLEMENTATION_PLAN.md`, and `docs/security_task_manager.md` for details.


