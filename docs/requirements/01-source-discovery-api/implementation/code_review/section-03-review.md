# Section 03 Code Review

## Critical Issues

### 1. Duplicated filesystem discovery logic (CODE QUALITY)
`discover_fs_only` test helper is ~80 lines copy-pasted from `discover_sources`. Should extract to a shared method.

### 2. discover_fs_only omits symlink detection and timeout (TEST GAP)
Test helper doesn't include symlink validation or timeout logic. `test_discover_broken_symlink` tests missing directory, not actual broken symlink.

### 3. get_active_sources hardcodes available: true (BUG)
Sources could be in DB as active but have their directory deleted. Always reports available=true.

### 4. N+1 query in discover_sources (PERFORMANCE)
Issues one SELECT per discovered source for DB enrichment. Should batch fetch.

## Missing Tests
- test_set_same_source_as_base_and_extension (validates failure condition)
- test_set_active_nonexistent_source (validates NotFound error)
- test_sync_sources_upsert should verify updated_at refresh

## Minor Issues
- read_link error handling: both branches return true, swallowing unexpected errors
- sync_sources_to_db signature &[DiscoveredSource] deviates from plan (improvement)
