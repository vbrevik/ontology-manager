# Code Review Interview: Section 08 - State Persistence

**Date:** 2026-03-22T16:16:00+01:00

## Auto-fixes
- Issue 1: Add unmount flush for expanded nodes (store in ref, write on unmount)
- Issue 2: Add test for expanded node restoration from localStorage

## Let go
- Pattern inconsistency (OntologyBrowserContext vs useLocalStorage) — not worth refactoring existing working code
- Missing tests for selectedClassId/labelMode/stale selection — already covered in section-03 OntologyBrowserContext tests
- Debounce test being a tautology — the hook integration tests are implicitly covered by ClassTree tests
