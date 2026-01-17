use chrono::{Duration, Utc};
use sqlx::PgPool;
use template_repo_backend::features::ontology::models::{
    CreateClassInput, CreateEntityInput, CreateRelationshipInput,
};
use uuid::Uuid;

mod common;

#[sqlx::test]
async fn test_temporal_access_control(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = Uuid::new_v4();

    // 1. Create User

    let user_class = services.ontology_service.get_system_class("User").await.unwrap();
    sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes, approval_status, created_by, updated_by) VALUES ($1, $2, $3, $4, 'APPROVED', $5, $5)")
        .bind(user_id)
        .bind(user_class.id)
        .bind("temp_user")
        .bind(serde_json::json!({"user_id": user_id}))
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();

    // 2. Setup Role "FutureRole" and Permission "future_perm"
    let role_class = services.ontology_service.get_system_class("Role").await.unwrap();
    let perm_class = services.ontology_service.get_system_class("Permission").await.unwrap();

    let role_future = services.ontology_service.create_entity(
        CreateEntityInput {
            class_id: role_class.id,
            display_name: "FutureRole".into(),
            parent_entity_id: None,
            attributes: Some(serde_json::json!({"name": "FutureRole", "level": 10})),
        },
        Some(user_id),
        None,
    ).await.unwrap();

    let perm_future = services.ontology_service.create_entity(
        CreateEntityInput {
            class_id: perm_class.id,
            display_name: "future_perm".into(),
            parent_entity_id: None,
            attributes: Some(serde_json::json!({"name": "future_perm", "level": 1})),
        },
        Some(user_id),
        None,
    ).await.unwrap();

    // Grant perm to role
    services.ontology_service.create_relationship(
        CreateRelationshipInput {
            source_entity_id: role_future.id,
            target_entity_id: perm_future.id,
            relationship_type: "grants_permission".into(),
            metadata: Some(serde_json::json!({"effect": "ALLOW"})),
        },
        Some(user_id),
    ).await.unwrap();

    // 3. Assign Role with Valid From = Tomorrow
    services.ontology_service.create_relationship(
        CreateRelationshipInput {
            source_entity_id: user_id,
            target_entity_id: role_future.id,
            relationship_type: "has_role".into(),
            metadata: Some(serde_json::json!({
                "valid_from": (Utc::now() + Duration::days(1)).to_rfc3339()
            })),
        },
        Some(user_id),
    ).await.unwrap();

    // Verify Access Denied
    // We check against User entity itself as target for simplicity, or just check global permission?
    // has_permission checks target entity. Let's create a dummy target.
    let target_class = services.ontology_service.create_class(CreateClassInput{name:"Target".into(), description:None, parent_class_id:None, is_abstract:Some(false)}, Some(user_id)).await.unwrap();
    let target = services.ontology_service.create_entity(CreateEntityInput{class_id: target_class.id, display_name: "T1".into(), parent_entity_id:None, attributes:None}, Some(user_id), None).await.unwrap();

    let allowed = services.rebac_service.has_permission(user_id, target.id, "future_perm", None).await.unwrap();
    assert!(!allowed, "Should be denied because role starts in future");


    // 4. Test Expired Role
    let role_past = services.ontology_service.create_entity(
        CreateEntityInput {
            class_id: role_class.id,
            display_name: "PastRole".into(),
            parent_entity_id: None,
            attributes: Some(serde_json::json!({"name": "PastRole", "level": 10})),
        },
        Some(user_id),
        None,
    ).await.unwrap();

    let perm_past = services.ontology_service.create_entity(
        CreateEntityInput {
            class_id: perm_class.id,
            display_name: "past_perm".into(),
            parent_entity_id: None,
            attributes: Some(serde_json::json!({"name": "past_perm", "level": 1})),
        },
        Some(user_id),
        None,
    ).await.unwrap();

    services.ontology_service.create_relationship(
        CreateRelationshipInput {
            source_entity_id: role_past.id,
            target_entity_id: perm_past.id,
            relationship_type: "grants_permission".into(),
            metadata: Some(serde_json::json!({"effect": "ALLOW"})),
        },
        Some(user_id),
    ).await.unwrap();

    // Assign Role with Valid Until = Yesterday
    services.ontology_service.create_relationship(
        CreateRelationshipInput {
            source_entity_id: user_id,
            target_entity_id: role_past.id,
            relationship_type: "has_role".into(),
            metadata: Some(serde_json::json!({
                "valid_until": (Utc::now() - Duration::days(1)).to_rfc3339()
            })),
        },
        Some(user_id),
    ).await.unwrap();

    let allowed_past = services.rebac_service.has_permission(user_id, target.id, "past_perm", None).await.unwrap();
    assert!(!allowed_past, "Should be denied because role expired");

    // 5. Test Active Role (Window)
    let role_active = services.ontology_service.create_entity(
        CreateEntityInput {
            class_id: role_class.id,
            display_name: "ActiveRole".into(),
            parent_entity_id: None,
            attributes: Some(serde_json::json!({"name": "ActiveRole", "level": 10})),
        },
        Some(user_id),
        None,
    ).await.unwrap();

    let perm_active = services.ontology_service.create_entity(
        CreateEntityInput {
            class_id: perm_class.id,
            display_name: "active_perm".into(),
            parent_entity_id: None,
            attributes: Some(serde_json::json!({"name": "active_perm", "level": 1})),
        },
        Some(user_id),
        None,
    ).await.unwrap();

    services.ontology_service.create_relationship(
        CreateRelationshipInput {
            source_entity_id: role_active.id,
            target_entity_id: perm_active.id,
            relationship_type: "grants_permission".into(),
            metadata: Some(serde_json::json!({"effect": "ALLOW"})),
        },
        Some(user_id),
    ).await.unwrap();

    // 5. Test Active Role (Window + Scope)
    let role_active = services.ontology_service.create_entity(
        CreateEntityInput {
            class_id: role_class.id,
            display_name: "ActiveRole".into(),
            parent_entity_id: None,
            attributes: Some(serde_json::json!({"name": "ActiveRole", "level": 10})),
        },
        Some(user_id),
        None,
    ).await.unwrap();

    let perm_active = services.ontology_service.create_entity(
        CreateEntityInput {
            class_id: perm_class.id,
            display_name: "active_perm".into(),
            parent_entity_id: None,
            attributes: Some(serde_json::json!({"name": "active_perm", "level": 1})),
        },
        Some(user_id),
        None,
    ).await.unwrap();

    services.ontology_service.create_relationship(
        CreateRelationshipInput {
            source_entity_id: role_active.id,
            target_entity_id: perm_active.id,
            relationship_type: "grants_permission".into(),
            metadata: Some(serde_json::json!({"effect": "ALLOW"})),
        },
        Some(user_id),
    ).await.unwrap();

    // Assign Role with Valid From = Yesterday, Valid Until = Tomorrow, and Scoped to Target
    services.ontology_service.create_relationship(
        CreateRelationshipInput {
            source_entity_id: user_id,
            target_entity_id: role_active.id,
            relationship_type: "has_role".into(),
            metadata: Some(serde_json::json!({
                "scope_entity_id": target.id.to_string(),
                "valid_from": (Utc::now() - Duration::days(1)).to_rfc3339(),
                "valid_until": (Utc::now() + Duration::days(1)).to_rfc3339()
            })),
        },
        Some(user_id),
    ).await.unwrap();

    let allowed_active = services.rebac_service.has_permission(user_id, target.id, "active_perm", None).await.unwrap();
    assert!(allowed_active, "Should be allowed because role is active and scoped");

    // Also verify out of scope for another target
    let other_target = services.ontology_service.create_entity(CreateEntityInput{class_id: target_class.id, display_name: "T2".into(), parent_entity_id:None, attributes:None}, Some(user_id), None).await.unwrap();
    let allowed_other = services.rebac_service.has_permission(user_id, other_target.id, "active_perm", None).await.unwrap();
    assert!(!allowed_other, "Should be denied because other target is out of scope");

    let allowed_active = services.rebac_service.has_permission(user_id, target.id, "active_perm", None).await.unwrap();
    assert!(allowed_active, "Should be allowed because role is active and scoped");
}
