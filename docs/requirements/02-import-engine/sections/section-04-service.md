Now I have sufficient context. Let me generate the section content.

# Section 04: ImportService -- Core Import Orchestration

## Overview

This section implements `ImportService`, the central service struct that orchestrates the entire import workflow: resolving a source from the database, dispatching to the appropriate format adapter, validating parsed data, executing a clean-swap transaction (delete old data, insert new data in topological order), running conflict detection for extensions, and updating source flags. It also implements the unload (delete) logic.

**File to create:** `/Users/vidarbrevik/projects/ontology-manager/backend/src/features/import_engine/service.rs`

## Dependencies

- **section-02-models** provides: `ParsedOntology`, `ParsedClass`, `ParsedProperty`, `ParsedRelationshipType`, `ImportResult`, `ImportStats`, `ConflictEntry`, `UnloadResult`, `ImportError`, `ImportParams`
- **section-03-adapters** provides: adapter dispatch function that takes a source format string and file paths and returns `Result<ParsedOntology, ImportError>`, plus validation functions (duplicate class names, orphan refs, cycle detection / topological sort)
- **section-01-migration** provides: `is_system` column on `classes`, `source_conflicts` table, `source_id` column on `classes`/`properties`/`relationship_types`
- Existing codebase: `OntologySource` from `features/ontology_sources/models.rs`, `SourceManifest` from same module, `OntologyVersion` from `features/ontology/models.rs`

## Tests (Write First)

These tests go in `service.rs` as `#[cfg(test)] mod tests` or in the integration test files (section-06). The stubs below define what the service must satisfy.

### Service Integration Tests (sqlx::test, real DB)

These are integration tests that require a database. They belong in section-06 but are listed here to define the service contract.

```rust
/// test_import_json_source
/// Create temp dir with valid system-ontology JSON files (2 classes, 2 properties, 1 rel type).
/// Insert a source row into ontology_sources with format="json".
/// Call import_service.import_source(source_id, "base").await.
/// Verify: classes/properties/relationship_types rows exist with correct source_id,
/// ontology_sources.imported_at is set, is_base=true.

/// test_import_then_unload
/// Import a source as base. Verify rows exist.
/// Call import_service.unload_source(source_id).await.
/// Verify: all rows deleted, is_base=false, is_extension=false, imported_at=NULL.

/// test_clean_swap_reimport
/// Import source with 2 classes. Re-import same source with 3 classes (1 renamed).
/// Verify: old data replaced, new 3 classes present, no leftover from first import.

/// test_conflict_detection_on_extension
/// Import base with classes [A, B]. Import extension with classes [B, C].
/// Verify: conflict for class "B" stored in source_conflicts, returned in ImportResult.conflicts.

/// test_import_nonexistent_source
/// Call import with source_id not in ontology_sources. Verify ImportError::NotFound.

/// test_extension_without_base
/// No base source imported (no row with is_base=true and imported_at IS NOT NULL).
/// Attempt extension import. Verify ImportError::InvalidInput.

/// test_reimport_base_with_extension
/// Import base, import extension (conflicts detected), re-import base with different data.
/// Verify old conflicts cleared, new conflicts re-detected.

/// test_import_sets_flags_atomically
/// Import source A as base (is_base=true). Import source B as base.
/// Verify source A's is_base is now false, source B's is_base is true.

/// test_unload_clears_conflicts
/// Import base + extension (conflicts). Unload extension.
/// Verify source_conflicts rows cleared for that extension.
```

## Implementation Details

### ImportService Struct

`ImportService` follows the same pattern as `OntologySourceService` -- it is `Clone` (because `Pool<Postgres>` is internally `Arc`), holds a `Pool<Postgres>` and a `PathBuf` for the data directory, and is used as Axum `State`.

```rust
#[derive(Clone)]
pub struct ImportService {
    pool: Pool<Postgres>,
    data_dir: PathBuf,
}

impl ImportService {
    pub fn new(pool: Pool<Postgres>, data_dir: PathBuf) -> Self {
        Self { pool, data_dir }
    }
}
```

### import_source Method

Signature:

```rust
pub async fn import_source(
    &self,
    source_id: &str,
    role: &str, // "base" or "extension"
) -> Result<ImportResult, ImportError>
```

The method orchestrates these steps in sequence:

**Step 1 -- Resolve.** Query `ontology_sources` for the given `source_id`. If no row, return `ImportError::NotFound`. Read the row's `path` and `format` fields. Read `manifest.json` from the source directory (using the `SourceManifest` struct from `ontology_sources::models`). The manifest's `files` map tells the adapter which files to read.

Validate the `role` parameter: must be `"base"` or `"extension"`, otherwise return `ImportError::InvalidInput`. If `role=extension`, verify that a base source is currently imported by checking for a row with `is_base = TRUE AND imported_at IS NOT NULL`. If no base exists, return `ImportError::InvalidInput("No base source imported")`.

Validate the source directory exists and is readable before passing to the adapter.

**Step 2 -- Adapt.** Dispatch to the correct adapter based on `format`:
- `"json"` goes to the JSON adapter
- `"json-schema"` goes to the Schema+Taxonomy adapter
- Anything else returns `ImportError::InvalidInput`

The adapter returns `ParsedOntology`.

**Step 3 -- Validate.** Call the validation functions from section-03 (duplicate class names, orphan property references, orphan relationship type references, cycle detection via topological sort). The topological sort also produces the insertion order. If validation fails, return `ImportError::ParseError` with details.

**Step 4-6 -- Transaction (Swap + Detect + Finalize).** Begin a single database transaction. All of steps 4-6 happen within this transaction; if any step fails, the entire transaction rolls back.

**Step 4 -- Swap (within transaction).**
1. Delete existing data for this source_id (order matters for FK constraints):
   - `DELETE FROM properties WHERE source_id = $1`
   - `DELETE FROM relationship_types WHERE source_id = $1`
   - `DELETE FROM classes WHERE source_id = $1`
2. Get the current ontology version: `SELECT id FROM ontology_versions WHERE is_current = TRUE`
3. Insert classes in topological order (parents before children). Maintain a `HashMap<String, Uuid>` mapping class name to generated UUID. For each class:
   - Resolve `parent_name` to `parent_class_id` from the name map (None if root class)
   - INSERT into `classes` with: `name`, `description`, `parent_class_id`, `version_id`, `tenant_id = NULL`, `is_abstract`, `is_system`, `source_id`
   - Store returned `id` in the name map
4. Insert properties. For each property:
   - Resolve `class_name` to `class_id` using the name map
   - INSERT into `properties` with: `name`, `description`, `class_id`, `data_type`, `is_required`, `is_unique`, `is_sensitive`, `validation_rules`, `version_id`, `source_id`
   - Set `is_indexed = false`, `is_deprecated = false`, `reference_class_id = NULL`, `default_value = NULL` as defaults
5. Insert relationship types. For each relationship type:
   - Resolve `source_class_name` and `target_class_name` to UUIDs via name map (None if not specified)
   - INSERT into `relationship_types` with: `name`, `description`, `source_cardinality`, `target_cardinality`, `allowed_source_class_id`, `allowed_target_class_id`, `grants_permission_inheritance`, `source_id`
   - **Do NOT include `version_id`** -- the `relationship_types` table has no such column

**Step 5 -- Detect (within transaction, only if role=extension).**
1. Identify the base source: `SELECT source_id FROM ontology_sources WHERE is_base = TRUE`
2. Delete any existing conflicts for this base+extension pair: `DELETE FROM source_conflicts WHERE base_source_id = $base AND extension_source_id = $ext`
3. Detect class conflicts:
   ```sql
   SELECT c1.name FROM classes c1
   JOIN classes c2 ON c1.name = c2.name
   WHERE c1.source_id = $ext AND c2.source_id = $base
   ```
4. Detect property conflicts (requires join through classes):
   ```sql
   SELECT p1.name, c1.name as class_name FROM properties p1
   JOIN classes c1 ON p1.class_id = c1.id
   JOIN properties p2 ON p1.name = p2.name
   JOIN classes c2 ON p2.class_id = c2.id
   WHERE c1.name = c2.name AND p1.source_id = $ext AND p2.source_id = $base
   ```
5. Detect relationship type conflicts:
   ```sql
   SELECT r1.name FROM relationship_types r1
   JOIN relationship_types r2 ON r1.name = r2.name
   WHERE r1.source_id = $ext AND r2.source_id = $base
   ```
6. Insert each detected conflict into `source_conflicts` table with entity_type, entity_name, base_source_id, extension_source_id, resolution = NULL.
7. Collect conflicts into `Vec<ConflictEntry>` for the response.

**Step 6 -- Finalize (within transaction).**
1. Clear any previous holder of the role flag:
   - If role=base: `UPDATE ontology_sources SET is_base = FALSE WHERE is_base = TRUE`
   - If role=extension: `UPDATE ontology_sources SET is_extension = FALSE WHERE is_extension = TRUE`
2. Set flags on this source: `UPDATE ontology_sources SET is_base = $is_base, is_extension = $is_ext, imported_at = NOW() WHERE source_id = $id`
3. Commit transaction.

Build and return `ImportResult` with the source_id, role, import counts, conflicts list, and current timestamp.

### unload_source Method

Signature:

```rust
pub async fn unload_source(
    &self,
    source_id: &str,
) -> Result<UnloadResult, ImportError>
```

**Implementation:**

1. Verify the source exists in `ontology_sources`. If not, return `ImportError::NotFound`.
2. Begin a transaction.
3. Delete data in FK-safe order, capturing row counts:
   - `DELETE FROM properties WHERE source_id = $1` -- capture rows_affected
   - `DELETE FROM relationship_types WHERE source_id = $1` -- capture rows_affected
   - `DELETE FROM classes WHERE source_id = $1` -- capture rows_affected
   - `DELETE FROM source_conflicts WHERE base_source_id = $1 OR extension_source_id = $1`
4. Clear flags: `UPDATE ontology_sources SET is_base = FALSE, is_extension = FALSE, imported_at = NULL WHERE source_id = $1`
5. Commit transaction.
6. Return `UnloadResult` with the source_id and `ImportStats` containing the delete counts.

### Conflict Detection Module

The conflict detection logic can be factored into a separate function called within the import transaction. This can live in `conflict.rs` (referenced from the architecture) or be methods on `ImportService`. The key contract:

```rust
/// Detect conflicts between an extension source and the current base source.
/// Called within an active transaction after extension data is inserted.
/// Returns the list of detected conflicts.
async fn detect_conflicts(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    base_source_id: &str,
    extension_source_id: &str,
) -> Result<Vec<ConflictEntry>, ImportError>
```

This function:
1. Deletes old conflicts for this pair
2. Runs the three conflict detection queries (classes, properties, relationship types)
3. Inserts new conflict rows
4. Returns the conflict entries

### Module Declaration

The `mod.rs` for the import_engine feature should re-export `ImportService` and the route factory:

```rust
// backend/src/features/import_engine/mod.rs
pub mod models;
pub mod service;
pub mod routes;
pub mod adapters;
pub mod conflict;

pub use service::ImportService;
```

## Key Design Decisions

- **Single transaction for steps 4-6.** The delete-insert-detect-finalize sequence is atomic. If conflict detection fails or any insert violates a constraint, everything rolls back. This prevents partial imports.

- **Topological sort happens before the transaction.** The sort is a pure in-memory operation on `ParsedOntology` data. It produces the insertion order and detects cycles. This validation happens before opening the transaction to avoid holding a transaction open during CPU work.

- **Name-to-UUID resolution via in-memory HashMap.** During class insertion, each inserted class's generated UUID is stored in a `HashMap<String, Uuid>`. Properties and relationship types look up their class references from this map. This avoids extra database round-trips.

- **Clean swap, not upsert.** On re-import, all existing rows for the source_id are deleted first, then new rows inserted. This is simpler than computing diffs and handles renames/removals naturally.

- **Flag clearing is part of the transaction.** When setting `is_base=TRUE` on a source, first clear `is_base` on any other source. This ensures at most one base and one extension at any time.

## Error Handling

`ImportError` (defined in section-02-models) follows the `SourceError` pattern from `ontology_sources/service.rs`:

| Variant | HTTP Status | When |
|---------|-------------|------|
| `IoError` | 500 | File system read failure |
| `ParseError(String)` | 400 | Malformed data files, validation failure (cycles, orphans, duplicates) |
| `DatabaseError` | 500 | sqlx error |
| `NotFound(String)` | 404 | Source ID not in ontology_sources |
| `InvalidInput(String)` | 400 | Bad role parameter, extension without base, unknown format |
| `ImportFailed(String)` | 500 | Transaction commit failure |

The `IntoResponse` implementation returns a JSON body `{"error": "<message>"}` with the appropriate status code, matching the existing `SourceError` pattern exactly.

## SQL Queries Reference

**Get source by ID:**
```sql
SELECT * FROM ontology_sources WHERE source_id = $1
```

**Check base exists (for extension validation):**
```sql
SELECT source_id FROM ontology_sources WHERE is_base = TRUE AND imported_at IS NOT NULL
```

**Get current version:**
```sql
SELECT id FROM ontology_versions WHERE is_current = TRUE
```

**Insert class:**
```sql
INSERT INTO classes (name, description, parent_class_id, version_id, tenant_id, is_abstract, is_system, source_id)
VALUES ($1, $2, $3, $4, NULL, $5, $6, $7)
RETURNING id
```

**Insert property:**
```sql
INSERT INTO properties (name, description, class_id, data_type, is_required, is_unique, is_sensitive, validation_rules, version_id, source_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
```

**Insert relationship type:**
```sql
INSERT INTO relationship_types (name, description, source_cardinality, target_cardinality, allowed_source_class_id, allowed_target_class_id, grants_permission_inheritance, source_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
```

**Update source flags:**
```sql
UPDATE ontology_sources SET is_base = $1, is_extension = $2, imported_at = NOW() WHERE source_id = $3
```