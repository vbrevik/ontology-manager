# Development Backlog (Feature-Based)

## How to use
- Keep related items together by feature.
- Start with Quick View to find what is left to finalize.

## Status Legend
- [ ] Todo: not started
- [/] In Progress or Partial
- [x] Done
- [!] Blocked

## Active Focus
- **Current Sprint**: User MVP - Password Reset & 2FA
- **Status**: Planning complete, ready for implementation.
- **Priority**: HIGH (Required per §2 of requirements)
- **Blockers**: None
- **Tracking**: See `docs/TASKS.md` for detailed implementation plan.

---

## Quick View: To Finalize

### Sprint 1: User MVP (Current Priority)
- [ ] Password reset flow (backend + frontend)
- [ ] 2FA/MFA (TOTP enrollment, QR, backup codes)

### Sprint 2: User Experience
- [ ] Account verification (email confirmation)
- [ ] Social login options (Google, GitHub OAuth)
- [ ] Form recovery (localStorage or route preservation)
- [ ] Success feedback/toast system

### Sprint 3: Infrastructure & Polish
- [ ] Logging and monitoring (Observability)
- [ ] CI/CD pipeline setup
- [ ] Production deployment configuration
- [ ] Security audit and hardening

---

## Feature Backlog

### Authentication & Sessions

#### Done (Technical MVP)
- [x] JWT RS256 implementation
- [x] RSA key generation + 90-day rotation
- [x] Refresh token rotation + blacklisting
- [x] Password hashing with Argon2id
- [x] Auth endpoint rate limiting
- [x] CSRF double-submit cookie protection
- [x] HttpOnly cookie token storage
- [x] Security logging (structured tracing)
- [x] Remember-me support
- [x] Password strength indicator UI
- [x] Protected routes + idle session warning
- [x] Profile page with account editing + password change
- [x] In-app notification for new device login
- [x] JWT tests (8 passing)
- [x] Auth service tests (5 passing)
- [x] Auth API tests (10 passing)

#### In Progress (User MVP)
- [/] Password reset flow (see TASKS.md)
- [/] 2FA/MFA (see TASKS.md)

#### Todo
- [ ] Account verification (email confirmation)
- [ ] Social login options (Google, GitHub OAuth)

#### Partial
- [/] Email notification (backend stub logs to file)

### Authorization (ABAC/ReBAC)

#### Done
- [x] ABAC schema and services
- [x] ReBAC policy engine with condition evaluator
- [x] Default roles seeded
- [x] JWT includes user roles and permissions
- [x] Frontend `useAbac()` and `RoleGuard`
- [x] Admin ABAC management UI
- [x] Policy context extension
- [x] Temporal/scoped role assignments
- [x] Delegation control

### Ontology Engine

#### Done
- [x] Core ontology schema + versioning
- [x] Ontology routes and services
- [x] System classes auto-seeded
- [x] Entity-Relationship graph model
- [x] Attribute validation

### Navigation

#### Done
- [x] Role-aware navigation evaluation
- [x] Navigation impact simulator
- [x] Backend-first visibility computation
- [x] Explainability (visibility reasons)

### Admin & Management

#### Done
- [x] Admin hub at `/admin`
- [x] User profile management
- [x] Service discovery
- [x] Admin dashboard with real metrics
- [x] Rate limiting with admin GUI
- [x] Bypass token management

### Testing & QA

#### Done
- [x] 42 backend integration tests passing
- [x] E2E tests (Playwright)
- [x] Zero compiler warnings
- [x] Zero clippy violations

---

## Completed Work Summary
- Technical MVP complete (2026-01-17)
- 42 backend tests passing
- Documentation consolidated
- Ready for User MVP sprint

---

## Task Monitoring System
1. Daily standup: review active tasks
2. Weekly planning: prioritize backlog items
3. Sprint reviews: evaluate completed work
4. Retrospectives: improve development process
