# Section 01 Review Summary

## Critical: 3 tests fail due to NULL tenant_id (auto-fix)
Tests `test_builtin_uniqueness_preserved`, `test_same_source_duplicate_blocked`, and `test_different_sources_same_name_allowed` don't supply tenant_id. PostgreSQL treats NULL as distinct in unique indexes, so the tests pass/fail for wrong reasons. Fix: supply a non-NULL tenant_id UUID.

## Medium: No test for only-one-extension constraint (auto-fix)
Add a test mirroring `test_only_one_base_allowed` but for extensions.

## Low: ON CONFLICT fragility noted, no action needed now.
## Low: No DOWN migration — acceptable for forward-only convention.
