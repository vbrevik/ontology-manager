# Implementation Plan: Source Discovery API

## Overview

The ontology-manager is a Rust/Axum web application with a PostgreSQL database that manages ontology data (classes, properties, relationships). Currently, all ontology data is seeded via SQL migrations. This plan adds the infrastructure for **external ontology data sources** — JSON files on disk that can be discovered, tracked, and managed via API.

This is the foundational split (01 of 04) in the "Runtime Ontology Switching" project. It provides:
1. Database schema changes to tag ontology entries by source
2. An `ontology_sources` table for tracking external sources
3. REST API endpoints for discovering and managing sources
4. Filesystem reader that parses `data/sources.json` and per-source `manifest.json` files

Splits 02-04 build on this: import engine (02), ontology browser (03), and source management UI (04).

## Architecture Context

### Existing Codebase Patterns

The ontology-manager backend follows a consistent feature module pattern:

```
backend/src/features/{feature_name}/
├── mod.rs       — module declaration, re-exports
├── models.rs    — DB row structs (#[derive(FromRow)]), input/response types
├── service.rs   — #[derive(Clone)] service with Pool<Postgres>, thiserror error enum
└── routes.rs    — Router factory function, async handlers with State/Extension extractors
```

Route registration in `main.rs`:
```rust
.nest("/api/ontology-sources",
    ontology_sources_routes()
        .with_state(source_service)
        .layer(auth_middleware)
        .layer(csrf_middleware))
```

Error handling: each feature defines its own error enum with `#[derive(thiserror::Error)]` and implements `IntoResponse` mapping to HTTP status codes with JSON error bodies.

Testing: `#[sqlx::test]` macro auto-provisions a PostgreSQL test database. `TestServices` struct in `tests/common/mod.rs` bundles all services.

### Directory Layout

```
backend/
├── src/features/ontology_sources/   — NEW: the feature module
│   ├── mod.rs
│   ├── models.rs
│   ├── service.rs
│   └── routes.rs
├── src/main.rs                      — ADD: route registration + service creation
├── src/config/mod.rs                — ADD: ONTOLOGY_DATA_DIR config field
├── migrations/
│   └── YYYYMMDD_ontology_sources.sql — NEW: schema changes
└── tests/
    └── ontology_sources_test.rs     — NEW: integration tests
```

## Section 1: Database Migration

### New Table: `ontology_sources`

Tracks all discovered and imported ontology data sources.

```sql
CREATE TABLE ontology_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT,
    format TEXT NOT NULL,          -- "json" or "json-schema"
    domain TEXT,
    path TEXT NOT NULL,            -- symlink path (not canonical, allows detecting broken links)
    is_base BOOLEAN NOT NULL DEFAULT FALSE,
    is_extension BOOLEAN NOT NULL DEFAULT FALSE,
    imported_at TIMESTAMPTZ,
    stats JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_not_both_base_and_extension CHECK (NOT (is_base AND is_extension))
);

-- At most one active base, at most one active extension
CREATE UNIQUE INDEX idx_ontology_sources_base ON ontology_sources (is_base) WHERE is_base = TRUE;
CREATE UNIQUE INDEX idx_ontology_sources_extension ON ontology_sources (is_extension) WHERE is_extension = TRUE;
```

This table is **global** (no `tenant_id`) — ontology sources are shared across all tenants.

Constraints:
- At most one row with `is_base = TRUE` (partial unique index)
- At most one row with `is_extension = TRUE` (partial unique index)
- A single source cannot be both base and extension (CHECK constraint)

### Column Additions

Add nullable `source_id TEXT` to three existing tables:
- `classes` — tag each class with its data source
- `properties` — tag each property
- `relationship_types` — tag each relationship type

Add indexes on `source_id` for all three tables (queries filtering by source will be common in splits 02-04).

Existing data (from SQL migration seeds) gets `NULL` source_id, meaning "built-in."

### Unique Constraint Updates

**Problem:** PostgreSQL treats each NULL as distinct in unique constraints. A simple composite `(name, ..., source_id)` would allow duplicate built-in entries (where source_id is NULL).

**Solution:** Use two partial unique indexes per table — one for built-in (NULL source_id), one for imported (non-NULL):

**`classes` table:**
- Drop existing constraint `unique_class_name_tenant_version`
- Add: `CREATE UNIQUE INDEX idx_classes_unique_builtin ON classes (name, tenant_id, version_id) WHERE source_id IS NULL;`
- Add: `CREATE UNIQUE INDEX idx_classes_unique_source ON classes (name, tenant_id, version_id, source_id) WHERE source_id IS NOT NULL;`

**`properties` table:**
- Drop existing constraint `unique_property_name_class`
- Add: `CREATE UNIQUE INDEX idx_properties_unique_builtin ON properties (name, class_id) WHERE source_id IS NULL;`
- Add: `CREATE UNIQUE INDEX idx_properties_unique_source ON properties (name, class_id, source_id) WHERE source_id IS NOT NULL;`

**`relationship_types` table:** — keep existing `UNIQUE (name)` for built-in, add source-aware index for imported.

**Migration approach:** Drop old constraints, add new partial indexes. Use `IF EXISTS` for idempotency.

### Version Integration

Each source import creates an entry in `ontology_versions`:
- `version` = `"{source_id}@{manifest_version}"` (e.g., `"mpcg-ontology@2.0.0"`)
- `is_system` = `FALSE` for imported (only built-in gets `TRUE`)
- Use `ON CONFLICT (version) DO UPDATE SET updated_at = NOW()` for re-imports
- Note: `version` column is `VARCHAR(50)` — source_id + version must fit within this limit
- This lets the existing versioning UI show imported sources alongside system versions

## Section 2: Models

### Database Row Model

```rust
struct OntologySource {
    id: Uuid,
    source_id: String,
    name: String,
    description: Option<String>,
    version: Option<String>,
    format: String,
    domain: Option<String>,
    path: String,
    is_base: bool,
    is_extension: bool,
    imported_at: Option<DateTime<Utc>>,
    stats: Option<serde_json::Value>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
```

### Filesystem Models (for parsing JSON files)

```rust
/// Parsed from data/sources.json
struct SourcesConfig {
    description: String,
    sources: Vec<SourceEntry>,
}

struct SourceEntry {
    id: String,
    path: String,
    description: String,
    active: bool,  // "include in discovery" — distinct from is_base/is_extension which mean "currently loaded"
}

/// Parsed from each source's manifest.json
struct SourceManifest {
    name: String,
    version: String,
    description: String,
    #[serde(rename = "type")]
    source_type: String,
    format: String,
    domain: Option<String>,
    files: HashMap<String, String>,  // role name → relative path
    stats: Option<serde_json::Value>,
}
```

### API Response Model

```rust
struct SourceResponse {
    id: String,
    name: String,
    description: Option<String>,
    version: Option<String>,
    format: String,
    domain: Option<String>,
    available: bool,        // false if symlink broken
    imported_at: Option<DateTime<Utc>>,
    is_base: bool,
    is_extension: bool,
    stats: Option<serde_json::Value>,
}

struct ActiveSourcesResponse {
    base: Option<SourceResponse>,
    extension: Option<SourceResponse>,
}

struct SetActiveInput {
    base: Option<String>,       // source_id
    extension: Option<String>,  // source_id, optional
}
```

## Section 3: Service

### OntologySourceService

A `#[derive(Clone)]` service holding `Pool<Postgres>` and `data_dir: PathBuf`.

Key methods:

```rust
/// Discover all sources from filesystem + merge with DB import status
async fn discover_sources(&self) -> Result<Vec<SourceResponse>, SourceError>

/// Get currently active base and extension
async fn get_active_sources(&self) -> Result<ActiveSourcesResponse, SourceError>

/// Set active base and optional extension (updates is_base/is_extension flags)
async fn set_active_sources(&self, input: SetActiveInput) -> Result<ActiveSourcesResponse, SourceError>

/// Sync discovered sources with ontology_sources table (upsert)
async fn sync_sources_to_db(&self, sources: Vec<DiscoveredSource>) -> Result<(), SourceError>
```

### Discovery Logic

1. Read `{data_dir}/sources.json` using `tokio::fs::read_to_string` — if file missing, return empty list (not an error)
2. Parse as `SourcesConfig`
3. For each entry where `active == true`, resolve path relative to data_dir
4. Check if directory exists using `tokio::fs::symlink_metadata` (catches broken symlinks)
5. If directory exists, read `manifest.json` from it — wrap in `tokio::time::timeout(Duration::from_millis(500))` per source to handle hung mounts
6. Cross-reference with `ontology_sources` table for import status
7. Sync discovered sources to DB (upsert)
8. Return combined list

### Symlink Handling

Use `symlink_metadata` (not `metadata`) to detect the symlink itself, then check if target exists. Pattern:
- `symlink_metadata` succeeds → path exists as symlink or real dir
- `read_link` → get target
- target `exists()` → if false, mark `available: false`
- `canonicalize` → resolve to absolute path (only if target exists)

### Error Enum

```rust
enum SourceError {
    IoError(std::io::Error),
    ParseError(String),
    DatabaseError(sqlx::Error),
    NotFound(String),
    InvalidInput(String),
}
```

Maps to HTTP: IoError → 500, ParseError → 500, DatabaseError → 500, NotFound → 404, InvalidInput → 400.

## Section 4: Routes

### Router Factory

```rust
fn ontology_sources_routes() -> Router<OntologySourceService> {
    Router::new()
        .route("/", get(list_sources))
        .route("/active", get(get_active).put(set_active))
}
```

Registered under `/api/ontology-sources` with auth + CSRF middleware.

### Handler Signatures

```rust
async fn list_sources(State(svc): State<OntologySourceService>) -> Result<Json<Vec<SourceResponse>>, SourceError>
async fn get_active(State(svc): State<OntologySourceService>) -> Result<Json<ActiveSourcesResponse>, SourceError>
async fn set_active(State(svc): State<OntologySourceService>, Json(input): Json<SetActiveInput>) -> Result<Json<ActiveSourcesResponse>, SourceError>
```

All handlers require JWT auth (applied at the route layer level via middleware).

## Section 5: Config and Integration Changes

Add `ontology_data_dir` to the `Config` struct:

```rust
#[serde(default = "default_data_dir")]
pub ontology_data_dir: String,
```

Default function returns `"./data"`. Also add to `config/default.toml`. Read from env var `APP_ONTOLOGY_DATA_DIR`.

Update `create_test_config()` in `tests/common/mod.rs` to include `ontology_data_dir` pointing to a temp test directory.

Add `pub mod ontology_sources;` to `backend/src/features/mod.rs`.

## Section 6: Main.rs Integration

In `main.rs`:
1. Create `OntologySourceService::new(pool.clone(), PathBuf::from(&config.ontology_data_dir))`
2. Register routes: `.nest("/api/ontology-sources", ontology_sources_routes().with_state(source_service).layer(auth).layer(csrf))`
3. Add `OntologySourceService` to `TestServices` struct in `tests/common/mod.rs`

The `set_active_sources` service method must wrap flag updates in an `sqlx::Transaction` — clear old `is_base`/`is_extension` flags then set new ones atomically.

## Section 7: Testing Strategy

### Unit Tests (in service.rs)

1. **Discovery with valid sources** — mock data dir with sources.json + manifest files, verify response
2. **Discovery with broken symlink** — source listed but target missing, verify `available: false`
3. **Discovery with missing manifest** — directory exists but no manifest.json
4. **Discovery with empty sources.json** — no sources configured

### Integration Tests (ontology_sources_test.rs)

Using `#[sqlx::test]`:

1. **GET /api/ontology-sources** — returns discovered sources
2. **GET /api/ontology-sources/active** — returns empty when no active source
3. **PUT /api/ontology-sources/active** — set a base source, verify flags
4. **PUT /api/ontology-sources/active with extension** — set base + extension, verify both flags
5. **PUT /api/ontology-sources/active swap** — change base, verify old base cleared
6. **Auth required** — request without JWT returns 401

### Migration Tests

1. **source_id column exists** — verify column added to classes, properties, relationship_types
2. **Existing data unaffected** — existing classes have NULL source_id
3. **New unique constraint** — same class name with different source_id succeeds
4. **Old unique constraint removed** — same class name with same source_id fails
