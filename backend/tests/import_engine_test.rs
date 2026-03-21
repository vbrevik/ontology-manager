use sqlx::PgPool;
use std::collections::HashMap;
use tempfile::TempDir;
use template_repo_backend::features::import_engine::ImportService;

mod common;

// ============================================================================
// HELPERS
// ============================================================================

fn create_manifest(format: &str, files: &[(&str, &str)]) -> String {
    let files_map: HashMap<&str, &str> = files.iter().copied().collect();
    serde_json::json!({
        "name": "test-source",
        "version": "1.0",
        "description": "Test source",
        "type": "base",
        "format": format,
        "files": files_map
    })
    .to_string()
}

fn create_json_source_dir() -> TempDir {
    let dir = TempDir::new().unwrap();

    let classes = r#"{"classes": [
        {"name": "Entity", "is_abstract": true, "is_system": true, "description": "Root entity"},
        {"name": "Person", "parent": "Entity", "is_abstract": false, "is_system": true, "description": "A person"}
    ]}"#;

    let properties = r#"{"properties": {
        "Person": [
            {"name": "rank", "type": "string", "required": true},
            {"name": "callsign", "type": "string", "required": false}
        ]
    }}"#;

    let relationship_types = r#"{"relationship_types": [
        {"name": "commands", "source_class": "Person", "target_class": "Person", "cardinality": "one:many", "grants_permission_inheritance": false}
    ]}"#;

    let manifest = create_manifest(
        "json",
        &[
            ("classes", "classes.json"),
            ("properties", "properties.json"),
            ("relationship_types", "relationship_types.json"),
        ],
    );

    std::fs::write(dir.path().join("classes.json"), classes).unwrap();
    std::fs::write(dir.path().join("properties.json"), properties).unwrap();
    std::fs::write(dir.path().join("relationship_types.json"), relationship_types).unwrap();
    std::fs::write(dir.path().join("manifest.json"), manifest).unwrap();

    dir
}

async fn insert_source_row(pool: &PgPool, source_id: &str, path: &str, format: &str) {
    sqlx::query(
        r#"INSERT INTO ontology_sources (source_id, name, description, version, format, path, is_base, is_extension)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE, FALSE)"#,
    )
    .bind(source_id)
    .bind(format!("Test {}", source_id))
    .bind("Test source")
    .bind("1.0")
    .bind(format)
    .bind(path)
    .execute(pool)
    .await
    .unwrap();
}

// ============================================================================
// MIGRATION VERIFICATION
// ============================================================================

#[sqlx::test]
async fn test_is_system_column_exists(pool: PgPool) {
    sqlx::query("SELECT is_system FROM classes LIMIT 0")
        .execute(&pool)
        .await
        .expect("is_system column should exist on classes table");
}

#[sqlx::test]
async fn test_is_system_defaults_false(pool: PgPool) {
    let version_id = sqlx::query_scalar::<_, uuid::Uuid>(
        "SELECT id FROM ontology_versions WHERE is_current = TRUE",
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO classes (name, version_id, is_abstract) VALUES ('TestDefaultClass', $1, FALSE)",
    )
    .bind(version_id)
    .execute(&pool)
    .await
    .unwrap();

    let is_system = sqlx::query_scalar::<_, bool>(
        "SELECT is_system FROM classes WHERE name = 'TestDefaultClass'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    assert!(!is_system, "is_system should default to false");
}

#[sqlx::test]
async fn test_source_conflicts_table_created(pool: PgPool) {
    sqlx::query("SELECT * FROM source_conflicts LIMIT 0")
        .execute(&pool)
        .await
        .expect("source_conflicts table should exist");
}

#[sqlx::test]
async fn test_source_conflicts_columns(pool: PgPool) {
    sqlx::query(
        "SELECT id, base_source_id, extension_source_id, entity_type, entity_name, resolution, created_at FROM source_conflicts LIMIT 0",
    )
    .execute(&pool)
    .await
    .expect("All expected columns should exist");
}

// ============================================================================
// SERVICE INTEGRATION TESTS
// ============================================================================

#[sqlx::test]
async fn test_import_json_source(pool: PgPool) {
    let dir = create_json_source_dir();
    let data_dir = dir.path().parent().unwrap().to_path_buf();
    let rel_path = dir.path().file_name().unwrap().to_str().unwrap();

    insert_source_row(&pool, "test-base", rel_path, "json").await;

    let svc = ImportService::new(pool.clone(), data_dir);
    let result = svc.import_source("test-base", "base").await.unwrap();

    assert_eq!(result.source_id, "test-base");
    assert_eq!(result.role, "base");
    assert_eq!(result.imported.classes, 2);
    assert_eq!(result.imported.properties, 2);
    assert_eq!(result.imported.relationship_types, 1);
    assert!(result.conflicts.is_empty());

    // Verify DB state
    let class_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM classes WHERE source_id = 'test-base'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(class_count, 2);

    let is_base = sqlx::query_scalar::<_, bool>(
        "SELECT is_base FROM ontology_sources WHERE source_id = 'test-base'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(is_base);
}

#[sqlx::test]
async fn test_import_then_unload(pool: PgPool) {
    let dir = create_json_source_dir();
    let data_dir = dir.path().parent().unwrap().to_path_buf();
    let rel_path = dir.path().file_name().unwrap().to_str().unwrap();

    insert_source_row(&pool, "test-unload", rel_path, "json").await;

    let svc = ImportService::new(pool.clone(), data_dir);
    svc.import_source("test-unload", "base").await.unwrap();

    let result = svc.unload_source("test-unload").await.unwrap();
    assert_eq!(result.removed.classes, 2);
    assert_eq!(result.removed.properties, 2);
    assert_eq!(result.removed.relationship_types, 1);

    // Verify all data is gone
    let class_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM classes WHERE source_id = 'test-unload'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(class_count, 0);

    // Verify flags cleared
    let imported_at = sqlx::query_scalar::<_, Option<chrono::DateTime<chrono::Utc>>>(
        "SELECT imported_at FROM ontology_sources WHERE source_id = 'test-unload'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(imported_at.is_none());
}

#[sqlx::test]
async fn test_clean_swap_reimport(pool: PgPool) {
    let dir = create_json_source_dir(); // has Entity, Person
    let data_dir = dir.path().parent().unwrap().to_path_buf();
    let rel_path = dir.path().file_name().unwrap().to_str().unwrap();

    insert_source_row(&pool, "test-swap", rel_path, "json").await;

    let svc = ImportService::new(pool.clone(), data_dir.clone());
    svc.import_source("test-swap", "base").await.unwrap();

    // Rewrite classes file with different data
    let new_classes = r#"{"classes": [
        {"name": "Entity", "is_abstract": true, "is_system": true},
        {"name": "Unit", "parent": "Entity", "is_abstract": false, "is_system": true},
        {"name": "Vehicle", "parent": "Entity", "is_abstract": false, "is_system": true}
    ]}"#;
    std::fs::write(dir.path().join("classes.json"), new_classes).unwrap();

    // Re-import
    let result = svc.import_source("test-swap", "base").await.unwrap();
    assert_eq!(result.imported.classes, 3);

    // Verify Person is gone, Unit and Vehicle exist
    let person_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM classes WHERE name = 'Person' AND source_id = 'test-swap'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(person_count, 0);

    let total_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM classes WHERE source_id = 'test-swap'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(total_count, 3);
}

#[sqlx::test]
async fn test_import_nonexistent_source(pool: PgPool) {
    let svc = ImportService::new(pool.clone(), std::path::PathBuf::from("/tmp"));
    let result = svc.import_source("nonexistent", "base").await;
    assert!(result.is_err());
    assert!(matches!(
        result.unwrap_err(),
        template_repo_backend::features::import_engine::ImportError::NotFound(_)
    ));
}

#[sqlx::test]
async fn test_extension_without_base(pool: PgPool) {
    let dir = create_json_source_dir();
    let data_dir = dir.path().parent().unwrap().to_path_buf();
    let rel_path = dir.path().file_name().unwrap().to_str().unwrap();

    insert_source_row(&pool, "test-ext", rel_path, "json").await;

    let svc = ImportService::new(pool.clone(), data_dir);
    let result = svc.import_source("test-ext", "extension").await;
    assert!(result.is_err());
    assert!(matches!(
        result.unwrap_err(),
        template_repo_backend::features::import_engine::ImportError::InvalidInput(_)
    ));
}

#[sqlx::test]
async fn test_import_sets_flags_atomically(pool: PgPool) {
    let dir_a = create_json_source_dir();
    let dir_b = create_json_source_dir();
    let data_dir_a = dir_a.path().parent().unwrap().to_path_buf();
    let data_dir_b = dir_b.path().parent().unwrap().to_path_buf();
    let rel_a = dir_a.path().file_name().unwrap().to_str().unwrap();
    let rel_b = dir_b.path().file_name().unwrap().to_str().unwrap();

    insert_source_row(&pool, "source-a", rel_a, "json").await;
    insert_source_row(&pool, "source-b", rel_b, "json").await;

    let svc_a = ImportService::new(pool.clone(), data_dir_a);
    svc_a.import_source("source-a", "base").await.unwrap();

    let svc_b = ImportService::new(pool.clone(), data_dir_b);
    svc_b.import_source("source-b", "base").await.unwrap();

    // Source A should no longer be base
    let a_is_base = sqlx::query_scalar::<_, bool>(
        "SELECT is_base FROM ontology_sources WHERE source_id = 'source-a'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(!a_is_base);

    // Source B should be base
    let b_is_base = sqlx::query_scalar::<_, bool>(
        "SELECT is_base FROM ontology_sources WHERE source_id = 'source-b'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(b_is_base);
}
