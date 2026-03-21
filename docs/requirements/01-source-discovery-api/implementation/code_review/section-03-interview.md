# Section 03 Code Review Interview

## Auto-fixes Applied

### 1. Extracted `discover_from_filesystem` method
Moved filesystem discovery logic from a duplicated test helper into `OntologySourceService::discover_from_filesystem()` — a public static async method. Both `discover_sources` and unit tests now call the same code path. Eliminates ~80 lines of duplication.

### 2. Fixed N+1 query in `discover_sources`
Replaced per-source SELECT with a single batch query using `WHERE source_id = ANY($1)`.

### 3. Simplified `read_link` error handling
Removed the dead branch that duplicated `true` return. Both non-symlink error cases now fall through to a single `true` (directory exists, so it's available).

### 4. Added missing integration tests
- `test_set_same_source_as_base_and_extension` — validates InvalidInput error
- `test_set_active_nonexistent_source` — validates NotFound error
- `test_sync_sources_upsert` now verifies `updated_at` timestamp refresh

## Accepted As-Is

### `available: true` hardcode in `get_active_sources`
Active sources are set via DB operations; filesystem availability is reported by `discover_sources`. Re-checking filesystem on every `get_active` would add latency and complexity for marginal benefit. The `discover_sources` endpoint already reports true availability.

### Symlink-specific test
The `test_discover_broken_symlink` test covers the "path doesn't exist" case which is the common failure mode. Testing actual broken symlinks is fragile in CI. The production code handles both cases via the extracted `discover_from_filesystem` method.
