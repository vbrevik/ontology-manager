# Coverage by Feature Area

**Date**: 2026-01-20  
**Backend Coverage**: 1.00% (56/5,599 lines)  
**Frontend Coverage**: ~20-30% (estimated)

---

## 🔐 Authentication & Security

| Module | Lines | Tested | Coverage | Priority |
|--------|-------|--------|----------|----------|
| `auth/service.rs` | 563 | 0 | **0.0%** | 🔴 **CRITICAL** |
| `auth/routes.rs` | 302 | 0 | **0.0%** | 🔴 High |
| `auth/jwt.rs` | 48 | 0 | **0.0%** | 🔴 **CRITICAL** |
| `auth/mfa.rs` | 160 | 9 | **5.6%** | 🟡 Medium |
| `middleware/auth.rs` | 57 | 0 | **0.0%** | 🔴 **CRITICAL** |
| `middleware/csrf.rs` | 27 | 0 | **0.0%** | 🔴 **CRITICAL** |
| `utils/jwt_keys.rs` | 16 | 0 | **0.0%** | 🔴 **CRITICAL** |
| `utils/key_rotation.rs` | 23 | 0 | **0.0%** | 🟡 Medium |
| **TOTAL** | **1,196** | **9** | **0.8%** | 🔴 **CRITICAL** |

**Risk Assessment**: 🚨 **SEVERE SECURITY RISK** - Authentication system completely untested

---

## 🛡️ Authorization (ABAC/REBAC)

| Module | Lines | Tested | Coverage | Priority |
|--------|-------|--------|----------|----------|
| `rebac/permissions.rs` | 335 | 0 | **0.0%** | 🔴 **CRITICAL** |
| `rebac/temporal.rs` | 229 | 0 | **0.0%** | 🔴 High |
| `rebac/routes.rs` | 224 | 0 | **0.0%** | 🟡 Medium |
| `rebac/relationships.rs` | 105 | 0 | **0.0%** | 🟡 Medium |
| `rebac/policy_service.rs` | 107 | 0 | **0.0%** | 🟡 Medium |
| `rebac/condition_evaluator.rs` | 73 | 18 | **24.7%** | 🟢 Low |
| `rebac/delegation.rs` | 66 | 0 | **0.0%** | 🟡 Medium |
| `rebac/impact.rs` | 36 | 0 | **0.0%** | 🟡 Medium |
| `rebac/roles.rs` | 36 | 0 | **0.0%** | 🟡 Medium |
| `rebac/policy_models.rs` | 33 | 13 | **39.4%** | 🟢 Low |
| `rebac/service.rs` | 12 | 0 | **0.0%** | 🟡 Medium |
| `rebac/policy_bridge.rs` | 11 | 0 | **0.0%** | 🟡 Medium |
| `rebac/policy_routes.rs` | 38 | 0 | **0.0%** | 🟡 Medium |
| `abac/service.rs` | 241 | 0 | **0.0%** | 🔴 High |
| `abac/routes.rs` | 66 | 0 | **0.0%** | 🟡 Medium |
| `middleware/abac.rs` | 34 | 0 | **0.0%** | 🟡 Medium |
| **TOTAL** | **1,646** | **31** | **1.9%** | 🔴 **CRITICAL** |

**Risk Assessment**: 🚨 **HIGH SECURITY RISK** - Authorization logic mostly untested

---

## 🗄️ Core Data Layer

| Module | Lines | Tested | Coverage | Priority |
|--------|-------|--------|----------|----------|
| `ontology/service.rs` | 421 | 0 | **0.0%** | 🔴 **CRITICAL** |
| `ontology/routes.rs` | 164 | 0 | **0.0%** | 🟡 Medium |
| `projects/service.rs` | 314 | 0 | **0.0%** | 🔴 High |
| `projects/routes.rs` | 103 | 0 | **0.0%** | 🟡 Medium |
| `projects/models.rs` | 7 | 0 | **0.0%** | 🟢 Low |
| **TOTAL** | **1,009** | **0** | **0.0%** | 🔴 **CRITICAL** |

**Risk Assessment**: 🚨 **HIGH BUSINESS RISK** - Core data operations untested

---

## 🚦 Rate Limiting & Security Controls

| Module | Lines | Tested | Coverage | Priority |
|--------|-------|--------|----------|----------|
| `rate_limit/service.rs` | 174 | 0 | **0.0%** | 🔴 High |
| `rate_limit/routes.rs` | 64 | 0 | **0.0%** | 🟡 Medium |
| `rate_limit/middleware.rs` | 31 | 0 | **0.0%** | 🟡 Medium |
| `middleware/rate_limit.rs` | 44 | 16 | **36.4%** | 🟢 Low |
| **TOTAL** | **313** | **16** | **5.1%** | 🔴 High |

**Risk Assessment**: 🟡 **MEDIUM RISK** - Partial coverage (CVE-004 being addressed)

---

## 👥 User Management

| Module | Lines | Tested | Coverage | Priority |
|--------|-------|--------|----------|----------|
| `users/service.rs` | 91 | 0 | **0.0%** | 🔴 High |
| `users/routes.rs` | 29 | 0 | **0.0%** | 🟡 Medium |
| **TOTAL** | **120** | **0** | **0.0%** | 🔴 High |

**Risk Assessment**: 🔴 **HIGH RISK** - User management untested

---

## 🚒 Emergency Access & Firefighter

| Module | Lines | Tested | Coverage | Priority |
|--------|-------|--------|----------|----------|
| `firefighter/service.rs` | 87 | 0 | **0.0%** | 🔴 High |
| `firefighter/routes.rs` | 54 | 0 | **0.0%** | 🟡 Medium |
| **TOTAL** | **141** | **0** | **0.0%** | 🔴 High |

**Risk Assessment**: 🔴 **HIGH RISK** - Emergency access bypass untested

---

## 🤖 AI & Discovery

| Module | Lines | Tested | Coverage | Priority |
|--------|-------|--------|----------|----------|
| `ai/service.rs` | 150 | 0 | **0.0%** | 🟡 Medium |
| `ai/routes.rs` | 66 | 0 | **0.0%** | 🟢 Low |
| `discovery/service.rs` | 126 | 0 | **0.0%** | 🟡 Medium |
| `discovery/routes.rs` | 23 | 0 | **0.0%** | 🟢 Low |
| **TOTAL** | **365** | **0** | **0.0%** | 🟡 Medium |

**Risk Assessment**: 🟡 **MEDIUM RISK** - Feature-specific, lower priority

---

## 📊 Dashboard & System

| Module | Lines | Tested | Coverage | Priority |
|--------|-------|--------|----------|----------|
| `dashboard/service.rs` | 104 | 0 | **0.0%** | 🟡 Medium |
| `dashboard/routes.rs` | 17 | 0 | **0.0%** | 🟢 Low |
| `system/service.rs` | 100 | 0 | **0.0%** | 🟡 Medium |
| `system/audit_service.rs` | 21 | 0 | **0.0%** | 🟡 Medium |
| `system/routes.rs` | 20 | 0 | **0.0%** | 🟢 Low |
| **TOTAL** | **262** | **0** | **0.0%** | 🟡 Medium |

**Risk Assessment**: 🟡 **MEDIUM RISK** - Monitoring and reporting features

---

## 🧪 Testing Infrastructure

| Module | Lines | Tested | Coverage | Priority |
|--------|-------|--------|----------|----------|
| `test_mode/service.rs` | 71 | 0 | **0.0%** | 🟢 Low |
| `test_mode/routes.rs` | 50 | 0 | **0.0%** | 🟢 Low |
| `test_marker/service.rs` | 23 | 0 | **0.0%** | 🟢 Low |
| `test_marker/routes.rs` | 34 | 0 | **0.0%** | 🟢 Low |
| **TOTAL** | **178** | **0** | **0.0%** | 🟢 Low |

**Risk Assessment**: 🟢 **LOW RISK** - Test utilities, not production critical

---

## 🧭 Navigation & API Management

| Module | Lines | Tested | Coverage | Priority |
|--------|-------|--------|----------|----------|
| `navigation/models.rs` | 184 | 0 | **0.0%** | 🟡 Medium |
| `navigation/routes.rs` | 47 | 0 | **0.0%** | 🟢 Low |
| `navigation/service.rs` | 25 | 0 | **0.0%** | 🟢 Low |
| `api_management/service.rs` | 46 | 0 | **0.0%** | 🟡 Medium |
| `api_management/routes.rs` | 22 | 0 | **0.0%** | 🟢 Low |
| **TOTAL** | **324** | **0** | **0.0%** | 🟡 Medium |

**Risk Assessment**: 🟡 **MEDIUM RISK** - UI navigation and API config

---

## ⚙️ Configuration & Utilities

| Module | Lines | Tested | Coverage | Priority |
|--------|-------|--------|----------|----------|
| `config/mod.rs` | 28 | 0 | **0.0%** | 🟡 Medium |
| `utils/email.rs` | 17 | 0 | **0.0%** | 🟡 Medium |
| `utils/jwt_keys.rs` | 16 | 0 | **0.0%** | 🔴 **CRITICAL** |
| `utils/key_rotation.rs` | 23 | 0 | **0.0%** | 🟡 Medium |
| **TOTAL** | **84** | **0** | **0.0%** | 🔴 High |

**Risk Assessment**: 🔴 **HIGH RISK** - JWT keys are critical security component

---

## 📈 Coverage Summary by Risk Level

### 🔴 CRITICAL RISK (0-10% Coverage)
**Total Lines**: 2,541  
**Tested Lines**: 9  
**Coverage**: 0.4%

- Authentication & Authorization core (1,196 lines)
- Core data layer (1,009 lines)
- User management (120 lines)
- Firefighter access (141 lines)
- JWT utilities (16 lines)
- CSRF middleware (27 lines)
- Auth middleware (57 lines)

### 🔴 HIGH RISK (0-30% Coverage)
**Total Lines**: 1,821  
**Tested Lines**: 16  
**Coverage**: 0.9%

- REBAC permissions & temporal (564 lines)
- ABAC service (241 lines)
- Rate limiting (313 lines)
- Projects service (314 lines)
- Configuration (84 lines)

### 🟡 MEDIUM RISK (0-50% Coverage)
**Total Lines**: 1,108  
**Tested Lines**: 31  
**Coverage**: 2.8%

- AI & Discovery (365 lines)
- Dashboard & System (262 lines)
- Navigation & API Mgmt (324 lines)
- REBAC supporting modules (157 lines)

### 🟢 LOW RISK (50%+ Coverage OR Low Priority)
**Total Lines**: 129  
**Tested Lines**: 0  
**Coverage**: 0.0%

- Test infrastructure (178 lines) - not production code
- Low-priority routes and models

---

## 🎯 Recommended Testing Order

### Week 1-2: Critical Security (Target: 80%+ each)
1. `middleware/auth.rs` (57 lines) - **MUST TEST FIRST**
2. `middleware/csrf.rs` (27 lines)
3. `utils/jwt_keys.rs` (16 lines)
4. `auth/jwt.rs` (48 lines)
5. `auth/service.rs` (563 lines) - **LARGEST CRITICAL MODULE**

**Expected Impact**: +15% overall coverage, eliminates critical security gaps

### Week 3-4: Core Business Logic (Target: 70%+ each)
6. `ontology/service.rs` (421 lines)
7. `projects/service.rs` (314 lines)
8. `rebac/permissions.rs` (335 lines)
9. `users/service.rs` (91 lines)

**Expected Impact**: +30% overall coverage

### Week 5-6: Authorization & Controls (Target: 70%+ each)
10. `rebac/temporal.rs` (229 lines)
11. `rate_limit/service.rs` (174 lines) - complete CVE-004
12. `abac/service.rs` (241 lines)
13. `firefighter/service.rs` (87 lines)

**Expected Impact**: +45% overall coverage

### Week 7-8: Routes & Integration (Target: 60%+ each)
14. All route handlers (integration tests)
15. Frontend component tests
16. E2E critical user journeys

**Expected Impact**: +60-70% overall coverage

---

## 🚨 Immediate Actions (This Week)

1. **STOP** adding new features until critical auth modules are tested
2. **CREATE** tests for `middleware/auth.rs` (57 lines, 0%)
3. **CREATE** tests for `middleware/csrf.rs` (27 lines, 0%)
4. **CREATE** tests for `utils/jwt_keys.rs` (16 lines, 0%)
5. **FIX** 9 failing frontend tests
6. **ESTABLISH** minimum 70% coverage requirement for new PRs

---

**Bottom Line**: The codebase is **severely under-tested** with only **1% backend coverage**. The authentication and authorization systems, which are the most critical security components, have **ZERO test coverage**. This represents a **significant security and business risk** that must be addressed immediately.

**Target**: Achieve **80% coverage** on all security-critical modules within **8 weeks**, with authentication tested by end of Week 2.
