# Section 01 Review Interview

## Auto-fixes applied (no user input needed):
1. **Fixed 3 tests with NULL tenant_id** — Added explicit `tenant_id = uuid::Uuid::new_v4()` to `test_builtin_uniqueness_preserved`, `test_different_sources_same_name_allowed`, `test_same_source_duplicate_blocked`
2. **Added missing extension uniqueness test** — `test_only_one_extension_allowed` mirrors the base test

## Let go:
- ON CONFLICT fragility — noted, no action needed
- No DOWN migration — forward-only convention accepted
