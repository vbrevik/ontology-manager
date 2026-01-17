use sqlx::PgPool;
use template_repo_backend::features::ontology::models::{
    CreateClassInput, CreateEntityInput, CreateRelationshipInput,
};
use uuid::Uuid;

mod common;

#[sqlx::test]
async fn test_ontology_rebac_integration_flow(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Setup Users (Owner and Viewer)
    // We create them in both `users` table (for auth/FKs) and `entities` (for ReBAC)
    let owner_id = Uuid::new_v4();
    let viewer_id = Uuid::new_v4();

    // Owner Account

    // Viewer Account

    // Get User Class
    let user_class = services
        .ontology_service
        .get_system_class("User")
        .await
        .expect("User class missing");

    // Owner Entity
    sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes, approval_status, created_by, updated_by) VALUES ($1, $2, $3, $4, 'APPROVED', $5, $5)")
        .bind(owner_id).bind(user_class.id).bind("Owner").bind(serde_json::json!({"user_id": owner_id, "username": "owner"})).bind(owner_id).execute(&pool).await.unwrap();

    // Viewer Entity
    sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes, approval_status, created_by, updated_by) VALUES ($1, $2, $3, $4, 'APPROVED', $5, $5)")
        .bind(viewer_id).bind(user_class.id).bind("Viewer").bind(serde_json::json!({"user_id": viewer_id, "username": "viewer"})).bind(viewer_id).execute(&pool).await.unwrap();

    // 2. Setup Ontology Schema (Document Class)
    let doc_class = services
        .ontology_service
        .create_class(
            CreateClassInput {
                name: "Document".to_string(),
                description: Some("Confidential Document".to_string()),
                parent_class_id: None,
                is_abstract: Some(false),
            },
            Some(owner_id),
        )
        .await
        .expect("Failed to create Document class");

    // 3. Setup Security Schema (Viewer Role, View Permission)
    let role_class = services
        .ontology_service
        .get_system_class("Role")
        .await
        .expect("Role class missing");
    let perm_class = services
        .ontology_service
        .get_system_class("Permission")
        .await
        .expect("Permission class missing");

    let role_viewer = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: role_class.id,
                display_name: "Viewer".to_string(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"name": "Viewer", "level": 1})),
            },
            Some(owner_id),
            None,
        )
        .await
        .expect("Failed to create Viewer role");

    let perm_view = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: perm_class.id,
                display_name: "view_document".to_string(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"name": "view_document", "level": 1})),
            },
            Some(owner_id),
            None,
        )
        .await
        .expect("Failed to create Permission");

    // Link Role -> Permission (Viewer grants view_document)
    services
        .ontology_service
        .create_relationship(
            CreateRelationshipInput {
                source_entity_id: role_viewer.id,
                target_entity_id: perm_view.id,
                relationship_type: "grants_permission".to_string(),
                metadata: Some(serde_json::json!({"effect": "ALLOW"})),
            },
            Some(owner_id),
        )
        .await
        .expect("Failed to link role and permission");

    // 4. Create a Document Entity (by Owner)
    let doc_alpha = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: doc_class.id,
                display_name: "Project Alpha Plan".to_string(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"status": "draft"})),
            },
            Some(owner_id),
            None,
        )
        .await
        .expect("Failed to create Document Alpha");

    // 5. Check Initial Permissions
    // Viewer should NOT see it yet
    let can_view_initial = services
        .rebac_service
        .has_permission(viewer_id, doc_alpha.id, "view_document", None)
        .await
        .expect("Initial check failed");
    assert!(!can_view_initial, "Viewer should NOT have access initially");

    // 6. Grant Access (Create 'has_role' relationship scoped to document)
    // Owner assigns 'Viewer' role to 'Viewer' user for 'Document Alpha'
    services
        .ontology_service
        .create_relationship(
            CreateRelationshipInput {
                source_entity_id: viewer_id,
                target_entity_id: role_viewer.id,
                relationship_type: "has_role".to_string(),
                metadata: Some(serde_json::json!({
                    "scope_entity_id": doc_alpha.id.to_string()
                })),
            },
            Some(owner_id),
        )
        .await
        .expect("Failed to grant access");

    // 7. Verify Access Granted
    // NOTE: We must re-initialize services to clear the ReBAC permission cache,
    // which cached the 'false' result from the initial check.
    let services = common::setup_services(pool.clone()).await;

    let can_view_granted = services
        .rebac_service
        .has_permission(viewer_id, doc_alpha.id, "view_document", None)
        .await
        .expect("Granted check failed");

    assert!(
        can_view_granted,
        "Viewer SHOULD have access after role assignment"
    );

    // 8. Verify Access Denied for Unrelated Document
    let doc_beta = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: doc_class.id,
                display_name: "Project Beta Plan".to_string(),
                parent_entity_id: None,
                attributes: None,
            },
            Some(owner_id),
            None,
        )
        .await
        .expect("Failed to create Document Beta");

    let can_view_beta = services
        .rebac_service
        .has_permission(viewer_id, doc_beta.id, "view_document", None)
        .await
        .expect("Beta check failed");
    assert!(
        !can_view_beta,
        "Viewer should NOT have access to unrelated document"
    );
}
