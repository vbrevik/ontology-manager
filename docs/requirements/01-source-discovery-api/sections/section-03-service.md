# Section 3: OntologySourceService

## Status: IMPLEMENTED

## Overview

This section implements `OntologySourceService`, the core business logic for ontology source discovery and management. The service reads source configuration from the filesystem (`sources.json` and per-source `manifest.json` files), handles symlink detection, syncs discovered sources to the database, and manages active base/extension flag assignment using transactions.

**Files created/modified:**
- CREATED: `backend/src/features/ontology_sources/service.rs`
- MODIFIED: `backend/src/features/ontology_sources/mod.rs` (added module + re-exports)
- MODIFIED: `backend/src/features/mod.rs` (added `ontology_sources` module)
- MODIFIED: `backend/Cargo.toml` (added `tempfile` dev-dependency)
- MODIFIED: `backend/tests/ontology_sources_test.rs` (added 8 integration tests)

**Deviations from plan:**
- `sync_sources_to_db` takes `&[DiscoveredSource]` instead of `Vec<DiscoveredSource>` (avoids unnecessary ownership transfer)
- Added `discover_from_filesystem` as a public static method to share filesystem logic between `discover_sources` and unit tests (code review fix: eliminated ~80 lines of duplication)
- DB enrichment uses batch `WHERE source_id = ANY($1)` instead of N+1 per-source queries (code review fix)

**Dependencies (completed):**
- Section 01 (migration) -- the `ontology_sources` table exists
- Section 02 (models) -- all struct types defined in `models.rs`

**Blocked by this section:**
- Section 04 (routes) -- handlers call service methods
- Section 06 (tests) -- integration tests exercise the full stack

---

## Tests First

Write these tests before implementing the service. Tests are split between unit tests (in-module, using temp dirs) and integration tests (in `backend/tests/ontology_sources_test.rs`, using `#[sqlx::test]`).

### Unit Tests (in `service.rs` module)

Place these in a `#[cfg(test)] mod tests { ... }` block at the bottom of `service.rs`. They use `tempfile::TempDir` to create filesystem fixtures and do not require a database.

**test_discover_valid_sources** -- Create a temp dir containing a `sources.json` with two active entries, each pointing to a subdirectory containing a valid `manifest.json`. Instantiate the service with a dummy pool (these tests only exercise filesystem logic, so the pool is unused -- use a compile-time stub or skip DB calls). Assert the result contains 2 sources, both with `available: true`, and that name/version/format fields match the manifests.

**test_discover_broken_symlink** -- Create a temp dir with `sources.json` referencing a path that does not exist (simulating a broken symlink). Assert the returned source has `available: false`.

**test_discover_missing_manifest** -- Create a temp dir where the source directory exists but contains no `manifest.json`. Assert the source is returned (available is based on directory existence) but metadata fields like `name` and `version` fall back to values from `sources.json` or are None.

**test_discover_missing_sources_json** -- Create an empty temp dir with no `sources.json` file. Call `discover_sources`. Assert it returns `Ok(vec![])` -- not an error.

**test_discover_inactive_source_excluded** -- Create `sources.json` with one entry having `"active": false`. Assert it is excluded from results.

**test_discover_timeout_on_slow_fs** -- This test is optional / best-effort. If implemented, it verifies that a source whose manifest read exceeds 500ms is marked unavailable. Can use a mock or skip in CI.

### Integration Tests (in `backend/tests/ontology_sources_test.rs`)

These use `#[sqlx::test]` which auto-provisions a PostgreSQL database with migrations applied.

**test_set_base_source** -- Insert a source row into `ontology_sources` via direct SQL (or call `sync_sources_to_db`). Call `set_active_sources(SetActiveInput { base: Some("src-1"), extension: None })`. Query the DB and assert `is_base = true` for `src-1`.

**test_set_base_clears_previous** -- Set `src-1` as base, then set `src-2` as base. Assert `src-1` no longer has `is_base = true` and `src-2` does.

**test_set_extension** -- Set base to `src-1` and extension to `src-2`. Assert both flags are set on the correct rows and no row has both flags.

**test_set_base_null_clears** -- Set a base, then call `set_active_sources(SetActiveInput { base: None, extension: None })`. Assert no row has `is_base = true`.

**test_get_active_empty** -- On a fresh database with no active sources, call `get_active_sources`. Assert both `base` and `extension` are `None`.

**test_sync_sources_upsert** -- Call `sync_sources_to_db` with two discovered sources. Call it again with the same sources (simulating re-discovery). Query the DB and assert there are exactly 2 rows (no duplicates), and `updated_at` was refreshed.

---

## Implementation Details

### Service Struct

The service holds a connection pool and the path to the data directory.

```rust
#[derive(Clone)]
pub struct OntologySourceService {
    pool: Pool<Postgres>,
    data_dir: PathBuf,
}
```

Constructor:

```rust
impl OntologySourceService {
    pub fn new(pool: Pool<Postgres>, data_dir: PathBuf) -> Self {
        Self { pool, data_dir }
    }
}
```

This follows the same pattern as `ApiManagementService` and `OntologyService` in the existing codebase, where the service is `Clone` (because `Pool<Postgres>` is an `Arc` internally) and is passed as Axum `State`.

### Error Enum

Define `SourceError` with `thiserror` and implement `IntoResponse` for Axum integration.

```rust
#[derive(Debug, thiserror::Error)]
pub enum SourceError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),
}
```

The `IntoResponse` impl maps each variant to an HTTP status code with a JSON error body:
- `IoError` -> 500
- `ParseError` -> 500
- `DatabaseError` -> 500
- `NotFound` -> 404
- `InvalidInput` -> 400

Follow the pattern from `OntologyError` in `backend/src/features/ontology/service.rs` which provides a `to_status_code()` method. For Axum, implement `IntoResponse` directly so handlers can return `Result<Json<T>, SourceError>`.

### Method: `discover_sources`

```rust
pub async fn discover_sources(&self) -> Result<Vec<SourceResponse>, SourceError>
```

Discovery algorithm:

1. Build the path `{self.data_dir}/sources.json`.
2. Attempt to read it with `tokio::fs::read_to_string`. If the file does not exist (ErrorKind::NotFound), return `Ok(vec![])` -- this is not an error.
3. Deserialize into `SourcesConfig` (defined in Section 02 models). On parse failure, return `SourceError::ParseError`.
4. Filter to entries where `active == true`.
5. For each active entry, resolve its path relative to `self.data_dir`.
6. Check directory existence using `tokio::fs::symlink_metadata` (not `metadata` -- this detects symlinks themselves rather than following them).
7. Determine availability: call `tokio::fs::read_link` on the path. If it is a symlink, check whether the target exists. If the target does not exist, mark `available: false`. If `read_link` fails with `InvalidInput` (meaning it is not a symlink, just a regular dir), mark `available: true`.
8. If available, attempt to read `manifest.json` from the source directory. Wrap the read in `tokio::time::timeout(Duration::from_millis(500))` to guard against hung NFS/network mounts. On timeout, mark unavailable.
9. Parse manifest into `SourceManifest`.
10. Query the `ontology_sources` table for import status (`imported_at`, `is_base`, `is_extension`) keyed by `source_id`.
11. Merge filesystem metadata with DB status into `SourceResponse` objects.
12. Call `sync_sources_to_db` to upsert discovered sources.
13. Return the combined list.

### Method: `get_active_sources`

```rust
pub async fn get_active_sources(&self) -> Result<ActiveSourcesResponse, SourceError>
```

Query the `ontology_sources` table for rows where `is_base = TRUE` or `is_extension = TRUE`. Map to `SourceResponse` and return as `ActiveSourcesResponse { base, extension }`. If no rows match, both fields are `None`.

SQL pattern:
```sql
SELECT * FROM ontology_sources WHERE is_base = TRUE OR is_extension = TRUE
```

### Method: `set_active_sources`

```rust
pub async fn set_active_sources(&self, input: SetActiveInput) -> Result<ActiveSourcesResponse, SourceError>
```

This method must use an `sqlx::Transaction` to atomically update flags:

1. Begin transaction.
2. Clear all `is_base` flags: `UPDATE ontology_sources SET is_base = FALSE WHERE is_base = TRUE`.
3. Clear all `is_extension` flags: `UPDATE ontology_sources SET is_extension = FALSE WHERE is_extension = TRUE`.
4. If `input.base` is `Some(source_id)`, set `is_base = TRUE` for that source_id. If the source_id does not exist in the table, return `SourceError::NotFound`.
5. If `input.extension` is `Some(source_id)`, set `is_extension = TRUE` for that source_id. If not found, return `SourceError::NotFound`.
6. Validate the same source_id is not set as both base and extension (return `SourceError::InvalidInput`). The DB CHECK constraint also enforces this, but checking in code gives a better error message.
7. Commit transaction.
8. Call `get_active_sources` to return the new state.

### Method: `sync_sources_to_db`

```rust
pub async fn sync_sources_to_db(&self, sources: Vec<DiscoveredSource>) -> Result<(), SourceError>
```

Note: `DiscoveredSource` is an internal struct (not an API type) that holds the merged filesystem + manifest data before DB enrichment. It can be defined in this file or in `models.rs`. It needs at minimum: `source_id`, `name`, `description`, `version`, `format`, `domain`, `path`, `stats`.

For each discovered source, execute an upsert:

```sql
INSERT INTO ontology_sources (source_id, name, description, version, format, domain, path, stats)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (source_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    format = EXCLUDED.format,
    domain = EXCLUDED.domain,
    path = EXCLUDED.path,
    stats = EXCLUDED.stats,
    updated_at = NOW()
```

This ensures re-discovery does not create duplicates while keeping metadata fresh.

### Crate Dependencies

The service requires these crates (verify they exist in `Cargo.toml` or add them):
- `tokio` with `fs`, `time` features (for async filesystem ops and timeout)
- `sqlx` with `postgres`, `runtime-tokio` features (already present)
- `thiserror` (for error derive)
- `serde_json` (already present)
- `chrono` with `serde` feature (already present)
- `tempfile` (dev-dependency, for unit tests)
- `tracing` (for logging, already present)

### Module Registration

The `mod.rs` for `ontology_sources` (created in Section 02) must include:

```rust
pub mod service;
```

And re-export:

```rust
pub use service::OntologySourceService;
pub use service::SourceError;
```