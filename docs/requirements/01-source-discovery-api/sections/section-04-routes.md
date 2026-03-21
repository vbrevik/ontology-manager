# Section 4: Routes

## Status: IMPLEMENTED

## Overview

This section implements the HTTP route layer for the ontology sources feature. It creates a router factory function `ontology_sources_routes()` that exposes three endpoints under `/api/ontology-sources`.

**Files created/modified:**
- CREATED: `backend/src/features/ontology_sources/routes.rs`
- MODIFIED: `backend/src/features/ontology_sources/mod.rs` (added `pub mod routes;` + re-export)

**Deviations from plan:**
- `IntoResponse` for `SourceError` kept in `service.rs` (section-03) rather than duplicated in `routes.rs` — plan allowed either location
- Route-level integration tests (6 tests) deferred to section-06 — they require test app wiring from section-05

## Dependencies

- **section-02-models** must be complete: `SourceResponse`, `ActiveSourcesResponse`, `SetActiveInput` types must exist in `models.rs`
- **section-03-service** must be complete: `OntologySourceService` and `SourceError` must exist in `service.rs`

## Tests First

The route-level tests live in the integration test file. They require a running test database, JWT authentication helpers, and a fully wired test app. Write these test stubs first (RED), then implement the routes to make them pass (GREEN).

**Test file:** `/Users/vidarbrevik/projects/ontology-manager/backend/tests/ontology_sources_test.rs`

These six tests cover the route layer specifically:

### test_get_sources_requires_auth

```rust
/// GET /api/ontology-sources without a JWT token must return 401 Unauthorized.
#[sqlx::test]
async fn test_get_sources_requires_auth(pool: PgPool) {
    // Build test app with ontology-sources routes registered
    // Send GET /api/ontology-sources with NO Authorization header
    // Assert status == 401
}
```

### test_get_sources_returns_list

```rust
/// GET /api/ontology-sources with a valid JWT returns 200 and a JSON array of SourceResponse.
#[sqlx::test]
async fn test_get_sources_returns_list(pool: PgPool) {
    // Build test app, create a valid JWT
    // Optionally seed a temp data dir with sources.json + manifest
    // Send GET /api/ontology-sources with Authorization header
    // Assert status == 200
    // Assert body deserializes as Vec<SourceResponse>
}
```

### test_get_active_returns_empty

```rust
/// GET /api/ontology-sources/active with no active sources returns 200 with null base/extension.
#[sqlx::test]
async fn test_get_active_returns_empty(pool: PgPool) {
    // Build test app, create a valid JWT
    // Send GET /api/ontology-sources/active
    // Assert status == 200
    // Assert body has base: null, extension: null
}
```

### test_put_active_sets_base

```rust
/// PUT /api/ontology-sources/active with a valid source_id sets the base source.
#[sqlx::test]
async fn test_put_active_sets_base(pool: PgPool) {
    // Build test app, create JWT
    // Insert a source row into ontology_sources table
    // Send PUT /api/ontology-sources/active with body {"base": "src-1"}
    // Assert status == 200
    // Assert response body has base.id == "src-1", base.is_base == true
}
```

### test_put_active_invalid_source

```rust
/// PUT /api/ontology-sources/active with a nonexistent source_id returns 404.
#[sqlx::test]
async fn test_put_active_invalid_source(pool: PgPool) {
    // Build test app, create JWT
    // Send PUT /api/ontology-sources/active with body {"base": "nonexistent"}
    // Assert status == 404
}
```

### test_put_active_requires_auth

```rust
/// PUT /api/ontology-sources/active without JWT returns 401.
#[sqlx::test]
async fn test_put_active_requires_auth(pool: PgPool) {
    // Build test app
    // Send PUT /api/ontology-sources/active with NO Authorization header
    // Assert status == 401
}
```

## Implementation Details

### Router Factory

Create a public function that returns an Axum `Router` parameterized on `OntologySourceService` as state. The router defines two route paths:

- `"/"` mapped to `GET` handler `list_sources`
- `"/active"` mapped to `GET` handler `get_active` and `PUT` handler `set_active`

The function signature:

```rust
pub fn ontology_sources_routes() -> Router<OntologySourceService>
```

This follows the exact same pattern used by every other feature in the codebase (e.g., `discovery_routes()`, `firefighter_routes()`, `api_management_routes()`).

### Handler Signatures

Three async handler functions, all private to the routes module:

```rust
async fn list_sources(
    State(svc): State<OntologySourceService>,
) -> Result<Json<Vec<SourceResponse>>, SourceError>
```

Calls `svc.discover_sources().await` and wraps the result in `Json`.

```rust
async fn get_active(
    State(svc): State<OntologySourceService>,
) -> Result<Json<ActiveSourcesResponse>, SourceError>
```

Calls `svc.get_active_sources().await` and wraps the result in `Json`.

```rust
async fn set_active(
    State(svc): State<OntologySourceService>,
    Json(input): Json<SetActiveInput>,
) -> Result<Json<ActiveSourcesResponse>, SourceError>
```

Calls `svc.set_active_sources(input).await` and wraps the result in `Json`.

All handlers delegate entirely to the service layer. There is no business logic in the route handlers themselves.

### IntoResponse for SourceError

The `SourceError` enum (defined in section-03-service's `service.rs`) needs an `IntoResponse` implementation. This can live either in `routes.rs` or `service.rs` -- the codebase has precedent for putting it in `routes.rs` (see `firefighter/routes.rs`). Place it in `routes.rs`.

The mapping:

| SourceError variant | HTTP Status | JSON body |
|---|---|---|
| `IoError(e)` | 500 Internal Server Error | `{"error": e.to_string()}` |
| `ParseError(msg)` | 500 Internal Server Error | `{"error": msg}` |
| `DatabaseError(e)` | 500 Internal Server Error | `{"error": e.to_string()}` |
| `NotFound(msg)` | 404 Not Found | `{"error": msg}` |
| `InvalidInput(msg)` | 400 Bad Request | `{"error": msg}` |

The implementation pattern (matching the codebase convention from `firefighter/routes.rs`):

```rust
impl axum::response::IntoResponse for SourceError {
    fn into_response(self) -> axum::response::Response {
        let (status, error_message) = match self {
            // Map each variant to (StatusCode, String)
        };
        let body = Json(serde_json::json!({ "error": error_message }));
        (status, body).into_response()
    }
}
```

### Required Imports

The routes module needs these imports:

- `axum::{extract::State, routing::{get, put}, Json, Router, http::StatusCode}`
- `super::models::{SourceResponse, ActiveSourcesResponse, SetActiveInput}`
- `super::service::{OntologySourceService, SourceError}`

### Module Declaration

Add `pub mod routes;` to `/Users/vidarbrevik/projects/ontology-manager/backend/src/features/ontology_sources/mod.rs`. The mod.rs file should already have `pub mod models;` and `pub mod service;` from sections 02 and 03. After this section, it should contain all three:

```rust
pub mod models;
pub mod service;
pub mod routes;
```

### Authentication

JWT authentication is NOT applied inside the router factory. It is applied externally when the routes are nested in `main.rs` (handled by section-05-config-integration):

```rust
.nest(
    "/api/ontology-sources",
    ontology_sources_routes()
        .with_state(source_service)
        .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
        .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf)),
)
```

This is the standard pattern used by all other features in the codebase. The route tests that verify auth (tests 18 and 23 above) depend on the full test app being wired with this middleware, which is why they are integration tests rather than unit tests.

### Test App Setup

The route integration tests need the test app to include the ontology sources routes. This requires updating `setup_test_app()` in `/Users/vidarbrevik/projects/ontology-manager/backend/tests/common/mod.rs` to nest the ontology sources routes (covered in section-05-config-integration). For the route tests to pass, section 05 must also be complete.

To run route tests in isolation before section 05 is done, you can create a local helper in the test file that builds a minimal router with just the ontology sources routes and auth middleware wired up, using a temp directory for the data dir.