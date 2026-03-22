# Section 5: Config and Integration

## Status: IMPLEMENTED

## Overview

This section wires the new `ontology_sources` feature module into the existing application. It covers four integration points:

1. Adding `ontology_data_dir` to the `Config` struct and `config/default.toml`
2. Registering `pub mod ontology_sources` in the features module declaration (done in section-03)
3. Creating the `OntologySourceService` and nesting its routes in `main.rs`
4. Updating `TestServices` and `create_test_config()` in the test harness

**Files modified:**
- `backend/src/config/mod.rs` — added `ontology_data_dir` field + `default_data_dir()` fn
- `backend/config/default.toml` — added `ontology_data_dir = "./data"`
- `backend/src/main.rs` — created service, nested routes under `/ontology-sources`
- `backend/tests/common/mod.rs` — added `source_service` to TestServices, updated config
- `backend/tests/jwt_helpers.rs` — added `ontology_data_dir` to Config literal

**Deviations from plan:**
- `pub mod ontology_sources` was added to `features/mod.rs` in section-03, not this section
- Config tests (test_config_default_data_dir, test_config_custom_data_dir) deferred to section-06
- `setup_test_app()` not updated with ontology-sources routes (route integration tests in section-06)

## Tests First

These tests verify the config and integration wiring. They belong in `backend/tests/ontology_sources_test.rs` or inline unit tests.

### test_config_default_data_dir

Verify that when no `ontology_data_dir` is explicitly set, the `Config` struct defaults to `"./data"`.

```rust
#[test]
fn test_config_default_data_dir() {
    // Deserialize a Config from a TOML string that omits ontology_data_dir.
    // Assert that config.ontology_data_dir == "./data"
}
```

### test_config_custom_data_dir

Verify that the `APP_ONTOLOGY_DATA_DIR` environment variable overrides the default.

```rust
#[test]
fn test_config_custom_data_dir() {
    // Set APP_ONTOLOGY_DATA_DIR to "/tmp/custom-sources"
    // Build Config via Config::from_env() or equivalent
    // Assert config.ontology_data_dir == "/tmp/custom-sources"
}
```

### test_service_in_test_services

Verify that `setup_services(pool)` returns a `TestServices` struct that includes a `source_service` field.

```rust
#[sqlx::test]
async fn test_service_in_test_services(pool: PgPool) {
    let services = setup_services(pool).await;
    // Access services.source_service — this is a compile-time check.
    // Optionally call a method to confirm it's functional.
    let _ = &services.source_service;
}
```

## Implementation Details

### 1. Add `ontology_data_dir` to the Config struct

**File:** `/Users/vidarbrevik/projects/ontology-manager/backend/src/config/mod.rs`

The existing `Config` struct has these fields: `database_url`, `jwt_secret`, `jwt_expiry`, `refresh_token_expiry`, `jwt_private_key`, `jwt_public_key`.

Add a new field with a serde default:

```rust
#[serde(default = "default_data_dir")]
pub ontology_data_dir: String,
```

Add the default function in the same file:

```rust
fn default_data_dir() -> String {
    "./data".to_string()
}
```

The `config` crate (already used) reads from `config/default.toml` first, then overlays environment variables prefixed with `APP_`. So `APP_ONTOLOGY_DATA_DIR` will automatically map to `ontology_data_dir`.

### 2. Add to config/default.toml

**File:** `/Users/vidarbrevik/projects/ontology-manager/backend/config/default.toml`

Add this line (at the top level, alongside the existing `database_url`, `jwt_secret`, etc.):

```toml
ontology_data_dir = "./data"
```

The existing file content is:

```toml
database_url = "postgres://app:change_me@localhost:5301/app_db"
jwt_secret = "your-secret-key-here-change-in-production"
jwt_expiry = 3600
refresh_token_expiry = 86400
jwt_private_key = ""
jwt_public_key = ""

[server]
port = 5300
```

Add `ontology_data_dir = "./data"` after the `jwt_public_key` line (before the `[server]` section).

### 3. Register the feature module

**File:** `/Users/vidarbrevik/projects/ontology-manager/backend/src/features/mod.rs`

Add this line to the existing module declarations:

```rust
pub mod ontology_sources;
```

The existing file declares modules: `abac`, `ai`, `api_management`, `auth`, `dashboard`, `discovery`, `firefighter`, `navigation`, `ontology`, `projects`, `rate_limit`, `rebac`, `system`, `users`, `test_marker`, `test_mode`. Add `ontology_sources` in alphabetical position (after `navigation`, before `ontology`).

### 4. Create the service and register routes in main.rs

**File:** `/Users/vidarbrevik/projects/ontology-manager/backend/src/main.rs`

Two changes are needed:

**a) Create the OntologySourceService** after the pool is established (around line 146, after the existing service creations):

```rust
let source_service = features::ontology_sources::OntologySourceService::new(
    pool.clone(),
    std::path::PathBuf::from(&config.ontology_data_dir),
);
```

**b) Nest the routes** in the `api_router` builder (add a new `.nest(...)` block following the pattern of existing feature routes):

```rust
.nest(
    "/ontology-sources",
    features::ontology_sources::routes::ontology_sources_routes()
        .with_state(source_service.clone())
        .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
        .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf)),
)
```

This follows the exact same pattern as every other feature route registration (e.g., `/ontology`, `/rebac`, `/users`). The routes require JWT auth and CSRF validation.

Add `use std::path::PathBuf;` to the imports at the top of `main.rs` if not already present.

### 5. Update TestServices and setup_services

**File:** `/Users/vidarbrevik/projects/ontology-manager/backend/tests/common/mod.rs`

**a) Add the import:**

```rust
use template_repo_backend::features::ontology_sources::OntologySourceService;
```

**b) Add the field to `TestServices`:**

```rust
pub struct TestServices {
    // ... existing fields ...
    pub source_service: OntologySourceService,
}
```

**c) Create the service in `setup_services()`:**

Inside the `setup_services` function, before the `TestServices` struct construction, create the service using a temp directory:

```rust
// Ontology Source Service (uses temp dir for tests)
let source_service = OntologySourceService::new(
    pool.clone(),
    std::path::PathBuf::from("./test-data"),
);
```

Then include `source_service` in the returned `TestServices` struct literal.

**d) Update `create_test_config()`:**

Add the new field to the `Config` literal:

```rust
pub fn create_test_config() -> Config {
    Config {
        // ... existing fields ...
        ontology_data_dir: "./test-data".to_string(),
    }
}
```

### 6. Optionally update setup_test_app

**File:** `/Users/vidarbrevik/projects/ontology-manager/backend/tests/common/mod.rs`

The `setup_test_app` function builds a `Router` for integration tests. Add the ontology-sources routes to it, following the same pattern as the other nested routes:

```rust
.nest(
    "/ontology-sources",
    features::ontology_sources::routes::ontology_sources_routes()
        .with_state(services.source_service.clone())
        .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
        .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf)),
)
```

## File Summary

| File | Action |
|------|--------|
| `/Users/vidarbrevik/projects/ontology-manager/backend/src/config/mod.rs` | Add `ontology_data_dir` field + `default_data_dir()` fn |
| `/Users/vidarbrevik/projects/ontology-manager/backend/config/default.toml` | Add `ontology_data_dir = "./data"` |
| `/Users/vidarbrevik/projects/ontology-manager/backend/src/features/mod.rs` | Add `pub mod ontology_sources;` |
| `/Users/vidarbrevik/projects/ontology-manager/backend/src/main.rs` | Create `OntologySourceService`, nest routes under `/ontology-sources` |
| `/Users/vidarbrevik/projects/ontology-manager/backend/tests/common/mod.rs` | Add `source_service` to `TestServices`, update `setup_services()`, update `create_test_config()`, update `setup_test_app()` |

## Checklist

- [ ] Add `ontology_data_dir` field with `#[serde(default = "default_data_dir")]` to `Config` struct
- [ ] Add `default_data_dir()` function returning `"./data".to_string()`
- [ ] Add `ontology_data_dir = "./data"` to `config/default.toml`
- [ ] Add `pub mod ontology_sources;` to `features/mod.rs`
- [ ] Create `OntologySourceService` in `main.rs` using `config.ontology_data_dir`
- [ ] Nest ontology-sources routes under `/ontology-sources` in `api_router` with auth + CSRF middleware
- [ ] Add `OntologySourceService` import and `source_service` field to `TestServices`
- [ ] Create `source_service` in `setup_services()` function
- [ ] Add `ontology_data_dir` to `create_test_config()` return value
- [ ] Add ontology-sources routes to `setup_test_app()`
- [ ] Write and verify `test_config_default_data_dir` passes
- [ ] Write and verify `test_config_custom_data_dir` passes
- [ ] Write and verify `test_service_in_test_services` passes