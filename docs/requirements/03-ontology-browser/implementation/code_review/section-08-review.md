# Code Review: Section 08 - State Persistence

## High-Priority
1. Unmount flush missing for expanded nodes — timeout clears but doesn't flush pending state
2. Test coverage gaps — debounce test is a tautology, missing expanded restoration test, no test for actual useClassTree integration

## Medium
3. Two persistence patterns — OntologyBrowserContext uses hand-rolled, useClassTree uses useLocalStorage
4. ClassTreeSearch not modified — source filter persistence moved to useClassTree (acceptable)

## Low
5-8. Missing tests for selectedClassId, labelMode, stale selection (already covered in section-03 tests)
