# Code Review Interview: Section 06 - Shared Components

**Date:** 2026-03-22T15:43:00+01:00

## Interview Items

### Issue 1+2: ClassLink and SourceBadge callbacks not wired in ClassHeader
- **Decision:** Wire now
- **Action:** FIX — Add onNavigate and onSourceClick props to ClassHeader, wire them to ClassLink and SourceBadge respectively. Update ClassDetail to pass setSelectedClassId from context.

## Auto-fixes
None.

## Let go
- Test brittleness (className string checks) — acceptable for now
- findAllByText in ConflictBadge test — Radix tooltip duplication is expected
- hashStringToHue not exported — indirectly tested via style assertions, sufficient
- No barrel export — no barrel file exists in shared/
