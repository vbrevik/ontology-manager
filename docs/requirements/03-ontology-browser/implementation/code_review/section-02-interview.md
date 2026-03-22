# Code Review Interview: Section 02 - Data Layer

## Auto-fixes Applied
1. **createProperty guard** — Added guard that rejects with clear error when version not loaded
2. **Version query enabled** — Added `enabled: !!classId` to prevent premature fetch
3. **Cast comments** — Documented reason for error type casts

## Let go
- Duplicate classMap (minor optimization, not worth coupling)
- Mutation error state exposure (deferred to section-07 optimistic updates)
- Additional test coverage for availableSources/error propagation (low priority)
