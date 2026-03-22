# Section 06: Full Test Suite

## Status: IMPLEMENTED

## Overview

Complete test suite for the import engine. Unit tests (31) in inline `#[cfg(test)]` modules, integration tests (8) in dedicated test file.

## Files Created

- `backend/tests/import_engine_test.rs` — 8 sqlx::test integration tests

## Test Summary

| Category | Count | Location |
|----------|-------|----------|
| Model unit tests | 15 | `import_engine/models.rs` |
| JSON adapter tests | 6 | `adapters/json_adapter.rs` |
| Schema adapter tests | 5 | `adapters/schema_adapter.rs` |
| Validation tests | 5 | `adapters/mod.rs` |
| Migration verification | 4 | `import_engine_test.rs` |
| Service integration | 4 | `import_engine_test.rs` |
| **Total** | **39** | |

## Integration Tests (require DATABASE_URL)

- test_is_system_column_exists, test_is_system_defaults_false
- test_source_conflicts_table_created, test_source_conflicts_columns
- test_import_json_source, test_import_then_unload
- test_clean_swap_reimport, test_import_sets_flags_atomically
- test_import_nonexistent_source, test_extension_without_base

## TestServices Update

The `TestServices` struct in `tests/common/mod.rs` must include the `ImportService`. Add:

```rust
pub import_service: ImportService,
```

In `setup_services()`, create it after the `source_service`:

```rust
let import_service = ImportService::new(
    pool.clone(),
    std::path::PathBuf::from("./test-data"),
);
```

And include it in the returned `TestServices` struct. The import for `ImportService` should be added alongside the existing service imports from `template_repo_backend::features`.

## Fixture Strategy

All tests use minimal fixture data (2-3 classes, 2-3 properties, 1-2 relationship types) rather than full ontology files. Fixtures are created inline via `std::fs::write` into `tempfile::TempDir` directories.

Helper functions should be created at the top of the integration test file for common patterns:

- `create_test_source_dir(...)` -- creates a temp dir with classes.json, properties.json, relationship_types.json
- `insert_source_row(pool, source_id, path, format)` -- inserts a row into `ontology_sources` with given values
- `get_current_version_id(pool)` -- fetches the current ontology version UUID

---

## 1. Migration Verification Tests

**File:** `/Users/vidarbrevik/projects/ontology-manager/backend/tests/import_engine_test.rs`

These tests verify that the section-01 migration was applied correctly.

### test_is_system_column_exists

```rust
#[sqlx::test]
async fn test_is_system_column_exists(pool: PgPool) {
    /// Verify the `is_system` column exists on the `classes` table after migration.
    /// SELECT is_system FROM classes LIMIT 0 should succeed without error.
}
```

### test_is_system_defaults_false

```rust
#[sqlx::test]
async fn test_is_system_defaults_false(pool: PgPool) {
    /// Insert a class without specifying `is_system`.
    /// Assert that the inserted row has is_system = false.
    /// Requires fetching the current version_id for the INSERT.
}
```

### test_source_conflicts_table_created

```rust
#[sqlx::test]
async fn test_source_conflicts_table_created(pool: PgPool) {
    /// SELECT * FROM source_conflicts LIMIT 0 should succeed.
}
```

### test_source_conflicts_columns

```rust
#[sqlx::test]
async fn test_source_conflicts_columns(pool: PgPool) {
    /// Verify all expected columns exist:
    /// id, base_source_id, extension_source_id, entity_type, entity_name, resolution, created_at
    /// Use a SELECT with all column names to confirm.
}
```

---

## 2. Adapter Unit Tests

These tests go in `#[cfg(test)] mod tests` blocks inside the respective adapter files. They use `tempfile::TempDir` and do not require a database.

### JSON Adapter Tests

**File:** `/Users/vidarbrevik/projects/ontology-manager/backend/src/features/import_engine/adapters/json_adapter.rs`

#### test_json_parse_classes

```rust
/// Create temp dir with classes.json containing 3 classes:
///   - "Root" (parent: null, is_system: true)
///   - "ChildA" (parent: "Root", is_system: false)
///   - "ChildB" (parent: "Root", is_system: false)
/// Parse via JsonAdapter. Assert 3 ParsedClass entries with correct
/// parent_name and is_system values.
```

#### test_json_parse_properties

```rust
/// Create temp dir with properties.json keyed by 2 class names:
///   "Root": [{"name": "status", "type": "string", "required": true, "sensitive": false}]
///   "ChildA": [{"name": "priority", "type": "integer", "required": false}]
/// Parse. Assert correct class_name, data_type, is_required, is_sensitive mappings.
```

#### test_json_parse_properties_with_enum

```rust
/// Property with "enum": ["A", "B", "C"].
/// Assert validation_rules contains {"enum": ["A", "B", "C"]} as serde_json::Value.
```

#### test_json_parse_relationship_types

```rust
/// Create relationship_types.json with 2 entries:
///   - {name: "manages", source_class: "Root", target_class: "ChildA", cardinality: "one:many"}
///   - {name: "contains", source_class: null, target_class: null}
/// Assert name, source_class_name, target_class_name, cardinality parsing.
```

#### test_json_parse_cardinality_split

```rust
/// Input: "cardinality": "many:one"
/// Assert source_cardinality = "many", target_cardinality = "one".
```

#### test_json_parse_cardinality_missing

```rust
/// No cardinality field in the JSON.
/// Assert defaults to source_cardinality = "many", target_cardinality = "many".
```

### Schema + Taxonomy Adapter Tests

**File:** `/Users/vidarbrevik/projects/ontology-manager/backend/src/features/import_engine/adapters/schema_adapter.rs`

#### test_taxonomy_walk_node_types

```rust
/// Create taxonomy.json with a 3-level nodeTypes tree:
///   Entity -> Person -> Employee
/// Parse. Assert flat list of 3 ParsedClass entries with correct parent_name references:
///   Entity(parent=None), Person(parent="Entity"), Employee(parent="Person").
```

#### test_taxonomy_active_types_from_schema

```rust
/// Create schema.json with $defs.NodeType.enum: ["Person", "Event"].
/// Create taxonomy.json with nodeTypes containing Person, Organization, Event.
/// Assert Person and Event have is_abstract = false.
/// Assert Organization has is_abstract = true.
```

#### test_taxonomy_walk_edge_types

```rust
/// Create taxonomy.json with edgeTypes tree containing 2 relationship types.
/// Parse. Assert relationship types created with correct names.
```

#### test_taxonomy_property_descriptions

```rust
/// Taxonomy entry with property_descriptions: {"status": "FRIENDLY or HOSTILE"}.
/// Assert a ParsedProperty is created with class_name matching the taxonomy entry
/// and description = "FRIENDLY or HOSTILE".
```

#### test_taxonomy_empty_subtypes

```rust
/// Node with no "subtypes" key in taxonomy.
/// Assert it parses as a leaf node with no children (no error).
```

---

## 3. Validation Unit Tests

These test the pre-parse validation functions (topological sort, orphan detection, duplicate detection). They belong in the adapter module's test block or a dedicated validation module's test block.

**File:** `/Users/vidarbrevik/projects/ontology-manager/backend/src/features/import_engine/adapters/mod.rs` (or wherever the validation functions are defined)

#### test_topological_sort_basic

```rust
/// 3 classes: A (root, parent=None), B (parent="A"), C (parent="B").
/// Run topological sort. Assert output order is [A, B, C].
```

#### test_topological_sort_cycle_detection

```rust
/// 3 classes forming a cycle: A (parent="C"), B (parent="A"), C (parent="B").
/// Run topological sort. Assert ImportError::ParseError is returned with cycle info.
```

#### test_validate_orphan_property

```rust
/// ParsedProperty with class_name = "Missing" where "Missing" is not in the parsed classes list.
/// Run validation. Assert ImportError::ParseError mentioning the orphan reference.
```

#### test_validate_orphan_relationship_type

```rust
/// ParsedRelationshipType with source_class_name = Some("Missing").
/// Run validation. Assert ImportError::ParseError.
```

#### test_validate_duplicate_class_names

```rust
/// Two ParsedClass entries both named "Duplicate".
/// Run validation. Assert ImportError::ParseError mentioning the duplicate.
```

---

## 4. Service Integration Tests

These tests use `#[sqlx::test]` and exercise the full `ImportService` flow against a real database. Each test creates temp directories with fixture JSON files and inserts source rows into `ontology_sources`.

**File:** `/Users/vidarbrevik/projects/ontology-manager/backend/tests/import_engine_test.rs`

### Helper Functions

Define these at the top of the test file:

```rust
/// Creates a temp directory containing classes.json, properties.json, and relationship_types.json
/// with minimal test data. Returns the TempDir (must be kept alive for the test duration).
fn create_test_source_dir() -> tempfile::TempDir { ... }

/// Inserts a row into ontology_sources with the given source_id, path, and format.
async fn insert_source_row(pool: &PgPool, source_id: &str, path: &str, format: &str) { ... }
```

### test_import_json_source

```rust
#[sqlx::test]
async fn test_import_json_source(pool: PgPool) {
    /// 1. Create temp dir with valid system-ontology JSON files (2 classes, 2 properties, 1 rel type)
    /// 2. Insert source row into ontology_sources pointing to the temp dir, format="json"
    /// 3. Call ImportService::import with role=base
    /// 4. Verify:
    ///    - classes rows exist with correct source_id
    ///    - properties rows exist with correct source_id
    ///    - relationship_types rows exist with correct source_id
    ///    - ontology_sources row has imported_at set (not NULL)
    ///    - ontology_sources row has is_base = true
    ///    - ImportResult.imported stats match expected counts
}
```

### test_import_then_unload

```rust
#[sqlx::test]
async fn test_import_then_unload(pool: PgPool) {
    /// 1. Import a source (same setup as above)
    /// 2. Verify rows exist
    /// 3. Call ImportService::unload
    /// 4. Verify:
    ///    - All classes/properties/relationship_types with that source_id are gone
    ///    - ontology_sources row has is_base = false, is_extension = false, imported_at = NULL
    ///    - UnloadResult.removed stats match expected counts
}
```

### test_clean_swap_reimport

```rust
#[sqlx::test]
async fn test_clean_swap_reimport(pool: PgPool) {
    /// 1. Import source with classes [A, B]
    /// 2. Re-import same source with classes [A, C] (B removed, C added)
    /// 3. Verify:
    ///    - Class B no longer exists
    ///    - Class C exists
    ///    - Class A still exists
    ///    - No duplicate rows
}
```

### test_conflict_detection_on_extension

```rust
#[sqlx::test]
async fn test_conflict_detection_on_extension(pool: PgPool) {
    /// 1. Import base source with classes [A, B]
    /// 2. Import extension source with classes [B, C]
    /// 3. Verify:
    ///    - Conflict detected for class "B"
    ///    - source_conflicts table has a row with entity_type="class", entity_name="B"
    ///    - ImportResult.conflicts contains the conflict entry
    ///    - Class C imported without conflict
}
```

### test_import_nonexistent_source

```rust
#[sqlx::test]
async fn test_import_nonexistent_source(pool: PgPool) {
    /// Call import with a source_id that does not exist in ontology_sources.
    /// Verify ImportError::NotFound (404 equivalent).
}
```

### test_import_unavailable_source

```rust
#[sqlx::test]
async fn test_import_unavailable_source(pool: PgPool) {
    /// Insert source row with a path pointing to a nonexistent directory.
    /// Call import. Verify an error is returned (not a panic).
    /// The error should be IoError or InvalidInput, not a 500 panic.
}
```

### test_extension_without_base

```rust
#[sqlx::test]
async fn test_extension_without_base(pool: PgPool) {
    /// No base source has been imported (no row with is_base=true and imported_at set).
    /// Attempt to import a source with role=extension.
    /// Verify ImportError::InvalidInput (400 equivalent) with a message about missing base.
}
```

### test_reimport_base_with_extension

```rust
#[sqlx::test]
async fn test_reimport_base_with_extension(pool: PgPool) {
    /// 1. Import base source
    /// 2. Import extension source (creates conflicts)
    /// 3. Re-import base source with different data
    /// 4. Verify conflicts are re-detected against the new base data
}
```

### test_unload_clears_conflicts

```rust
#[sqlx::test]
async fn test_unload_clears_conflicts(pool: PgPool) {
    /// 1. Import base source
    /// 2. Import extension source (creates conflicts in source_conflicts)
    /// 3. Unload the extension source
    /// 4. Verify source_conflicts rows referencing this extension are deleted
}
```

### test_import_sets_flags_atomically

```rust
#[sqlx::test]
async fn test_import_sets_flags_atomically(pool: PgPool) {
    /// 1. Import source A as base (is_base=true)
    /// 2. Import source B as base (should clear A's is_base, set B's is_base)
    /// 3. Verify source A has is_base=false
    /// 4. Verify source B has is_base=true
}
```

---

## 5. Model Tests

These can be simple unit tests verifying struct field presence. They belong in the ontology models module or the import engine models module.

### test_existing_class_model_has_source_id

```rust
/// Verify that the `Class` struct (in ontology/models.rs) includes
/// `source_id: Option<String>` and `is_system: bool` fields.
/// This can be a compile-time check -- constructing a Class with these fields set
/// confirms they exist. No runtime assertion needed beyond the code compiling.
```

---

## Implementation Notes

- All `#[sqlx::test]` tests automatically run migrations, so the section-01 migration will be applied before each test
- The `tempfile::TempDir` must be kept alive (bound to a variable) for the duration of each test; dropping it deletes the directory
- For integration tests that need a `manifest.json`, create one in the temp dir with the appropriate `files` mapping pointing to the JSON fixture files
- Use `serde_json::json!()` macro to construct fixture JSON inline rather than reading from static files
- Error assertions should check the error variant (e.g., `matches!(err, ImportError::NotFound(_))`) not string matching
- The `source_id` used in tests should be a descriptive string like `"test-base-source"` or `"test-ext-source"` to make test output readable