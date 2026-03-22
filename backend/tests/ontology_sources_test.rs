use sqlx::PgPool;
use std::path::PathBuf;
use template_repo_backend::features::ontology_sources::{
    OntologySourceService, SetActiveInput,
};

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

// --- Section 03: Service integration tests ---

/// Helper to insert a source row directly for service tests
async fn insert_source(pool: &PgPool, source_id: &str, name: &str) {
    sqlx::query(
        "INSERT INTO ontology_sources (source_id, name, format, path) VALUES ($1, $2, 'json', '/tmp/test')",
    )
    .bind(source_id)
    .bind(name)
    .execute(pool)
    .await
    .unwrap();
}

#[sqlx::test]
async fn test_set_base_source(pool: PgPool) {
    insert_source(&pool, "src-1", "Source One").await;

    let svc = OntologySourceService::new(pool.clone(), PathBuf::from("/tmp"));
    svc.set_active_sources(SetActiveInput {
        base: Some("src-1".to_string()),
        extension: None,
    })
    .await
    .unwrap();

    let active = svc.get_active_sources().await.unwrap();
    assert!(active.base.is_some());
    assert_eq!(active.base.unwrap().id, "src-1");
    assert!(active.extension.is_none());
}

#[sqlx::test]
async fn test_set_base_clears_previous(pool: PgPool) {
    insert_source(&pool, "src-1", "Source One").await;
    insert_source(&pool, "src-2", "Source Two").await;

    let svc = OntologySourceService::new(pool.clone(), PathBuf::from("/tmp"));

    svc.set_active_sources(SetActiveInput {
        base: Some("src-1".to_string()),
        extension: None,
    })
    .await
    .unwrap();

    svc.set_active_sources(SetActiveInput {
        base: Some("src-2".to_string()),
        extension: None,
    })
    .await
    .unwrap();

    let active = svc.get_active_sources().await.unwrap();
    assert_eq!(active.base.unwrap().id, "src-2");
}

#[sqlx::test]
async fn test_set_extension(pool: PgPool) {
    insert_source(&pool, "src-1", "Base").await;
    insert_source(&pool, "src-2", "Extension").await;

    let svc = OntologySourceService::new(pool.clone(), PathBuf::from("/tmp"));
    svc.set_active_sources(SetActiveInput {
        base: Some("src-1".to_string()),
        extension: Some("src-2".to_string()),
    })
    .await
    .unwrap();

    let active = svc.get_active_sources().await.unwrap();
    assert_eq!(active.base.as_ref().unwrap().id, "src-1");
    assert!(active.base.as_ref().unwrap().is_base);
    assert_eq!(active.extension.as_ref().unwrap().id, "src-2");
    assert!(active.extension.as_ref().unwrap().is_extension);
}

#[sqlx::test]
async fn test_set_base_null_clears(pool: PgPool) {
    insert_source(&pool, "src-1", "Source One").await;

    let svc = OntologySourceService::new(pool.clone(), PathBuf::from("/tmp"));

    svc.set_active_sources(SetActiveInput {
        base: Some("src-1".to_string()),
        extension: None,
    })
    .await
    .unwrap();

    svc.set_active_sources(SetActiveInput {
        base: None,
        extension: None,
    })
    .await
    .unwrap();

    let active = svc.get_active_sources().await.unwrap();
    assert!(active.base.is_none());
    assert!(active.extension.is_none());
}

#[sqlx::test]
async fn test_get_active_empty(pool: PgPool) {
    let svc = OntologySourceService::new(pool.clone(), PathBuf::from("/tmp"));
    let active = svc.get_active_sources().await.unwrap();
    assert!(active.base.is_none());
    assert!(active.extension.is_none());
}

#[sqlx::test]
async fn test_sync_sources_upsert(pool: PgPool) {
    use template_repo_backend::features::ontology_sources::service::DiscoveredSource;

    let svc = OntologySourceService::new(pool.clone(), PathBuf::from("/tmp"));

    let sources = vec![
        DiscoveredSource {
            source_id: "upsert-1".to_string(),
            name: "First".to_string(),
            description: Some("First source".to_string()),
            version: Some("1.0.0".to_string()),
            format: "json".to_string(),
            domain: None,
            path: "/tmp/first".to_string(),
            stats: None,
            available: true,
        },
        DiscoveredSource {
            source_id: "upsert-2".to_string(),
            name: "Second".to_string(),
            description: None,
            version: None,
            format: "json-schema".to_string(),
            domain: Some("military".to_string()),
            path: "/tmp/second".to_string(),
            stats: None,
            available: true,
        },
    ];

    // First sync
    svc.sync_sources_to_db(&sources).await.unwrap();

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ontology_sources WHERE source_id IN ('upsert-1', 'upsert-2')")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count.0, 2);

    // Second sync — should upsert, not duplicate
    svc.sync_sources_to_db(&sources).await.unwrap();

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ontology_sources WHERE source_id IN ('upsert-1', 'upsert-2')")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count.0, 2, "Re-sync should not create duplicates");

    // Verify updated_at was refreshed on second sync
    let row: (chrono::DateTime<chrono::Utc>,) = sqlx::query_as(
        "SELECT updated_at FROM ontology_sources WHERE source_id = 'upsert-1'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    // updated_at should be recent (within last 5 seconds)
    let now = chrono::Utc::now();
    assert!(
        (now - row.0).num_seconds() < 5,
        "updated_at should be refreshed on re-sync"
    );
}

#[sqlx::test]
async fn test_set_same_source_as_base_and_extension(pool: PgPool) {
    insert_source(&pool, "src-1", "Source One").await;

    let svc = OntologySourceService::new(pool.clone(), PathBuf::from("/tmp"));
    let result = svc
        .set_active_sources(SetActiveInput {
            base: Some("src-1".to_string()),
            extension: Some("src-1".to_string()),
        })
        .await;

    assert!(result.is_err(), "Same source as both base and extension should be rejected");
}

#[sqlx::test]
async fn test_set_active_nonexistent_source(pool: PgPool) {
    let svc = OntologySourceService::new(pool.clone(), PathBuf::from("/tmp"));
    let result = svc
        .set_active_sources(SetActiveInput {
            base: Some("nonexistent".to_string()),
            extension: None,
        })
        .await;

    assert!(result.is_err(), "Setting nonexistent source should return NotFound");
}

// --- Section 06: Config and integration tests ---

#[test]
fn test_config_default_data_dir() {
    let config = common::create_test_config();
    assert_eq!(config.ontology_data_dir, "./test-data");
}

#[sqlx::test]
async fn test_service_in_test_services(pool: PgPool) {
    let services = common::setup_services(pool).await;
    // Compile-time check that source_service field exists and is usable
    let active = services.source_service.get_active_sources().await.unwrap();
    assert!(active.base.is_none());
    assert!(active.extension.is_none());
}
