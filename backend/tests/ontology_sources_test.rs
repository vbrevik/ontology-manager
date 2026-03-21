use sqlx::PgPool;

mod common;

// --- Section 01: Migration verification tests ---

#[sqlx::test]
async fn test_ontology_sources_table_created(pool: PgPool) {
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
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM classes WHERE source_id IS NOT NULL")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(row.0, 0, "All pre-existing classes should have NULL source_id");
}

#[sqlx::test]
async fn test_builtin_uniqueness_preserved(pool: PgPool) {
    let version_id: (uuid::Uuid,) =
        sqlx::query_as("SELECT id FROM ontology_versions WHERE is_current = TRUE")
            .fetch_one(&pool)
            .await
            .unwrap();

    // Use a fixed tenant_id to avoid NULL-distinct behavior in unique indexes
    let tenant_id = uuid::Uuid::new_v4();

    sqlx::query("INSERT INTO classes (name, version_id, tenant_id) VALUES ('DuplicateTest', $1, $2)")
        .bind(version_id.0)
        .bind(tenant_id)
        .execute(&pool)
        .await
        .unwrap();

    let result = sqlx::query("INSERT INTO classes (name, version_id, tenant_id) VALUES ('DuplicateTest', $1, $2)")
        .bind(version_id.0)
        .bind(tenant_id)
        .execute(&pool)
        .await;

    assert!(result.is_err(), "Duplicate built-in class name should be rejected");
}

#[sqlx::test]
async fn test_different_sources_same_name_allowed(pool: PgPool) {
    let version_id: (uuid::Uuid,) =
        sqlx::query_as("SELECT id FROM ontology_versions WHERE is_current = TRUE")
            .fetch_one(&pool)
            .await
            .unwrap();

    // Use same tenant_id so source_id is the differentiator
    let tenant_id = uuid::Uuid::new_v4();

    sqlx::query("INSERT INTO classes (name, version_id, tenant_id, source_id) VALUES ('SharedName', $1, $2, 'source-a')")
        .bind(version_id.0)
        .bind(tenant_id)
        .execute(&pool)
        .await
        .unwrap();

    let result = sqlx::query("INSERT INTO classes (name, version_id, tenant_id, source_id) VALUES ('SharedName', $1, $2, 'source-b')")
        .bind(version_id.0)
        .bind(tenant_id)
        .execute(&pool)
        .await;

    assert!(result.is_ok(), "Same name with different source_id should be allowed");
}

#[sqlx::test]
async fn test_same_source_duplicate_blocked(pool: PgPool) {
    let version_id: (uuid::Uuid,) =
        sqlx::query_as("SELECT id FROM ontology_versions WHERE is_current = TRUE")
            .fetch_one(&pool)
            .await
            .unwrap();

    let tenant_id = uuid::Uuid::new_v4();

    sqlx::query("INSERT INTO classes (name, version_id, tenant_id, source_id) VALUES ('DupSource', $1, $2, 'source-x')")
        .bind(version_id.0)
        .bind(tenant_id)
        .execute(&pool)
        .await
        .unwrap();

    let result = sqlx::query("INSERT INTO classes (name, version_id, tenant_id, source_id) VALUES ('DupSource', $1, $2, 'source-x')")
        .bind(version_id.0)
        .bind(tenant_id)
        .execute(&pool)
        .await;

    assert!(result.is_err(), "Duplicate within same source should be rejected");
}

#[sqlx::test]
async fn test_base_extension_mutual_exclusion(pool: PgPool) {
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
async fn test_only_one_extension_allowed(pool: PgPool) {
    sqlx::query(
        "INSERT INTO ontology_sources (source_id, name, format, path, is_extension)
         VALUES ('ext-1', 'Ext One', 'json', '/tmp/e1', TRUE)"
    )
    .execute(&pool)
    .await
    .unwrap();

    let result = sqlx::query(
        "INSERT INTO ontology_sources (source_id, name, format, path, is_extension)
         VALUES ('ext-2', 'Ext Two', 'json', '/tmp/e2', TRUE)"
    )
    .execute(&pool)
    .await;

    assert!(result.is_err(), "Partial unique index should prevent two extension sources");
}

#[sqlx::test]
async fn test_properties_unique_constraint_updated(pool: PgPool) {
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
