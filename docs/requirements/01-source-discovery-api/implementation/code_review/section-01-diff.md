diff --git a/backend/migrations/20270321000000_ontology_sources.sql b/backend/migrations/20270321000000_ontology_sources.sql
new file mode 100644
index 0000000..a1b3cd1
--- /dev/null
+++ b/backend/migrations/20270321000000_ontology_sources.sql
@@ -0,0 +1,73 @@
+-- ============================================================================
+-- ONTOLOGY SOURCES: Multi-source ontology data infrastructure
+-- ============================================================================
+-- Enables the ontology-manager to work with multiple external ontology data
+-- sources. Each source is a directory on disk containing a manifest.json.
+-- Ontology entries (classes, properties, relationship_types) are tagged with
+-- a source_id to track which source they came from.
+-- ============================================================================
+
+-- 1. Create ontology_sources table (global, no tenant_id)
+CREATE TABLE IF NOT EXISTS ontology_sources (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    source_id TEXT NOT NULL UNIQUE,          -- natural key matching sources.json id
+    name TEXT NOT NULL,
+    description TEXT,
+    version TEXT,
+    format TEXT NOT NULL,                    -- "json" or "json-schema"
+    domain TEXT,
+    path TEXT NOT NULL,                      -- symlink path (not canonical)
+    is_base BOOLEAN NOT NULL DEFAULT FALSE,
+    is_extension BOOLEAN NOT NULL DEFAULT FALSE,
+    imported_at TIMESTAMPTZ,
+    stats JSONB,
+    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+    CONSTRAINT chk_not_both_base_and_extension CHECK (NOT (is_base AND is_extension))
+);
+
+-- 2. Partial unique indexes: at most one base, at most one extension
+CREATE UNIQUE INDEX IF NOT EXISTS idx_ontology_sources_base
+    ON ontology_sources (is_base) WHERE is_base = TRUE;
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_ontology_sources_extension
+    ON ontology_sources (is_extension) WHERE is_extension = TRUE;
+
+-- 3. Add source_id column to existing ontology tables
+ALTER TABLE classes ADD COLUMN IF NOT EXISTS source_id TEXT;
+ALTER TABLE properties ADD COLUMN IF NOT EXISTS source_id TEXT;
+ALTER TABLE relationship_types ADD COLUMN IF NOT EXISTS source_id TEXT;
+
+-- 4. Add indexes on source_id for query performance
+CREATE INDEX IF NOT EXISTS idx_classes_source_id ON classes(source_id);
+CREATE INDEX IF NOT EXISTS idx_properties_source_id ON properties(source_id);
+CREATE INDEX IF NOT EXISTS idx_relationship_types_source_id ON relationship_types(source_id);
+
+-- 5. Replace unique constraint on classes with NULL-safe partial indexes
+-- PostgreSQL treats NULL as distinct in unique constraints, so we need two
+-- partial indexes: one for built-in (NULL source_id), one for imported.
+ALTER TABLE classes DROP CONSTRAINT IF EXISTS unique_class_name_tenant_version;
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_unique_builtin
+    ON classes (name, tenant_id, version_id) WHERE source_id IS NULL;
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_unique_source
+    ON classes (name, tenant_id, version_id, source_id) WHERE source_id IS NOT NULL;
+
+-- 6. Replace unique constraint on properties
+ALTER TABLE properties DROP CONSTRAINT IF EXISTS unique_property_name_class;
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_unique_builtin
+    ON properties (name, class_id) WHERE source_id IS NULL;
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_unique_source
+    ON properties (name, class_id, source_id) WHERE source_id IS NOT NULL;
+
+-- 7. Replace unique constraint on relationship_types
+ALTER TABLE relationship_types DROP CONSTRAINT IF EXISTS relationship_types_name_key;
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_relationship_types_unique_builtin
+    ON relationship_types (name) WHERE source_id IS NULL;
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_relationship_types_unique_source
+    ON relationship_types (name, source_id) WHERE source_id IS NOT NULL;
diff --git a/backend/tests/ontology_sources_test.rs b/backend/tests/ontology_sources_test.rs
new file mode 100644
index 0000000..359117c
--- /dev/null
+++ b/backend/tests/ontology_sources_test.rs
@@ -0,0 +1,176 @@
+use sqlx::PgPool;
+
+mod common;
+
+// --- Section 01: Migration verification tests ---
+
+#[sqlx::test]
+async fn test_ontology_sources_table_created(pool: PgPool) {
+    let result = sqlx::query("SELECT id, source_id, name, is_base, is_extension FROM ontology_sources LIMIT 0")
+        .fetch_all(&pool)
+        .await;
+    assert!(result.is_ok(), "ontology_sources table should exist after migration");
+}
+
+#[sqlx::test]
+async fn test_source_id_column_exists_on_classes(pool: PgPool) {
+    let result = sqlx::query("SELECT source_id FROM classes LIMIT 1")
+        .fetch_all(&pool)
+        .await;
+    assert!(result.is_ok(), "classes.source_id column should exist");
+}
+
+#[sqlx::test]
+async fn test_source_id_column_exists_on_properties(pool: PgPool) {
+    let result = sqlx::query("SELECT source_id FROM properties LIMIT 1")
+        .fetch_all(&pool)
+        .await;
+    assert!(result.is_ok(), "properties.source_id column should exist");
+}
+
+#[sqlx::test]
+async fn test_source_id_column_exists_on_relationship_types(pool: PgPool) {
+    let result = sqlx::query("SELECT source_id FROM relationship_types LIMIT 1")
+        .fetch_all(&pool)
+        .await;
+    assert!(result.is_ok(), "relationship_types.source_id column should exist");
+}
+
+#[sqlx::test]
+async fn test_existing_data_has_null_source_id(pool: PgPool) {
+    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM classes WHERE source_id IS NOT NULL")
+        .fetch_one(&pool)
+        .await
+        .unwrap();
+    assert_eq!(row.0, 0, "All pre-existing classes should have NULL source_id");
+}
+
+#[sqlx::test]
+async fn test_builtin_uniqueness_preserved(pool: PgPool) {
+    let version_id: (uuid::Uuid,) =
+        sqlx::query_as("SELECT id FROM ontology_versions WHERE is_current = TRUE")
+            .fetch_one(&pool)
+            .await
+            .unwrap();
+
+    sqlx::query("INSERT INTO classes (name, version_id) VALUES ('DuplicateTest', $1)")
+        .bind(version_id.0)
+        .execute(&pool)
+        .await
+        .unwrap();
+
+    let result = sqlx::query("INSERT INTO classes (name, version_id) VALUES ('DuplicateTest', $1)")
+        .bind(version_id.0)
+        .execute(&pool)
+        .await;
+
+    assert!(result.is_err(), "Duplicate built-in class name should be rejected");
+}
+
+#[sqlx::test]
+async fn test_different_sources_same_name_allowed(pool: PgPool) {
+    let version_id: (uuid::Uuid,) =
+        sqlx::query_as("SELECT id FROM ontology_versions WHERE is_current = TRUE")
+            .fetch_one(&pool)
+            .await
+            .unwrap();
+
+    sqlx::query("INSERT INTO classes (name, version_id, source_id) VALUES ('SharedName', $1, 'source-a')")
+        .bind(version_id.0)
+        .execute(&pool)
+        .await
+        .unwrap();
+
+    let result = sqlx::query("INSERT INTO classes (name, version_id, source_id) VALUES ('SharedName', $1, 'source-b')")
+        .bind(version_id.0)
+        .execute(&pool)
+        .await;
+
+    assert!(result.is_ok(), "Same name with different source_id should be allowed");
+}
+
+#[sqlx::test]
+async fn test_same_source_duplicate_blocked(pool: PgPool) {
+    let version_id: (uuid::Uuid,) =
+        sqlx::query_as("SELECT id FROM ontology_versions WHERE is_current = TRUE")
+            .fetch_one(&pool)
+            .await
+            .unwrap();
+
+    sqlx::query("INSERT INTO classes (name, version_id, source_id) VALUES ('DupSource', $1, 'source-x')")
+        .bind(version_id.0)
+        .execute(&pool)
+        .await
+        .unwrap();
+
+    let result = sqlx::query("INSERT INTO classes (name, version_id, source_id) VALUES ('DupSource', $1, 'source-x')")
+        .bind(version_id.0)
+        .execute(&pool)
+        .await;
+
+    assert!(result.is_err(), "Duplicate within same source should be rejected");
+}
+
+#[sqlx::test]
+async fn test_base_extension_mutual_exclusion(pool: PgPool) {
+    let result = sqlx::query(
+        "INSERT INTO ontology_sources (source_id, name, format, path, is_base, is_extension)
+         VALUES ('bad-source', 'Bad', 'json', '/tmp/bad', TRUE, TRUE)"
+    )
+    .execute(&pool)
+    .await;
+
+    assert!(result.is_err(), "CHECK constraint should prevent is_base AND is_extension both TRUE");
+}
+
+#[sqlx::test]
+async fn test_only_one_base_allowed(pool: PgPool) {
+    sqlx::query(
+        "INSERT INTO ontology_sources (source_id, name, format, path, is_base)
+         VALUES ('base-1', 'Base One', 'json', '/tmp/b1', TRUE)"
+    )
+    .execute(&pool)
+    .await
+    .unwrap();
+
+    let result = sqlx::query(
+        "INSERT INTO ontology_sources (source_id, name, format, path, is_base)
+         VALUES ('base-2', 'Base Two', 'json', '/tmp/b2', TRUE)"
+    )
+    .execute(&pool)
+    .await;
+
+    assert!(result.is_err(), "Partial unique index should prevent two base sources");
+}
+
+#[sqlx::test]
+async fn test_properties_unique_constraint_updated(pool: PgPool) {
+    let version_id: (uuid::Uuid,) =
+        sqlx::query_as("SELECT id FROM ontology_versions WHERE is_current = TRUE")
+            .fetch_one(&pool)
+            .await
+            .unwrap();
+
+    let class_id: (uuid::Uuid,) = sqlx::query_as(
+        "INSERT INTO classes (name, version_id, source_id) VALUES ('PropTestClass', $1, 'src-p') RETURNING id"
+    )
+    .bind(version_id.0)
+    .fetch_one(&pool)
+    .await
+    .unwrap();
+
+    sqlx::query("INSERT INTO properties (name, class_id, data_type, version_id, source_id) VALUES ('prop1', $1, 'string', $2, 'src-a')")
+        .bind(class_id.0)
+        .bind(version_id.0)
+        .execute(&pool)
+        .await
+        .unwrap();
+
+    let result = sqlx::query("INSERT INTO properties (name, class_id, data_type, version_id, source_id) VALUES ('prop1', $1, 'string', $2, 'src-b')")
+        .bind(class_id.0)
+        .bind(version_id.0)
+        .execute(&pool)
+        .await;
+
+    assert!(result.is_ok(), "Same property name from different sources should be allowed");
+}
