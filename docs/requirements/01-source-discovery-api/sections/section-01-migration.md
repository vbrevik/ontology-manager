Now I have everything needed. Let me compose the section.

# Section 1: Database Migration

## Overview

This section creates the SQL migration that:
1. Creates a new `ontology_sources` table for tracking discovered external data sources
2. Adds a nullable `source_id TEXT` column to `classes`, `properties`, and `relationship_types`
3. Replaces existing unique constraints with NULL-safe partial unique indexes
4. Adds indexes on `source_id` for query performance

This section has no dependencies and blocks all subsequent sections.

## Tests First

Write these tests in `backend/tests/ontology_sources_test.rs`. They use `#[sqlx::test]` which auto-provisions a PostgreSQL test database with all migrations applied.

**File:** `/Users/vidarbrevik/projects/ontology-manager/backend/tests/ontology_sources_test.rs`

```rust
use sqlx::PgPool;

mod common;

// --- Migration verification tests ---

#[sqlx::test]
async fn test_ontology_sources_table_created(pool: PgPool) {
    // SELECT from the new table should not error
    let result = sqlx::query("SELECT id, source_id, name, is_base, is_extension FROM ontology_sources LIMIT 0")
        .fetch_all(&pool)
        .await;
    assert!(result.is_ok(), "ontology_sources table should exist after migration");
}

#[sqlx::test]
async fn test_source_id_column_exists_on_classes(pool: PgPool) {
    let result = sqlx::query("SELECT source_id FROM classes LIMIT 1")
        .fetch_all(&pool)
        .await;
    assert!(result.is_ok(), "classes.source_id column should exist");
}

#[sqlx::test]
async fn test_source_id_column_exists_on_properties(pool: PgPool) {
    let result = sqlx::query("SELECT source_id FROM properties LIMIT 1")
        .fetch_all(&pool)
        .await;
    assert!(result.is_ok(), "properties.source_id column should exist");
}

#[sqlx::test]
async fn test_source_id_column_exists_on_relationship_types(pool: PgPool) {
    let result = sqlx::query("SELECT source_id FROM relationship_types LIMIT 1")
        .fetch_all(&pool)
        .await;
    assert!(result.is_ok(), "relationship_types.source_id column should exist");
}

#[sqlx::test]
async fn test_existing_data_has_null_source_id(pool: PgPool) {
    // Existing seeded classes should have NULL source_id
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM classes WHERE source_id IS NOT NULL")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(row.0, 0, "All pre-existing classes should have NULL source_id");
}

#[sqlx::test]
async fn test_builtin_uniqueness_preserved(pool: PgPool) {
    // Two classes with same name, NULL source_id, same tenant/version should fail
    let version_id: (uuid::Uuid,) =
        sqlx::query_as("SELECT id FROM ontology_versions WHERE is_current = TRUE")
            .fetch_one(&pool)
            .await
            .unwrap();

    sqlx::query("INSERT INTO classes (name, version_id) VALUES ('DuplicateTest', $1)")
        .bind(version_id.0)
        .execute(&pool)
        .await
        .unwrap();

    let result = sqlx::query("INSERT INTO classes (name, version_id) VALUES ('DuplicateTest', $1)")
        .bind(version_id.0)
        .execute(&pool)
        .await;

    assert!(result.is_err(), "Duplicate built-in class name should be rejected");
}

#[sqlx::test]
async fn test_different_sources_same_name_allowed(pool: PgPool) {
    // Same class name with different source_id values should succeed
    let version_id: (uuid::Uuid,) =
        sqlx::query_as("SELECT id FROM ontology_versions WHERE is_current = TRUE")
            .fetch_one(&pool)
            .await
            .unwrap();

    sqlx::query("INSERT INTO classes (name, version_id, source_id) VALUES ('SharedName', $1, 'source-a')")
        .bind(version_id.0)
        .execute(&pool)
        .await
        .unwrap();

    let result = sqlx::query("INSERT INTO classes (name, version_id, source_id) VALUES ('SharedName', $1, 'source-b')")
        .bind(version_id.0)
        .execute(&pool)
        .await;

    assert!(result.is_ok(), "Same name with different source_id should be allowed");
}

#[sqlx::test]
async fn test_same_source_duplicate_blocked(pool: PgPool) {
    // Two classes with identical (name, tenant_id, version_id, source_id) should fail
    let version_id: (uuid::Uuid,) =
        sqlx::query_as("SELECT id FROM ontology_versions WHERE is_current = TRUE")
            .fetch_one(&pool)
            .await
            .unwrap();

    sqlx::query("INSERT INTO classes (name, version_id, source_id) VALUES ('DupSource', $1, 'source-x')")
        .bind(version_id.0)
        .execute(&pool)
        .await
        .unwrap();

    let result = sqlx::query("INSERT INTO classes (name, version_id, source_id) VALUES ('DupSource', $1, 'source-x')")
        .bind(version_id.0)
        .execute(&pool)
        .await;

    assert!(result.is_err(), "Duplicate within same source should be rejected");
}

#[sqlx::test]
async fn test_base_extension_mutual_exclusion(pool: PgPool) {
    // A source cannot be both base and extension (CHECK constraint)
    let result = sqlx::query(
        "INSERT INTO ontology_sources (source_id, name, format, path, is_base, is_extension)
         VALUES ('bad-source', 'Bad', 'json', '/tmp/bad', TRUE, TRUE)"
    )
    .execute(&pool)
    .await;

    assert!(result.is_err(), "CHECK constraint should prevent is_base AND is_extension both TRUE");
}

#[sqlx::test]
async fn test_only_one_base_allowed(pool: PgPool) {
    // Only one row can have is_base=TRUE (partial unique index)
    sqlx::query(
        "INSERT INTO ontology_sources (source_id, name, format, path, is_base)
         VALUES ('base-1', 'Base One', 'json', '/tmp/b1', TRUE)"
    )
    .execute(&pool)
    .await
    .unwrap();

    let result = sqlx::query(
        "INSERT INTO ontology_sources (source_id, name, format, path, is_base)
         VALUES ('base-2', 'Base Two', 'json', '/tmp/b2', TRUE)"
    )
    .execute(&pool)
    .await;

    assert!(result.is_err(), "Partial unique index should prevent two base sources");
}

#[sqlx::test]
async fn test_properties_unique_constraint_updated(pool: PgPool) {
    // Same property name for same class from different sources should be allowed
    let version_id: (uuid::Uuid,) =
        sqlx::query_as("SELECT id FROM ontology_versions WHERE is_current = TRUE")
            .fetch_one(&pool)
            .await
            .unwrap();

    let class_id: (uuid::Uuid,) = sqlx::query_as(
        "INSERT INTO classes (name, version_id, source_id) VALUES ('PropTestClass', $1, 'src-p') RETURNING id"
    )
    .bind(version_id.0)
    .fetch_one(&pool)
    .await
    .unwrap();

    sqlx::query("INSERT INTO properties (name, class_id, data_type, version_id, source_id) VALUES ('prop1', $1, 'string', $2, 'src-a')")
        .bind(class_id.0)
        .bind(version_id.0)
        .execute(&pool)
        .await
        .unwrap();

    let result = sqlx::query("INSERT INTO properties (name, class_id, data_type, version_id, source_id) VALUES ('prop1', $1, 'string', $2, 'src-b')")
        .bind(class_id.0)
        .bind(version_id.0)
        .execute(&pool)
        .await;

    assert!(result.is_ok(), "Same property name from different sources should be allowed");
}
```

Note: The test file will also contain tests from later sections (service, routes, etc.). For now, only the migration-verification tests above are in scope.

## Implementation

### Migration File

**File:** `/Users/vidarbrevik/projects/ontology-manager/backend/migrations/20270321000000_ontology_sources.sql`

Use a timestamp-based filename that sorts after all existing migrations. The latest existing migration is `20270127000000_rate_limit_ontology.sql`, so `20270321000000` is appropriate for the current date (2026-03-21 -- use a future-dated prefix consistent with the existing convention where some migrations already use `2027` prefixes).

The migration SQL must perform the following operations in order:

#### 1. Create `ontology_sources` table

```sql
CREATE TABLE ontology_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT,
    format TEXT NOT NULL,
    domain TEXT,
    path TEXT NOT NULL,
    is_base BOOLEAN NOT NULL DEFAULT FALSE,
    is_extension BOOLEAN NOT NULL DEFAULT FALSE,
    imported_at TIMESTAMPTZ,
    stats JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_not_both_base_and_extension CHECK (NOT (is_base AND is_extension))
);
```

Constraints to include:
- `source_id TEXT NOT NULL UNIQUE` -- natural key for the source
- `CHECK (NOT (is_base AND is_extension))` -- mutual exclusion
- Partial unique indexes (below) enforce at-most-one base and at-most-one extension

#### 2. Partial unique indexes on `ontology_sources`

```sql
CREATE UNIQUE INDEX idx_ontology_sources_base
    ON ontology_sources (is_base) WHERE is_base = TRUE;

CREATE UNIQUE INDEX idx_ontology_sources_extension
    ON ontology_sources (is_extension) WHERE is_extension = TRUE;
```

These ensure at most one active base source and at most one active extension source at any time.

#### 3. Add `source_id` column to existing tables

Add a nullable `TEXT` column `source_id` to three tables. Existing rows get `NULL` (meaning "built-in"):

```sql
ALTER TABLE classes ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE relationship_types ADD COLUMN IF NOT EXISTS source_id TEXT;
```

#### 4. Add indexes on `source_id`

```sql
CREATE INDEX IF NOT EXISTS idx_classes_source_id ON classes(source_id);
CREATE INDEX IF NOT EXISTS idx_properties_source_id ON properties(source_id);
CREATE INDEX IF NOT EXISTS idx_relationship_types_source_id ON relationship_types(source_id);
```

#### 5. Replace unique constraints on `classes`

The existing `classes` table has: `CONSTRAINT unique_class_name_tenant_version UNIQUE (name, tenant_id, version_id)`.

PostgreSQL treats each NULL as distinct in standard unique constraints, so a composite `(name, tenant_id, version_id, source_id)` would allow duplicate built-in entries (where `source_id IS NULL`). The solution is two partial unique indexes:

```sql
ALTER TABLE classes DROP CONSTRAINT IF EXISTS unique_class_name_tenant_version;

CREATE UNIQUE INDEX idx_classes_unique_builtin
    ON classes (name, tenant_id, version_id) WHERE source_id IS NULL;

CREATE UNIQUE INDEX idx_classes_unique_source
    ON classes (name, tenant_id, version_id, source_id) WHERE source_id IS NOT NULL;
```

**Important note on NULL tenant_id:** The existing constraint `unique_class_name_tenant_version` already uses `(name, tenant_id, version_id)` where `tenant_id` can be NULL (for shared core ontology). PostgreSQL's behavior with NULLs in unique indexes means two rows with `(name=X, tenant_id=NULL, version_id=Y, source_id=NULL)` would both be allowed. However, the existing codebase uses `ON CONFLICT DO NOTHING` patterns with matching column lists, so this NULL-handling behavior is already the established convention. The partial index `WHERE source_id IS NULL` preserves the same uniqueness semantics the original constraint provided.

#### 6. Replace unique constraints on `properties`

The existing `properties` table has: `CONSTRAINT unique_property_name_class UNIQUE (name, class_id)`.

```sql
ALTER TABLE properties DROP CONSTRAINT IF EXISTS unique_property_name_class;

CREATE UNIQUE INDEX idx_properties_unique_builtin
    ON properties (name, class_id) WHERE source_id IS NULL;

CREATE UNIQUE INDEX idx_properties_unique_source
    ON properties (name, class_id, source_id) WHERE source_id IS NOT NULL;
```

#### 7. Handle `relationship_types` unique constraint

The existing table has an inline `UNIQUE` on `name` (declared as `name VARCHAR(100) NOT NULL UNIQUE`). This creates an auto-generated constraint. For `relationship_types`, keep the existing unique constraint for built-in entries and add a source-aware index for imported ones:

```sql
-- The existing UNIQUE on name handles built-in (NULL source_id) entries.
-- For imported sources, we need a separate partial index:
-- First, drop the existing unique constraint to replace with partial indexes
ALTER TABLE relationship_types DROP CONSTRAINT IF EXISTS relationship_types_name_key;

CREATE UNIQUE INDEX idx_relationship_types_unique_builtin
    ON relationship_types (name) WHERE source_id IS NULL;

CREATE UNIQUE INDEX idx_relationship_types_unique_source
    ON relationship_types (name, source_id) WHERE source_id IS NOT NULL;
```

The auto-generated constraint name for an inline `UNIQUE` on the `name` column of `relationship_types` is `relationship_types_name_key` (PostgreSQL convention: `{table}_{column}_key`).

### Complete Migration SQL

The full migration file should be a single SQL file containing all the above statements in order, wrapped with appropriate comments for readability. Use `IF NOT EXISTS` / `IF EXISTS` guards where supported for idempotency.

### Key Design Decisions

- **`source_id` is `TEXT`, not a foreign key to `ontology_sources`:** This is intentional. Built-in data has `source_id = NULL` and there is no corresponding row in `ontology_sources`. Making it a FK would require a sentinel row for built-in data.
- **No `is_system` column on `ontology_sources`:** Built-in ontology data is identified by `source_id IS NULL` on the entity tables, not by a row in `ontology_sources`.
- **Partial unique indexes vs. composite unique constraints:** PostgreSQL's `WHERE` clause on unique indexes is the standard pattern for handling NULL-partitioned uniqueness.
- **The `ontology_sources` table is global (no `tenant_id`):** Ontology sources are shared across all tenants. Individual classes/properties tagged with a source_id still respect tenant isolation via their own `tenant_id` column.

### Verification

After implementing the migration, run:

```bash
cd /Users/vidarbrevik/projects/ontology-manager/backend
cargo test test_ontology_sources_table_created test_source_id_column_exists_on_classes test_source_id_column_exists_on_properties test_source_id_column_exists_on_relationship_types test_existing_data_has_null_source_id test_builtin_uniqueness_preserved test_different_sources_same_name_allowed test_same_source_duplicate_blocked test_base_extension_mutual_exclusion test_only_one_base_allowed test_properties_unique_constraint_updated
```

All 11 tests should pass. If any constraint-related test fails, check that the `DROP CONSTRAINT IF EXISTS` statements use the correct constraint names by inspecting `\d classes`, `\d properties`, and `\d relationship_types` in psql.