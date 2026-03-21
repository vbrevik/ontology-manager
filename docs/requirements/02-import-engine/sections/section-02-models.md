Now I have all the context needed. Let me produce the section content.

# Section 02 -- Data Models for the Import Engine

## Overview

This section defines all data models for the import engine feature. These include:

1. **Intermediate representation structs** -- `ParsedOntology`, `ParsedClass`, `ParsedProperty`, `ParsedRelationshipType` -- the common format both adapters produce after reading source files.
2. **API response structs** -- `ImportResult`, `ImportStats`, `ConflictEntry`, `UnloadResult` -- returned from the import/unload endpoints.
3. **File-format deserialization structs** -- serde types for reading JSON and JSON Schema source files.
4. **`ImportParams`** -- query parameter struct for the import endpoint.
5. **`ImportError`** -- error enum with `IntoResponse` implementation.
6. **Updates to existing models** -- add `source_id` and `is_system` fields to existing `Class`, `Property`, and `RelationshipType` structs.

All models live in `backend/src/features/import_engine/models.rs` except the existing model updates which modify `backend/src/features/ontology/models.rs`.

## Dependencies

- **section-01-migration** must be complete first (the `is_system` column on `classes` and `source_id` columns must exist in the database for `FromRow` to work after struct updates).

## Files to Create

- `/Users/vidarbrevik/projects/ontology-manager/backend/src/features/import_engine/mod.rs`
- `/Users/vidarbrevik/projects/ontology-manager/backend/src/features/import_engine/models.rs`

## Files to Modify

- `/Users/vidarbrevik/projects/ontology-manager/backend/src/features/ontology/models.rs` -- add `source_id` and `is_system` to `Class`, add `source_id` to `Property` and `RelationshipType`
- `/Users/vidarbrevik/projects/ontology-manager/backend/src/features/mod.rs` -- add `pub mod import_engine;`

---

## Tests First

Place model tests in the `#[cfg(test)] mod tests` block at the bottom of `backend/src/features/import_engine/models.rs`. These are all unit tests (no database required).

### test_existing_class_model_has_source_id

Verify the `Class` struct in `ontology/models.rs` now includes `source_id: Option<String>` and `is_system: bool`. This is a compile-time check -- construct a `Class` literal and assert those fields exist. Constructing the struct with all fields confirms `FromRow` compatibility with the migrated schema.

### test_parsed_ontology_default_empty

Construct a `ParsedOntology` with empty vectors for classes, properties, and relationship_types. Assert all three vecs have length 0.

### test_parsed_class_fields

Construct a `ParsedClass` with representative values. Assert `name`, `parent_name`, `description`, `is_abstract`, and `is_system` are all accessible and hold the expected values.

### test_import_result_serializes

Construct an `ImportResult` and serialize to JSON via `serde_json::to_value`. Assert the JSON contains keys `source_id`, `role`, `imported`, `conflicts`, `imported_at`.

### test_conflict_entry_serializes

Construct a `ConflictEntry` and serialize. Assert it has keys `entity_type`, `name`, `base_source`, `extension_source`.

### test_import_stats_serializes

Construct `ImportStats { classes: 5, properties: 10, relationship_types: 3 }`. Serialize and verify the numeric values round-trip.

### test_unload_result_serializes

Construct `UnloadResult` and serialize. Assert keys `source_id` and `removed` are present.

### test_import_params_deserialize_role

Deserialize `ImportParams` from query string `"role=base"`. Assert `role` is `Some("base".to_string())`.

### test_import_params_missing_role

Deserialize `ImportParams` from empty query string. Assert `role` is `None`.

### test_json_classes_file_deserialize

Deserialize the JSON format's classes wrapper `JsonClassesFile` from a sample JSON string `{"classes": [...]}`. Verify the vec length and field values.

### test_json_properties_file_deserialize

Deserialize `JsonPropertiesFile` from `{"properties": {"ClassName": [...]}}`. Verify the HashMap structure.

### test_json_relationship_types_file_deserialize

Deserialize `JsonRelationshipTypesFile` from sample JSON. Verify fields including cardinality.

### test_import_error_into_response_status_codes

Construct each `ImportError` variant and call `.into_response()`. Assert the expected HTTP status codes: `IoError` -> 500, `ParseError` -> 400, `DatabaseError` -> 500, `NotFound` -> 404, `InvalidInput` -> 400, `ImportFailed` -> 500.

---

## Implementation Details

### 1. Module Declaration

**File: `backend/src/features/import_engine/mod.rs`**

Declare the models submodule and re-export key types. Additional submodules (adapters, service, routes) will be added in later sections.

```rust
pub mod models;

pub use models::*;
```

**File: `backend/src/features/mod.rs`**

Add `pub mod import_engine;` to the feature module list (after `pub mod ontology_sources;`).

### 2. Intermediate Representation Structs

**File: `backend/src/features/import_engine/models.rs`**

These structs are the common output of both format adapters. They use string names for cross-references (not UUIDs). Name-to-UUID resolution happens during the insert phase (section-04).

```rust
/// Common intermediate representation produced by all format adapters.
#[derive(Debug, Clone)]
pub struct ParsedOntology {
    pub classes: Vec<ParsedClass>,
    pub properties: Vec<ParsedProperty>,
    pub relationship_types: Vec<ParsedRelationshipType>,
}

#[derive(Debug, Clone)]
pub struct ParsedClass {
    pub name: String,
    pub parent_name: Option<String>,      // resolved to parent_class_id during insert
    pub description: Option<String>,
    pub is_abstract: bool,
    pub is_system: bool,                  // true for system-ontology JSON; false for MPCG
}

#[derive(Debug, Clone)]
pub struct ParsedProperty {
    pub name: String,
    pub class_name: String,               // resolved to class_id during insert
    pub data_type: String,                // "string", "integer", etc.
    pub is_required: bool,
    pub is_unique: bool,
    pub is_sensitive: bool,
    pub description: Option<String>,
    pub validation_rules: Option<serde_json::Value>,  // enum constraints, etc.
}

#[derive(Debug, Clone)]
pub struct ParsedRelationshipType {
    pub name: String,
    pub description: Option<String>,
    pub source_class_name: Option<String>,  // resolved to allowed_source_class_id
    pub target_class_name: Option<String>,  // resolved to allowed_target_class_id
    pub source_cardinality: String,         // "many" or "one"
    pub target_cardinality: String,
    pub grants_permission_inheritance: bool,
}
```

### 3. API Response Structs

These are serialized as JSON in API responses. All derive `Serialize`.

```rust
/// Result returned from POST /{id}/import
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub source_id: String,
    pub role: String,                       // "base" or "extension"
    pub imported: ImportStats,
    pub conflicts: Vec<ConflictEntry>,
    pub imported_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportStats {
    pub classes: usize,
    pub properties: usize,
    pub relationship_types: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictEntry {
    pub entity_type: String,                // "class", "property", "relationship_type"
    pub name: String,
    pub base_source: String,
    pub extension_source: String,
}

/// Result returned from DELETE /{id}/import
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnloadResult {
    pub source_id: String,
    pub removed: ImportStats,
}
```

### 4. File-Format Deserialization Structs

These are used only by the adapters (section-03) but defined here so models are centralized.

**JSON format (system-ontology):**

```rust
/// Wrapper for classes.json: {"classes": [...]}
#[derive(Debug, Deserialize)]
pub struct JsonClassesFile {
    pub classes: Vec<JsonClassEntry>,
}

#[derive(Debug, Deserialize)]
pub struct JsonClassEntry {
    pub name: String,
    pub parent: Option<String>,
    #[serde(default)]
    pub is_abstract: bool,
    #[serde(default)]
    pub is_system: bool,
    pub description: Option<String>,
}

/// Wrapper for properties.json: {"properties": {"ClassName": [...]}}
#[derive(Debug, Deserialize)]
pub struct JsonPropertiesFile {
    pub properties: HashMap<String, Vec<JsonPropertyEntry>>,
}

#[derive(Debug, Deserialize)]
pub struct JsonPropertyEntry {
    pub name: String,
    #[serde(rename = "type")]
    pub data_type: String,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub unique: bool,
    #[serde(default)]
    pub sensitive: bool,
    pub description: Option<String>,
    #[serde(rename = "enum")]
    pub enum_values: Option<Vec<String>>,
}

/// Wrapper for relationship_types.json: {"relationship_types": [...]}
#[derive(Debug, Deserialize)]
pub struct JsonRelationshipTypesFile {
    pub relationship_types: Vec<JsonRelationshipTypeEntry>,
}

#[derive(Debug, Deserialize)]
pub struct JsonRelationshipTypeEntry {
    pub name: String,
    pub description: Option<String>,
    pub source_class: Option<String>,
    pub target_class: Option<String>,
    pub cardinality: Option<String>,       // "many:one" format, split by adapter
    #[serde(default)]
    pub grants_permission_inheritance: bool,
}
```

**JSON Schema + Taxonomy format (MPCG):**

The taxonomy and schema files are parsed as generic `serde_json::Value` in the adapter because their structure is recursive and deeply nested. No dedicated deserialization structs are needed for these -- the adapter walks the JSON tree dynamically. (This is implemented in section-03.)

### 5. ImportParams Query Struct

Used by the route handler to extract the `?role=base|extension` query parameter.

```rust
#[derive(Debug, Deserialize)]
pub struct ImportParams {
    pub role: Option<String>,
}
```

### 6. ImportError Enum

Follows the same pattern as `SourceError` in `backend/src/features/ontology_sources/service.rs`.

```rust
#[derive(Debug, thiserror::Error)]
pub enum ImportError {
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

    #[error("Import failed: {0}")]
    ImportFailed(String),
}
```

`IntoResponse` implementation mapping each variant to an HTTP status code:

| Variant | Status Code |
|---------|-------------|
| `IoError` | 500 INTERNAL_SERVER_ERROR |
| `ParseError` | 400 BAD_REQUEST |
| `DatabaseError` | 500 INTERNAL_SERVER_ERROR |
| `NotFound` | 404 NOT_FOUND |
| `InvalidInput` | 400 BAD_REQUEST |
| `ImportFailed` | 500 INTERNAL_SERVER_ERROR |

The response body should be JSON `{"error": "<message>"}`, matching the `SourceError` pattern:

```rust
impl IntoResponse for ImportError {
    fn into_response(self) -> Response {
        let status = match &self {
            Self::IoError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::ParseError(_) => StatusCode::BAD_REQUEST,
            Self::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::InvalidInput(_) => StatusCode::BAD_REQUEST,
            Self::ImportFailed(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let body = serde_json::json!({ "error": self.to_string() });
        (status, Json(body)).into_response()
    }
}
```

### 7. Updates to Existing Model Structs

**File: `backend/src/features/ontology/models.rs`**

The migration (section-01) adds `is_system` and `source_id` columns to the database. The Rust structs must be updated to match so `FromRow` derivation continues to work.

**`Class` struct** (line 52-64): Add two fields:
- `pub source_id: Option<String>` -- which source imported this class (NULL for manually created)
- `pub is_system: bool` -- whether this is a system class

**`ClassWithParent` struct** (line 67-78): Add the same two fields for consistency since it is also `FromRow`.

**`Property` struct** (line 103-121): Add:
- `pub source_id: Option<String>`

**`RelationshipType` struct** (line 214-224): Add:
- `pub source_id: Option<String>`

These are the only existing structs that derive `FromRow` for the tables affected by the migration. The `CreateClassInput`, `UpdateClassInput`, and similar input structs do NOT need `source_id` or `is_system` since those fields are set by the import engine, not by user input.

### Required Imports

The models file needs these imports:

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
```

The `axum` imports for `IntoResponse` are:

```rust
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
```