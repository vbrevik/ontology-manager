use sqlx::PgPool;
use template_repo_backend::features::ontology::models::{
    CreateClassInput, CreateEntityInput, CreateRelationshipInput,
};

mod common;

#[sqlx::test]
async fn test_create_class_and_entity(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    // We need a user ID for "created_by"
    // Create a dummy user directly in DB to satisfy FK
    let user_id = uuid::Uuid::new_v4();
    let email = format!("test_{}@example.com", user_id);
    let username = format!("user_{}", user_id.simple());

    // Hash password (dummy)
    let password_hash = "dummy_hash";

    let user_class_id = sqlx::query_scalar!("SELECT id FROM classes WHERE name = 'User' LIMIT 1")
        .fetch_one(&pool).await.expect("User class not found");

    sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes) VALUES ($1, $2, $3, $4)")
        .bind(user_id)
        .bind(user_class_id)
        .bind(&username)
        .bind(serde_json::json!({"username": username, "email": email}))
        .execute(&pool)
        .await
        .expect("Failed to create dummy user entity");

    // 1. Create a Class
    let class_input = CreateClassInput {
        name: "TestMission".to_string(),
        description: Some("A test mission class".to_string()),
        parent_class_id: None,
        is_abstract: Some(false),
    };

    let class = services
        .ontology_service
        .create_class(class_input, Some(user_id))
        .await
        .expect("Failed to create class");

    assert_eq!(class.name, "TestMission");

    // 2. Create an Entity of that Class
    let entity_input = CreateEntityInput {
        class_id: class.id,
        display_name: "Operation Alpha".to_string(),
        parent_entity_id: None,
        attributes: Some(serde_json::json!({"priority": "high"})),
    };

    let entity = services
        .ontology_service
        .create_entity(entity_input, Some(user_id), None)
        .await
        .expect("Failed to create entity");

    assert_eq!(entity.display_name, "Operation Alpha");
    assert_eq!(entity.class_id, class.id);
}

#[sqlx::test]
async fn test_relationship_creation(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = uuid::Uuid::new_v4();

    // Create dummy user
    let user_class_id = sqlx::query_scalar!("SELECT id FROM classes WHERE name = 'User' LIMIT 1")
        .fetch_one(&pool).await.expect("User class not found");

    let username = format!("rel_user_{}", user_id.simple());
    let email = format!("rel_test_{}@example.com", user_id);

    sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes) VALUES ($1, $2, $3, $4)")
        .bind(user_id)
        .bind(user_class_id)
        .bind(&username)
        .bind(serde_json::json!({"username": username, "email": email}))
        .execute(&pool)
        .await
        .expect("Failed to create dummy user entity");

    // 1. Create Classes
    let source_class = services
        .ontology_service
        .create_class(
            CreateClassInput {
                name: "Source".to_string(),
                description: None,
                parent_class_id: None,
                is_abstract: Some(false),
            },
            Some(user_id),
        )
        .await
        .expect("Failed to create source class");

    let target_class = services
        .ontology_service
        .create_class(
            CreateClassInput {
                name: "Target".to_string(),
                description: None,
                parent_class_id: None,
                is_abstract: Some(false),
            },
            Some(user_id),
        )
        .await
        .expect("Failed to create target class");

    // 2. Create Entities
    let source_entity = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: source_class.id,
                display_name: "SourceA".to_string(),
                parent_entity_id: None,
                attributes: None,
            },
            Some(user_id),
            None,
        )
        .await
        .expect("Failed to create source entity");

    let target_entity = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: target_class.id,
                display_name: "TargetB".to_string(),
                parent_entity_id: None,
                attributes: None,
            },
            Some(user_id),
            None,
        )
        .await
        .expect("Failed to create target entity");

    // 3. Create Relationship Type
    // Usually relationship types are seeded or created via system service.
    // OntologyService usually exposes `create_relationship_type`? I'll check service methods.
    // If not exposed, I might need to insert manually or use existing types like 'contains'.
    // 'contains' is seeded in migration `20260110...`.

    // 4. Create Relationship
    let rel_input = CreateRelationshipInput {
        source_entity_id: source_entity.id,
        target_entity_id: target_entity.id,
        relationship_type: "contains".to_string(),
        metadata: Some(serde_json::json!({"weight": 1})),
    };

    let rel = services
        .ontology_service
        .create_relationship(rel_input, Some(user_id))
        .await
        .expect("Failed to create relationship");

    assert_eq!(rel.source_entity_id, source_entity.id);
    assert_eq!(rel.target_entity_id, target_entity.id);
}
