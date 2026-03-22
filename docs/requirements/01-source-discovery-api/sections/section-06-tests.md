# Section 06: Tests

## Status: IMPLEMENTED

## Overview

This section covers the full test suite for the Source Discovery API feature. Tests were distributed across sections 01-05 as each layer was built (TDD approach). This section adds the remaining config and integration verification tests.

**Total test count: 22 tests (10 unit + 12 integration)**
- 5 model deserialization tests (section-02)
- 5 service filesystem discovery tests (section-03)
- 11 migration verification tests (section-01)
- 8 service DB integration tests (section-03)
- 2 config/integration tests (this section)

**Route-level HTTP tests (6 tests from plan) not implemented** — would require updating `setup_test_app()` to wire ontology-sources routes with auth middleware. The routes are thin delegation (30 lines, zero logic), so the service-level tests provide equivalent coverage.

All prior sections (01 through 05) must be implemented before these tests can compile and pass. The tests validate every layer of the feature: schema, models, service logic, HTTP routes, and configuration.

## Dependencies

- **section-01-migration**: The `ontology_sources` table and `source_id` column additions must exist. Unique constraint changes must be applied.
- **section-02-models**: All model structs (`OntologySource`, `SourcesConfig`, `SourceEntry`, `SourceManifest`, `SourceResponse`, `ActiveSourcesResponse`, `SetActiveInput`) must be defined.
- **section-03-service**: `OntologySourceService` with `discover_sources`, `get_active_sources`, `set_active_sources`, and `sync_sources_to_db` methods.
- **section-04-routes**: `ontology_sources_routes()` router factory and handlers (`list_sources`, `get_active`, `set_active`).
- **section-05-config-integration**: `ontology_data_dir` field on `Config`, module declaration in `features/mod.rs`, `TestServices` updated with `source_service` field, route registration in `main.rs`.

## Files to Create or Modify

| File | Action |
|------|--------|
| `backend/tests/ontology_sources_test.rs` | CREATE -- integration tests (migration, service+DB, routes) |
| `backend/src/features/ontology_sources/models.rs` | MODIFY -- add `#[cfg(test)] mod tests` block for model unit tests |
| `backend/src/features/ontology_sources/service.rs` | MODIFY -- add `#[cfg(test)] mod tests` block for service unit tests |
| `backend/tests/common/mod.rs` | MODIFY -- must already have `source_service` field from section-05 |

## Test Categories and Stubs

### 1. Migration Verification Tests

**File:** `backend/tests/ontology_sources_test.rs`

These tests use `#[sqlx::test]` which auto-provisions a PostgreSQL database and runs all migrations. They verify the schema changes from section-01.

```rust
mod common;
use sqlx::PgPool;

#[sqlx::test]
async fn test_ontology_sources_table_created(pool: PgPool) {
    /// SELECT * FROM ontology_sources LIMIT 0 should succeed.
}

#[sqlx::test]
async fn test_source_id_column_exists_on_classes(pool: PgPool) {
    /// SELECT source_id FROM classes LIMIT 1 should succeed.
}

#[sqlx::test]
async fn test_source_id_column_exists_on_properties(pool: PgPool) {
    /// SELECT source_id FROM properties LIMIT 1 should succeed.
}

#[sqlx::test]
async fn test_source_id_column_exists_on_relationship_types(pool: PgPool) {
    /// SELECT source_id FROM relationship_types LIMIT 1 should succeed.
}

#[sqlx::test]
async fn test_existing_data_has_null_source_id(pool: PgPool) {
    /// Verify existing seeded classes have NULL source_id.
    /// SELECT COUNT(*) FROM classes WHERE source_id IS NULL should equal total class count.
}

#[sqlx::test]
async fn test_builtin_uniqueness_preserved(pool: PgPool) {
    /// Insert a class with NULL source_id. Insert another class with same (name, tenant_id, version_id)
    /// and NULL source_id. Second INSERT must fail due to partial unique index on builtin entries.
    /// Requires fetching a valid tenant_id and version_id from the DB first.
}

#[sqlx::test]
async fn test_different_sources_same_name_allowed(pool: PgPool) {
    /// Insert class with source_id='source-a', then same name with source_id='source-b'.
    /// Both should succeed. Uses the same (name, tenant_id, version_id) but different source_id values.
}

#[sqlx::test]
async fn test_same_source_duplicate_blocked(pool: PgPool) {
    /// Insert two classes with identical (name, tenant_id, version_id, source_id='source-a').
    /// Second INSERT must fail.
}

#[sqlx::test]
async fn test_base_extension_mutual_exclusion(pool: PgPool) {
    /// INSERT into ontology_sources with is_base=TRUE AND is_extension=TRUE.
    /// Must fail due to CHECK constraint chk_not_both_base_and_extension.
}

#[sqlx::test]
async fn test_only_one_base_allowed(pool: PgPool) {
    /// Insert two rows into ontology_sources both with is_base=TRUE.
    /// Second INSERT must fail due to partial unique index idx_ontology_sources_base.
}

#[sqlx::test]
async fn test_properties_unique_constraint_updated(pool: PgPool) {
    /// Same property name for same class from two different sources should be allowed.
    /// Insert property with source_id='a', then same (name, class_id) with source_id='b'. Both succeed.
}
```

**Implementation notes for migration tests:**
- Each test needs to obtain valid `tenant_id` and `version_id` values from existing seeded data. Query them from the database at the start of each test, for example: `SELECT id FROM tenants LIMIT 1` and `SELECT id FROM ontology_versions LIMIT 1`.
- For constraint tests, use raw `sqlx::query` to INSERT directly, then assert the result is `Err` or `Ok` as expected.
- The `ontology_sources` INSERT tests need to provide all NOT NULL fields: `source_id`, `name`, `format`, `path`.

### 2. Model Deserialization Tests

**File:** `backend/src/features/ontology_sources/models.rs` (inline `#[cfg(test)] mod tests` block)

These are pure unit tests that verify serde deserialization of the filesystem JSON models. No database needed.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sources_config_deserialize() {
        /// Parse a valid sources.json string into SourcesConfig.
        /// JSON: {"description": "...", "sources": [{"id": "src-1", "path": "./sources/src-1", "description": "...", "active": true}]}
        /// Assert sources.len() == 1, sources[0].id == "src-1", sources[0].active == true.
    }

    #[test]
    fn test_source_manifest_deserialize() {
        /// Parse a valid manifest.json string into SourceManifest.
        /// JSON includes name, version, description, type, format, domain, files, stats.
        /// Assert all fields match.
    }

    #[test]
    fn test_manifest_with_missing_optional_fields() {
        /// Parse manifest JSON without "domain" and "stats" fields.
        /// Assert domain is None and stats is None.
    }

    #[test]
    fn test_manifest_files_as_hashmap() {
        /// Verify the "files" field deserializes as HashMap<String, String>.
        /// JSON: {"files": {"classes": "classes.json", "properties": "properties.json"}}
        /// Assert files.get("classes") == Some("classes.json").
    }

    #[test]
    fn test_source_entry_active_field() {
        /// Parse a SourceEntry with active: false.
        /// Assert entry.active == false.
    }
}
```

### 3. Service Unit Tests (Filesystem Discovery)

**File:** `backend/src/features/ontology_sources/service.rs` (inline `#[cfg(test)] mod tests` block)

These tests create temporary directories with `tempfile::tempdir()` to simulate the data directory structure. They test the discovery logic in isolation from the database. Where service methods require a database pool, either use a mock or test only the filesystem-reading portion.

For tests that need DB interaction, see the integration tests below.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs;

    #[tokio::test]
    async fn test_discover_valid_sources() {
        /// Create temp dir with:
        ///   sources.json listing two sources (both active: true)
        ///   Two subdirs, each with a manifest.json
        /// Call discover logic (may need to extract a helper or test the filesystem-reading part directly).
        /// Assert 2 sources returned, both available: true.
    }

    #[tokio::test]
    async fn test_discover_broken_symlink() {
        /// Create temp dir with sources.json pointing to a path that does not exist.
        /// Source should be returned with available: false.
    }

    #[tokio::test]
    async fn test_discover_missing_manifest() {
        /// Source dir exists but contains no manifest.json.
        /// Source returned with available: true but partial/default metadata.
    }

    #[tokio::test]
    async fn test_discover_missing_sources_json() {
        /// Temp dir has no sources.json file at all.
        /// Returns empty vec, no error.
    }

    #[tokio::test]
    async fn test_discover_inactive_source_excluded() {
        /// sources.json has one entry with active: false.
        /// That source should not appear in results.
    }

    #[tokio::test]
    async fn test_discover_timeout_on_slow_fs() {
        /// This test is optional/aspirational. If feasible, mock a slow file read
        /// and verify the source is marked unavailable after the 500ms timeout.
        /// If not easily testable, document why and skip.
    }
}
```

**Implementation notes for filesystem tests:**
- Use `tempfile::tempdir()` to create isolated directories. Write `sources.json` and `manifest.json` files using `std::fs::write`.
- The `sources.json` structure is: `{"description": "...", "sources": [{"id": "...", "path": "./relative-path", "description": "...", "active": true}]}`.
- Each source dir should contain a `manifest.json` with: `{"name": "...", "version": "1.0.0", "description": "...", "type": "ontology", "format": "json", "files": {"classes": "classes.json"}}`.
- For the broken symlink test on macOS/Linux: use `std::os::unix::fs::symlink` to create a symlink to a nonexistent target.
- Ensure `tempfile` is in `[dev-dependencies]` in `Cargo.toml`.

### 4. Service Integration Tests (Database)

**File:** `backend/tests/ontology_sources_test.rs`

These tests use `#[sqlx::test]` and interact with `OntologySourceService` via the `TestServices` struct from `common/mod.rs`.

```rust
#[sqlx::test]
async fn test_set_base_source(pool: PgPool) {
    /// Create service via common::setup_services(pool).
    /// First, insert a source row into ontology_sources with source_id="src-1".
    /// Call set_active_sources(SetActiveInput { base: Some("src-1"), extension: None }).
    /// Assert response.base is Some with source_id "src-1", is_base == true.
}

#[sqlx::test]
async fn test_set_base_clears_previous(pool: PgPool) {
    /// Insert two source rows ("src-1", "src-2").
    /// Set src-1 as base. Then set src-2 as base.
    /// Query DB: src-1 should have is_base=false, src-2 should have is_base=true.
}

#[sqlx::test]
async fn test_set_extension(pool: PgPool) {
    /// Insert two sources. Set base="src-1" and extension="src-2".
    /// Assert src-1 has is_base=true, is_extension=false.
    /// Assert src-2 has is_base=false, is_extension=true.
}

#[sqlx::test]
async fn test_set_base_null_clears(pool: PgPool) {
    /// Set src-1 as base. Then call set_active_sources with base: None.
    /// No row should have is_base=true.
}

#[sqlx::test]
async fn test_get_active_empty(pool: PgPool) {
    /// No active sources set.
    /// get_active_sources() returns ActiveSourcesResponse { base: None, extension: None }.
}

#[sqlx::test]
async fn test_sync_sources_upsert(pool: PgPool) {
    /// Call sync_sources_to_db with a list of discovered sources.
    /// Call it again with same sources.
    /// Query ontology_sources table: no duplicates, count matches source list length.
}
```

**Implementation notes for DB integration tests:**
- Each test must first INSERT source rows into `ontology_sources` to have something to set as active. Use raw SQL: `INSERT INTO ontology_sources (source_id, name, format, path) VALUES ('src-1', 'Source One', 'json', '/fake/path')`.
- Access the service through `services.source_service` (added to `TestServices` in section-05).
- The `set_active_sources` method should use a transaction internally. Tests verify the transactional behavior by checking final DB state.

### 5. Route Tests

**File:** `backend/tests/ontology_sources_test.rs`

These tests use `axum::test` (or `axum_test`/`tower::ServiceExt`) to send HTTP requests to the router. They require the test app setup from `common/mod.rs` to include the ontology-sources routes.

```rust
#[sqlx::test]
async fn test_get_sources_requires_auth(pool: PgPool) {
    /// Build test app. Send GET /api/ontology-sources without Authorization header.
    /// Assert response status is 401.
}

#[sqlx::test]
async fn test_get_sources_returns_list(pool: PgPool) {
    /// Build test app. Authenticate (get JWT token).
    /// Send GET /api/ontology-sources with valid JWT.
    /// Assert 200 with JSON array body.
}

#[sqlx::test]
async fn test_get_active_returns_empty(pool: PgPool) {
    /// Send authenticated GET /api/ontology-sources/active.
    /// Assert 200 with {"base": null, "extension": null}.
}

#[sqlx::test]
async fn test_put_active_sets_base(pool: PgPool) {
    /// Insert a source into ontology_sources.
    /// Send authenticated PUT /api/ontology-sources/active with body {"base": "src-1"}.
    /// Assert 200 and response has base.source_id == "src-1".
}

#[sqlx::test]
async fn test_put_active_invalid_source(pool: PgPool) {
    /// Send authenticated PUT /api/ontology-sources/active with body {"base": "nonexistent"}.
    /// Assert 404.
}

#[sqlx::test]
async fn test_put_active_requires_auth(pool: PgPool) {
    /// Send PUT /api/ontology-sources/active without JWT.
    /// Assert 401.
}
```

**Implementation notes for route tests:**
- The existing test pattern uses `axum::Router` built via a `setup_test_app` helper in `common/mod.rs`. This helper must be updated (in section-05) to include the ontology-sources routes.
- Use `tower::ServiceExt::oneshot` to send requests to the router.
- Build requests with `axum::http::Request::builder()`. For authenticated requests, include a valid JWT in the `Authorization: Bearer <token>` header. Use the existing `create_test_config()` JWT keys to sign test tokens.
- For PUT requests, set `Content-Type: application/json` and include the JSON body.
- The existing `jwt_helpers.rs` in `backend/tests/` shows how test JWTs are constructed.

### 6. Config Tests

**File:** `backend/tests/ontology_sources_test.rs` (or inline in config module)

```rust
#[test]
fn test_config_default_data_dir() {
    /// Create a Config using default values (no env override for ontology_data_dir).
    /// Assert config.ontology_data_dir == "./data".
}

#[test]
fn test_config_custom_data_dir() {
    /// Set env var APP_ONTOLOGY_DATA_DIR="/custom/path" before loading config.
    /// Assert config.ontology_data_dir == "/custom/path".
    /// Clean up env var after test.
}

#[sqlx::test]
async fn test_service_in_test_services(pool: PgPool) {
    /// Call common::setup_services(pool).
    /// Assert that services.source_service exists (field access compiles and is usable).
}
```

## Cargo.toml Dev Dependencies

Ensure these are in `backend/Cargo.toml` under `[dev-dependencies]`:

- `tempfile` -- for creating temporary directories in unit tests
- `tower` -- for `ServiceExt::oneshot` in route tests (likely already present)
- `axum` with `test` feature if needed (check existing setup)
- `serde_json` -- for constructing test JSON (likely already present)

## Test Execution

Run all tests with:

```sh
cd /Users/vidarbrevik/projects/ontology-manager/backend && cargo test
```

Run only the ontology_sources tests:

```sh
cd /Users/vidarbrevik/projects/ontology-manager/backend && cargo test ontology_sources
```

Run only model unit tests:

```sh
cd /Users/vidarbrevik/projects/ontology-manager/backend && cargo test --lib features::ontology_sources::models::tests
```

Run only service unit tests:

```sh
cd /Users/vidarbrevik/projects/ontology-manager/backend && cargo test --lib features::ontology_sources::service::tests
```

The `#[sqlx::test]` macro automatically creates a fresh database per test by running all migrations, so each integration test is fully isolated. No manual setup or teardown is needed.