Now I have enough context. Let me generate the section content.

# Section 2: Models

## Overview

This section defines all Rust data models for the `ontology_sources` feature module. There are three categories of models:

1. **Database row model** (`OntologySource`) -- maps directly to the `ontology_sources` table created in Section 1
2. **Filesystem models** (`SourcesConfig`, `SourceEntry`, `SourceManifest`) -- for deserializing `data/sources.json` and per-source `manifest.json` files from disk
3. **API types** (`SourceResponse`, `ActiveSourcesResponse`, `SetActiveInput`) -- request/response shapes for the REST endpoints

All models live in a single file: `backend/src/features/ontology_sources/models.rs`, with the module declared in `backend/src/features/ontology_sources/mod.rs`.

## Dependencies

- **Section 1 (Migration):** The `OntologySource` struct maps to the `ontology_sources` table. The migration must exist before integration tests can run against this model.
- No runtime dependency on other sections; these are pure data structures.

## Files to Create

- `backend/src/features/ontology_sources/mod.rs`
- `backend/src/features/ontology_sources/models.rs`

## Tests First

Write these tests in a `#[cfg(test)] mod tests` block at the bottom of `backend/src/features/ontology_sources/models.rs`. All five are pure unit tests (no database, no async) that verify serde deserialization of the filesystem models.

### test_sources_config_deserialize

Parse a valid `sources.json` string into `SourcesConfig`. The JSON should contain a `description` field and a `sources` array with at least one entry. Assert that `description` and `sources.len()` match expectations, and that each `SourceEntry` has the correct `id`, `path`, `description`, and `active` values.

Sample input JSON:

```json
{
  "description": "Available ontology data sources",
  "sources": [
    {
      "id": "mpcg-ontology",
      "path": "./mpcg-ontology",
      "description": "MPCG base ontology",
      "active": true
    }
  ]
}
```

### test_source_manifest_deserialize

Parse a valid `manifest.json` string into `SourceManifest`. The JSON should include all required fields: `name`, `version`, `description`, `type` (maps to `source_type` via `#[serde(rename)]`), `format`, and `files`. Also include optional `domain` and `stats`. Assert all fields match.

Sample input JSON:

```json
{
  "name": "MPCG Ontology",
  "version": "2.0.0",
  "description": "Military Planning and Command ontology",
  "type": "base",
  "format": "json",
  "domain": "military",
  "files": {
    "classes": "classes.json",
    "properties": "properties.json",
    "relationships": "relationships.json"
  },
  "stats": { "classes": 42, "properties": 128 }
}
```

### test_manifest_with_missing_optional_fields

Parse a manifest JSON string that omits `domain` and `stats`. Assert that `domain` is `None` and `stats` is `None`, and that the remaining required fields are correctly populated.

### test_manifest_files_as_hashmap

Parse a manifest and verify the `files` field is a `HashMap<String, String>`. Check that it contains specific keys (e.g., `"classes"`, `"properties"`) and that the values are the expected relative paths.

### test_source_entry_active_field

Parse a `SourcesConfig` with two entries where one has `active: true` and the other `active: false`. Filter the parsed `sources` by `active` and assert the counts are correct (1 active, 1 inactive).

## Implementation Details

### Module Declaration: `mod.rs`

Create `backend/src/features/ontology_sources/mod.rs` with:

```rust
pub mod models;
```

The `service` and `routes` submodules will be added by later sections (03 and 04).

### Models File: `models.rs`

Create `backend/src/features/ontology_sources/models.rs` with the following structures. The file follows the same pattern as other feature models in the codebase (e.g., `backend/src/features/ontology/models.rs`): imports at the top, derives for Debug/Clone/Serialize/Deserialize, and `FromRow` for DB-mapped structs.

#### Database Row Model

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use std::collections::HashMap;

/// Maps to the `ontology_sources` database table.
/// Tracks discovered and imported ontology data sources.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OntologySource {
    pub id: Uuid,
    pub source_id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub format: String,
    pub domain: Option<String>,
    pub path: String,
    pub is_base: bool,
    pub is_extension: bool,
    pub imported_at: Option<DateTime<Utc>>,
    pub stats: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

Key points:
- `id` is the internal UUID primary key; `source_id` is the human-readable identifier from `sources.json` (e.g., `"mpcg-ontology"`)
- `stats` is `Option<serde_json::Value>` to store arbitrary JSON (class counts, property counts, etc.)
- `path` stores the symlink path as-is (not canonicalized), so broken symlinks can be detected later
- `is_base` and `is_extension` are mutually exclusive flags (enforced by a CHECK constraint in the DB)

#### Filesystem Models

```rust
/// Parsed from `data/sources.json`. Top-level config listing all available sources.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourcesConfig {
    pub description: String,
    pub sources: Vec<SourceEntry>,
}

/// A single entry in the `sources` array of `sources.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceEntry {
    pub id: String,
    pub path: String,
    pub description: String,
    pub active: bool,
}

/// Parsed from each source directory's `manifest.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceManifest {
    pub name: String,
    pub version: String,
    pub description: String,
    #[serde(rename = "type")]
    pub source_type: String,
    pub format: String,
    pub domain: Option<String>,
    pub files: HashMap<String, String>,
    pub stats: Option<serde_json::Value>,
}
```

Key points:
- `SourceEntry.active` controls whether the source is included in discovery. This is distinct from `is_base`/`is_extension` which indicate "currently loaded as the active ontology."
- `SourceManifest.source_type` uses `#[serde(rename = "type")]` because `type` is a Rust reserved keyword. The JSON field name is `"type"` and will contain values like `"base"` or `"extension"`.
- `SourceManifest.files` maps role names (e.g., `"classes"`, `"properties"`, `"relationships"`) to relative file paths within the source directory.

#### API Response Models

```rust
/// API response for a single ontology source.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub format: String,
    pub domain: Option<String>,
    pub available: bool,
    pub imported_at: Option<DateTime<Utc>>,
    pub is_base: bool,
    pub is_extension: bool,
    pub stats: Option<serde_json::Value>,
}

/// API response for the currently active sources.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveSourcesResponse {
    pub base: Option<SourceResponse>,
    pub extension: Option<SourceResponse>,
}

/// Input payload for PUT /api/ontology-sources/active.
#[derive(Debug, Clone, Deserialize)]
pub struct SetActiveInput {
    pub base: Option<String>,
    pub extension: Option<String>,
}
```

Key points:
- `SourceResponse.id` is the human-readable `source_id` (not the UUID), since the API consumer identifies sources by their string ID.
- `SourceResponse.available` is `false` when the source's symlink target is missing or inaccessible. This is computed at discovery time (Section 3), not stored in the database.
- `SetActiveInput` uses `Option<String>` for both fields. Passing `None` for `base` clears the active base; passing `None` for `extension` clears the active extension.
- `ActiveSourcesResponse` wraps the currently active base and extension as optional `SourceResponse` objects.

### Required Dependencies in Cargo.toml

The models file uses crates already present in the project based on existing feature models:
- `chrono` (with `serde` feature) for `DateTime<Utc>`
- `serde` and `serde_json` for serialization/deserialization
- `sqlx` (with `FromRow` derive) for database mapping
- `uuid` for `Uuid`

No new Cargo.toml dependencies should be needed for this section.