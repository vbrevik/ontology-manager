I have all the information needed. Let me write the section content.

# Section 05: Routes and Integration

## Overview

This section covers the final wiring of the import engine into the application: the Axum route handlers, the router factory function, merging with the existing ontology-sources routes in `main.rs`, registering the module in `features/mod.rs`, and updating `TestServices` in the test harness.

**Dependencies:** This section assumes section-02 (models: `ImportResult`, `UnloadResult`, `ImportParams`, `ImportError`) and section-04 (service: `ImportService`) are already implemented.

## Files to Create or Modify

| File | Action |
|------|--------|
| `backend/src/features/import_engine/routes.rs` | **Create** -- POST and DELETE handlers, router factory |
| `backend/src/features/import_engine/mod.rs` | **Create** -- module declarations and re-exports |
| `backend/src/features/mod.rs` | **Modify** -- add `pub mod import_engine;` |
| `backend/src/main.rs` | **Modify** -- create `ImportService`, merge import routes under `/api/ontology-sources` |
| `backend/tests/common/mod.rs` | **Modify** -- add `import_service` field to `TestServices`, create it in `setup_services()` |

## Tests

There are no dedicated unit tests for this section in the TDD plan. The route handlers are thin wrappers around `ImportService` methods. Their correctness is verified through the integration tests in section-06. However, the compilation and wiring are implicitly tested by any test that builds the full test app or calls import/unload endpoints.

The key verifiable outcomes for this section are:

- The project compiles after all changes.
- `cargo test` passes (no broken imports, no missing state types).
- `TestServices` includes an `import_service` field that is properly constructed.

## Implementation Details

### 1. Create `backend/src/features/import_engine/routes.rs`

This file defines two handler functions and one router factory. Follow the pattern established by `backend/src/features/ontology_sources/routes.rs`.

**Router factory signature:**

```rust
pub fn import_engine_routes() -> Router<ImportService> {
    Router::new()
        .route("/:id/import", post(import_source).delete(unload_source))
}
```

**Import handler signature:**

```rust
async fn import_source(
    State(svc): State<ImportService>,
    Path(source_id): Path<String>,
    Query(params): Query<ImportParams>,
) -> Result<Json<ImportResult>, ImportError>
```

The handler extracts `source_id` from the URL path and `params` (which contains an optional `role` field, defaulting to `"base"` if absent) from the query string. It calls `svc.import(source_id, role)` (or however the service method is named in section-04) and returns the result as JSON. Errors are returned as `ImportError`, which implements `IntoResponse` (defined in section-02).

**Unload handler signature:**

```rust
async fn unload_source(
    State(svc): State<ImportService>,
    Path(source_id): Path<String>,
) -> Result<Json<UnloadResult>, ImportError>
```

Calls `svc.unload(source_id)` and returns the result. No query params needed.

**Required imports:** `axum::{extract::{State, Path, Query}, routing::post, Json, Router}`, plus the models and service types from sibling modules.

### 2. Create `backend/src/features/import_engine/mod.rs`

Declare submodules and re-export public items. Follow the pattern of `backend/src/features/ontology_sources/mod.rs`:

```rust
pub mod adapters;
pub mod models;
pub mod routes;
pub mod service;

pub use routes::import_engine_routes;
pub use service::ImportService;
```

Add any additional re-exports that other sections have defined (e.g., `ImportError` from service or models, conflict module if separate).

### 3. Modify `backend/src/features/mod.rs`

Add a single line alongside the existing module declarations:

```rust
pub mod import_engine;
```

Current file location: `/Users/vidarbrevik/projects/ontology-manager/backend/src/features/mod.rs`. The line should be added in alphabetical order among the existing `pub mod` statements (between `pub mod firefighter;` and `pub mod navigation;`).

### 4. Modify `backend/src/main.rs` -- Service Creation and Route Merging

This is the most nuanced part. The existing ontology-sources routes use `Router<OntologySourceService>` and the new import routes use `Router<ImportService>`. These are **different State types** and cannot be nested directly under the same path with a single `.with_state()` call. The solution is to convert each to `Router<()>` by calling `.with_state(service)` on each, then merge them.

**Step A: Create the ImportService** (around line 154, after the `source_service` creation):

```rust
let import_service = features::import_engine::ImportService::new(
    pool.clone(),
    std::path::PathBuf::from(&config.ontology_data_dir),
);
```

**Step B: Replace the existing ontology-sources nest block.** The current code (around line 307-313) is:

```rust
.nest(
    "/ontology-sources",
    features::ontology_sources::ontology_sources_routes()
        .with_state(source_service)
        .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
        .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf)),
)
```

Replace it with a merged router that combines both sets of routes under the same `/ontology-sources` prefix:

```rust
.nest(
    "/ontology-sources",
    Router::new()
        .merge(
            features::ontology_sources::ontology_sources_routes()
                .with_state(source_service),
        )
        .merge(
            features::import_engine::import_engine_routes()
                .with_state(import_service),
        )
        .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
        .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf)),
)
```

The key insight: calling `.with_state(service)` on each typed router produces `Router<()>`. Merging two `Router<()>` values works seamlessly. The auth and CSRF middleware layers are then applied once to the combined `Router<()>`.

This results in the following effective routes:

- `GET /api/ontology-sources/` -- list sources (existing)
- `GET /api/ontology-sources/active` -- get active (existing)
- `PUT /api/ontology-sources/active` -- set active (existing)
- `POST /api/ontology-sources/:id/import` -- import source (new)
- `DELETE /api/ontology-sources/:id/import` -- unload source (new)

### 5. Modify `backend/tests/common/mod.rs` -- TestServices Update

**Step A: Add the import to the use block** (around line 6-20):

```rust
use template_repo_backend::features::import_engine::ImportService;
```

**Step B: Add the field to the `TestServices` struct** (around line 23-38):

```rust
pub import_service: ImportService,
```

**Step C: Create the service in `setup_services()`** (after the `source_service` creation around line 116-119):

```rust
let import_service = ImportService::new(
    pool.clone(),
    std::path::PathBuf::from("./test-data"),
);
```

**Step D: Add the field to the `TestServices` struct literal** (around line 121-136):

```rust
import_service,
```

**Step E (optional): Update `setup_test_app()`** if integration tests in section-06 will need to hit import routes via the full test router. Add the import routes merge under `/api/ontology-sources` following the same pattern as `main.rs`. If section-06 tests call the service directly (not via HTTP), this step can be deferred.

## ImportParams Model (for reference)

The `ImportParams` query struct is defined in section-02 (models). For the route handler to compile, it needs:

```rust
#[derive(Debug, Deserialize)]
pub struct ImportParams {
    pub role: Option<String>,  // "base" or "extension", defaults to "base"
}
```

## Error Response (for reference)

The `ImportError` enum is defined in section-02 (models). It must implement `IntoResponse` for Axum. The route handlers return `Result<Json<T>, ImportError>`, which Axum automatically converts to HTTP responses using the `IntoResponse` implementation.

## Checklist

1. Create `backend/src/features/import_engine/mod.rs` with module declarations and re-exports.
2. Create `backend/src/features/import_engine/routes.rs` with `import_engine_routes()`, `import_source`, and `unload_source`.
3. Add `pub mod import_engine;` to `backend/src/features/mod.rs`.
4. In `backend/src/main.rs`, create `ImportService` and merge import routes with ontology-sources routes under `/api/ontology-sources`.
5. In `backend/tests/common/mod.rs`, add `import_service` field to `TestServices` and construct it in `setup_services()`.
6. Verify the project compiles with `cargo check`.