The `source_id` column was already added to the database tables but the Rust model structs have NOT been updated yet. Now I have all the context I need.

# Section 01: Database Migration and Model Updates

## Overview

This section adds the `is_system` boolean column to the `classes` table, creates the `source_conflicts` table with indexes, and updates the existing Rust model structs (`Class`, `Property`, `RelationshipType`) to include `source_id` and `is_system` fields so they remain compatible with `FromRow` after the migration.

This section has no dependencies and blocks all subsequent sections (02 through 06).

## Current State

The `classes` table already has a `source_id TEXT` column (added in migration `20270321000000_ontology_sources.sql`), as do `properties` and `relationship_types`. However:

1. The `classes` table does **not** have an `is_system` column.
2. The `source_conflicts` table does **not** exist.
3. The Rust structs `Class`, `Property`, and `RelationshipType` in `backend/src/features/ontology/models.rs` do **not** include `source_id` or `is_system` fields, which means any `SELECT *` or full-column query will fail at deserialization.

## Tests (Write First)

Tests for this section verify the migration ran correctly and the model structs have the right fields. These are integration tests requiring a real database (via `sqlx::test`).

**File:** `backend/tests/migration_tests.rs` (new file)

### test_is_system_column_exists

Use `sqlx::test` with the migrated pool. Run a raw query selecting `is_system` from the `classes` table (e.g., `SELECT is_system FROM classes LIMIT 0`). The query should succeed without error, proving the column exists.

### test_is_system_defaults_false

Insert a class row without specifying `is_system`. Then SELECT it back and assert `is_system = false`. This confirms the `DEFAULT FALSE` constraint works. Use a valid `version_id` from the `ontology_versions` table (the seeded `1.0.0` row).

### test_source_conflicts_table_created

Run `SELECT * FROM source_conflicts LIMIT 0`. Should succeed without error, proving the table exists.

### test_source_conflicts_columns

Insert a row into `source_conflicts` specifying all columns (base_source_id, extension_source_id, entity_type, entity_name, resolution). SELECT it back and verify all fields deserialize correctly. This confirms the full schema.

### test_existing_class_model_has_source_id

Construct a `Class` struct from a database row via `sqlx::query_as::<_, Class>("SELECT * FROM classes LIMIT 1")` (after inserting a test class). Verify the struct has `source_id: Option<String>` and `is_system: bool` fields accessible. This test validates the Rust model is `FromRow`-compatible with the migrated schema.

**Test stubs** -- each test function should be an `async fn` annotated with `#[sqlx::test(migrations = "migrations")]`. The test body should contain the SQL operations described above and appropriate assertions. Keep tests minimal; no need for full struct comparisons -- just assert the specific fields under test.

## Implementation

### 1. SQL Migration File

**File:** `backend/migrations/20270322000000_import_engine_schema.sql` (new file)

The migration timestamp must sort after the existing `20270321000000_ontology_sources.sql`. The migration contains two parts:

**Part A: Add `is_system` to `classes`**

```sql
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;
```

This column tracks whether a class is a "system" class (from system-ontology's `classes.json`). MPCG-format classes default to `false`. The `IF NOT EXISTS` guard makes the migration idempotent.

**Part B: Create `source_conflicts` table**

```sql
CREATE TABLE IF NOT EXISTS source_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_source_id TEXT NOT NULL,
    extension_source_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    resolution TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_conflicts_base
    ON source_conflicts (base_source_id);
CREATE INDEX IF NOT EXISTS idx_source_conflicts_extension
    ON source_conflicts (extension_source_id);
```

Column semantics:
- `entity_type`: one of `'class'`, `'property'`, `'relationship_type'`
- `entity_name`: the name of the conflicting entity
- `resolution`: `NULL` means unresolved; can be `'base'` or `'extension'` once resolved
- `base_source_id` / `extension_source_id`: the `source_id` text values (not UUIDs) matching the `ontology_sources.source_id` natural key

### 2. Update Rust Model Structs

**File:** `backend/src/features/ontology/models.rs` (modify existing)

Three structs need new fields added to match the database columns. The fields must be appended so that `FromRow` derive can map them. Since `source_id` is nullable in the DB (`ALTER TABLE ... ADD COLUMN ... TEXT` without `NOT NULL`), it maps to `Option<String>`.

**Class struct** (around line 52): Add two fields:

```rust
pub struct Class {
    // ... existing fields ...
    pub source_id: Option<String>,
    pub is_system: bool,
}
```

**Property struct** (around line 103): Add one field:

```rust
pub struct Property {
    // ... existing fields ...
    pub source_id: Option<String>,
}
```

**RelationshipType struct** (around line 214): Add one field:

```rust
pub struct RelationshipType {
    // ... existing fields ...
    pub source_id: Option<String>,
}
```

**Important considerations:**

- `sqlx::FromRow` maps columns by name, not by position, so the order of fields in the struct does not need to match the column order in the table. However, every non-nullable DB column must have a corresponding field and vice versa.
- The `ClassWithParent` struct (line 67) is used for specific queries with explicit column lists, not `SELECT *`. It does **not** need `source_id` or `is_system` unless those queries also select those columns. Review the queries that use `ClassWithParent` -- if they do `SELECT *`, add the fields; if they use explicit column lists, leave them alone.
- Similarly, check any other query-specific structs or functions in the ontology service that might SELECT from `classes`, `properties`, or `relationship_types` and verify they still work. The `FromRow` derive will produce a runtime error if a column is missing from the result set.

### 3. Verify Existing Queries Compile

After adding the new fields, run `cargo check` to ensure no compilation errors. The new fields have types that serde and sqlx can handle without additional derives. If any existing code constructs `Class`, `Property`, or `RelationshipType` structs manually (in tests or elsewhere), those call sites must be updated to include the new fields (e.g., `source_id: None, is_system: false`).

## File Summary

| File | Action |
|------|--------|
| `backend/migrations/20270322000000_import_engine_schema.sql` | Create |
| `backend/src/features/ontology/models.rs` | Modify (add fields to 3 structs) |
| `backend/tests/migration_tests.rs` | Create |

## Verification Checklist

1. `cargo check` passes with the model changes
2. `sqlx migrate run` applies the new migration without errors
3. All existing tests still pass (the new fields have defaults/optionals so existing data is compatible)
4. The 5 new migration tests pass against a real database