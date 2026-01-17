use sqlx::PgPool;
use template_repo_backend::features::system::AuditService;
use uuid::Uuid;
use std::time::Duration;

mod common;

#[sqlx::test]
async fn test_security_event_graph_creation(pool: PgPool) {
    // 1. Setup
    let _services = common::setup_services(pool.clone()).await;
    let audit_service = AuditService::new(pool.clone());

    // Create a dummy user entity (assuming migration already provided one, or we create one)
    // For this test, let's create a fresh user and ensure their entity exists
    let user_id = Uuid::new_v4();
    
    // Create User Entity manually for test if not exists
    // (In real app, auth service creates user, bridging creates entity)
    let sys_version = sqlx::query_scalar!("SELECT id FROM ontology_versions WHERE is_system = TRUE")
        .fetch_one(&pool)
        .await
        .unwrap();
    let user_class_id = sqlx::query_scalar!("SELECT id FROM classes WHERE name = 'User' AND version_id = $1", sys_version)
        .fetch_one(&pool)
        .await
        .unwrap();
        
    sqlx::query!(
        "INSERT INTO entities (id, class_id, display_name, attributes) VALUES ($1, $2, 'Test Actor', '{}')",
        user_id, user_class_id
    )
    .execute(&pool)
    .await
    .expect("Failed to create user entity");

    // Create a dummy user in 'users' table because AuditServiceFK constraint requires it
    sqlx::query!(
        "INSERT INTO users (id, username, email, password_hash) VALUES ($1, 'test_actor', 'test@actor', 'hash')",
        user_id
    )
    .execute(&pool)
    .await
    .expect("Failed to create user");

    // 2. Perform Action (Log)
    let action = "TEST_LOGIN_SUCCESS";
    let target_type = "system";
    let metadata = serde_json::json!({"ip": "127.0.0.1"});

    let log = audit_service.log(
        user_id,
        action,
        target_type,
        None,
        None,
        None,
        Some(metadata)
    )
    .await
    .expect("Log failed");

    // 3. Verify Ontology (Wait for async spawn)
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Check SecurityEvent Entity
    let event_exists = sqlx::query!(
        r#"
        SELECT e.id, e.display_name, e.attributes 
        FROM entities e
        JOIN classes c ON e.class_id = c.id
        WHERE c.name = 'SecurityEvent' 
        AND e.attributes->>'action' = $1
        "#,
        action
    )
    .fetch_optional(&pool)
    .await
    .unwrap();

    assert!(event_exists.is_some(), "SecurityEvent entity should be created");
    let event = event_exists.unwrap();
    assert_eq!(event.display_name, format!("SecurityEvent: {}", action));

    // Check Relationship (initiated_by)
    let rel_exists = sqlx::query!(
        r#"
        SELECT count(*) as count
        FROM relationships r
        JOIN relationship_types rt ON r.relationship_type_id = rt.id
        WHERE r.source_entity_id = $1 
        AND r.target_entity_id = $2
        AND rt.name = 'initiated_by'
        "#,
        event.id,
        user_id
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(rel_exists.count.unwrap(), 1, "initiated_by relationship should exist");
}

#[sqlx::test]
async fn test_security_event_target_relationship(pool: PgPool) {
    // 1. Setup
    let _services = common::setup_services(pool.clone()).await;
    let audit_service = AuditService::new(pool.clone());
    let user_id = Uuid::new_v4();

    // Get needed IDs
    let sys_version = sqlx::query_scalar!("SELECT id FROM ontology_versions WHERE is_system = TRUE")
        .fetch_one(&pool)
        .await
        .unwrap();
    let user_class_id = sqlx::query_scalar!("SELECT id FROM classes WHERE name = 'User' AND version_id = $1", sys_version)
        .fetch_one(&pool)
        .await
        .unwrap();
    let context_class_id = sqlx::query_scalar!("SELECT id FROM classes WHERE name = 'Context' AND version_id = $1", sys_version)
        .fetch_one(&pool)
        .await
        .unwrap();

    // Create User Entity & User Record
    sqlx::query!(
        "INSERT INTO entities (id, class_id, display_name, attributes) VALUES ($1, $2, 'Test Actor', '{}')",
        user_id, user_class_id
    )
    .execute(&pool)
    .await.unwrap();

    sqlx::query!(
        "INSERT INTO users (id, username, email, password_hash) VALUES ($1, 'test_actor2', 'test2@actor', 'hash')",
        user_id
    )
    .execute(&pool)
    .await.unwrap();

    // Create Target Entity (e.g., a Context/Mission)
    let target_id = Uuid::new_v4();
    sqlx::query!(
        "INSERT INTO entities (id, class_id, display_name, attributes) VALUES ($1, $2, 'Target Mission', '{}')",
        target_id, context_class_id
    )
    .execute(&pool)
    .await.unwrap();

    // 2. Perform Action with Target
    let action = "TEST_TARGET_ACCESS";
    let _log = audit_service.log(
        user_id,
        action,
        "mission",
        Some(target_id),
        None,
        None,
        None
    )
    .await
    .expect("Log failed");

    // 3. Verify Ontology
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Find Event
    let event = sqlx::query!(
        r#"
        SELECT e.id 
        FROM entities e
        JOIN classes c ON e.class_id = c.id
        WHERE c.name = 'SecurityEvent' 
        AND e.attributes->>'action' = $1
        "#,
        action
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    // Check affected_target relationship
    let rel_exists = sqlx::query!(
        r#"
        SELECT count(*) as count
        FROM relationships r
        JOIN relationship_types rt ON r.relationship_type_id = rt.id
        WHERE r.source_entity_id = $1 
        AND r.target_entity_id = $2
        AND rt.name = 'affected_target'
        "#,
        event.id,
        target_id
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(rel_exists.count.unwrap(), 1, "affected_target relationship should exist");
}
