# Research: Source Discovery API

## Codebase Research

### Feature Module Pattern
Standard structure: `mod.rs` → `models.rs` → `service.rs` → `routes.rs`

- **models.rs**: Three-tier — DB row models (`#[derive(FromRow)]`), response models (with JOINed fields), input models (plain `Deserialize`)
- **service.rs**: `#[derive(Clone)]` struct holding `Pool<Postgres>` + dependencies. Methods return `Result<T, FeatureError>`. Error enum with `thiserror` + `to_status_code()` method.
- **routes.rs**: Router factory function returning `Router<ServiceType>`. Handlers use `State(svc)`, `Extension(claims)`, `Path(id)`, `Json(input)`, `Query(params)` extractors.

### Route Registration (main.rs)
```rust
.nest("/ontology", ontology_routes()
    .with_state(ontology_service)
    .layer(middleware::auth::auth_middleware)
    .layer(middleware::csrf::validate_csrf))
```
All feature routes get auth + CSRF middleware.

### Database Schema — Ontology Tables
Key columns on `classes` table:
- `id UUID`, `name VARCHAR(255)`, `description TEXT`, `parent_class_id UUID`
- `version_id UUID` (FK to ontology_versions), `tenant_id UUID`
- `is_abstract BOOLEAN`, `is_deprecated BOOLEAN`
- Unique constraint: `(name, tenant_id, version_id)`
- **No `source_id` column yet** — this is what we'll add

`properties` table: `name`, `class_id`, `data_type`, `is_required`, `is_unique`, `is_sensitive`, `validation_rules JSONB`
- Unique constraint: `(name, class_id)`

`relationship_types` table: `name` (UNIQUE), `description`, `source_cardinality`, `target_cardinality`, `allowed_source_class_id`, `allowed_target_class_id`, `grants_permission_inheritance`

### Config Pattern
Uses `config` crate with env prefix "APP" + `config/default.toml`. `Config::from_env()` returns `Result<Config>`. Stored as `Arc<Config>` in app state.

### Test Pattern
`#[sqlx::test]` macro auto-provisions PostgreSQL test database. `TestServices` struct bundles all services. `setup_services(pool)` creates all services from a pool.

### Error Pattern
`thiserror` derive macro. Each feature has its own error enum. `IntoResponse` impl for HTTP error conversion with JSON body `{ "error": "...", "details": "..." }`.

## Web Research

### File System Reading
- Use `tokio::fs::read_to_string` for async file reads
- For batch reads, use `spawn_blocking` with `std::fs`
- Cache manifests in `AppState` or use `moka` cache for TTL-based caching
- Match `io::ErrorKind::NotFound` for clean 404 handling

### SQLx Nullable Column Migration
```sql
ALTER TABLE classes ADD COLUMN source_id TEXT;  -- nullable by default, no backfill needed
```
Map to `Option<String>` in Rust. Run `cargo sqlx prepare` after migration.

### Symlink Resolution
- `fs::symlink_metadata(path)` — doesn't follow symlink (catches broken ones)
- `fs::read_link(path)` — read symlink target
- `fs::canonicalize(path)` — resolve full path (errors on broken symlinks)
- Pattern: `symlink_metadata` → `read_link` → check `resolved.exists()` → `canonicalize`

### Serde for Varying Manifest Formats
- Use concrete structs per manifest format (not `untagged` enum — bad error messages)
- Use `#[serde(default)]` for optional fields across versions
- The `type` field in manifest.json can discriminate format without untagged enums

### AppState Pattern
```rust
#[derive(Clone)]
struct AppState {
    data_dir: PathBuf,
    db: Pool<Postgres>,
}
```
`PathBuf` and `Pool` are both `Clone`. For sub-state extraction, use `#[derive(FromRef)]`.
