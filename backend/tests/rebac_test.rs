use sqlx::PgPool;
use template_repo_backend::features::ontology::models::{
    CreateClassInput, CreateEntityInput, CreateRelationshipInput,
};
use uuid::Uuid;

mod common;

#[sqlx::test]
async fn test_rebac_scoped_permission(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Create User
    let user_id = Uuid::new_v4();

    // Create User Entity (Required for ReBAC & Relationships)
    let user_class = services
        .ontology_service
        .get_system_class("User")
        .await
        .expect("User class not found");

    // Manual insert to force ID
    sqlx::query(
        r#"
        INSERT INTO entities (id, class_id, display_name, attributes, approval_status, created_by, updated_by)
        VALUES ($1, $2, $3, $4, 'APPROVED', $5, $5)
        "#
    )
    .bind(user_id)
    .bind(user_class.id)
    .bind("rebac_test_user")
    .bind(serde_json::json!({
        "user_id": user_id,
        "email": format!("rebac_{}@example.com", user_id),
        "username": format!("rebac_{}", user_id.simple())
    }))
    .bind(user_id)
    .execute(&pool)
    .await
    .expect("Failed to manually create User Entity");

    // 2. Create "Mission" Class and Entity
    let mission_class = services
        .ontology_service
        .create_class(
            CreateClassInput {
                name: "Mission".to_string(),
                description: None,
                parent_class_id: None,
                is_abstract: Some(false),
            },
            Some(user_id),
        )
        .await
        .expect("Failed to create Mission class");

    let mission_a = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: mission_class.id,
                display_name: "Mission Alpha".to_string(),
                parent_entity_id: None,
                attributes: None,
            },
            Some(user_id),
            None,
        )
        .await
        .expect("Failed to create Mission A");

    let mission_b = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: mission_class.id,
                display_name: "Mission Beta".to_string(),
                parent_entity_id: None,
                attributes: None,
            },
            Some(user_id),
            None,
        )
        .await
        .expect("Failed to create Mission B");

    // 3. Get System Classes (Role, Permission)
    // We assume these exist because of migration `20260110...` which seeds types?
    // Actually, `Role` and `Permission` classes are usually created by `system_ontology_bootstrap` (20260116) or `unify` (20260118).
    // Let's retrieve them by name.
    let role_class = services
        .ontology_service
        .get_system_class("Role")
        .await
        .expect("Role class not found");
    let perm_class = services
        .ontology_service
        .get_system_class("Permission")
        .await
        .expect("Permission class not found");

    // 4. Create Role "Viewer" and Permission "read"
    let role_viewer = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: role_class.id,
                display_name: "Viewer".to_string(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({
                    "name": "Viewer", // Required
                    "level": 10
                })),
            },
            Some(user_id),
            None,
        )
        .await
        .expect("Failed to create Role Viewer");

    let perm_read = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: perm_class.id,
                display_name: "read".to_string(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({
                    "name": "read", // Required
                    "level": 1
                })),
            },
            Some(user_id),
            None,
        )
        .await
        .expect("Failed to create Permission read");

    // 5. Link Role -> Permission (grants_permission)
    services
        .ontology_service
        .create_relationship(
            CreateRelationshipInput {
                source_entity_id: role_viewer.id,
                target_entity_id: perm_read.id,
                relationship_type: "grants_permission".to_string(),
                metadata: Some(serde_json::json!({"effect": "ALLOW"})),
            },
            Some(user_id),
        )
        .await
        .expect("Failed to grant permission");

    // 6. Assign Role to User Scoped to Mission A (User -> Role) via 'has_role'
    services
        .ontology_service
        .create_relationship(
            CreateRelationshipInput {
                source_entity_id: user_id, // User is an entity? Wait.
                // In this unified ontology, Users ARE entities in `entities` table?
                // Migration `20260118...` ports users to entities.
                // But here I manually inserted into `users` table.
                // Does `AuthService` or `UserService` automatically create the Entity?
                // `create_test_config` sets up services.
                // If I insert into `users` manually, I MUST also insert into `entities` if ReBAC relies on User being an Entity.
                // ReBAC queries: `SELECT ... FROM entities WHERE id = $1` (user_id).
                // Yes, ReBAC assumes User is an Entity.
                // I must create a User Entity.
                // The `unify` migration ports existing users. But my user is created AFTER migration runs (at test time).
                // So I must manually create the User Entity.
                target_entity_id: role_viewer.id,
                relationship_type: "has_role".to_string(),
                metadata: Some(serde_json::json!({
                    "scope_entity_id": mission_a.id.to_string()
                })),
            },
            Some(user_id),
        )
        .await
        .expect("Failed to assign role");

    // 7. Check Permission
    // Should pass for Mission A
    let has_perm_a = services
        .rebac_service
        .has_permission(user_id, mission_a.id, "read", None)
        .await
        .expect("Check failed");
    assert!(has_perm_a, "User should have read permission on Mission A");

    // Should fail for Mission B (out of scope)
    let has_perm_b = services
        .rebac_service
        .has_permission(user_id, mission_b.id, "read", None)
        .await
        .expect("Check failed");
    assert!(
        !has_perm_b,
        "User should NOT have read permission on Mission B"
    );
}

#[sqlx::test]
async fn test_rebac_inheritance(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = Uuid::new_v4();

    // Setup User and User Entity

    let user_class = services
        .ontology_service
        .get_system_class("User")
        .await
        .unwrap();
    sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes, approval_status, created_by, updated_by) VALUES ($1, $2, $3, $4, 'APPROVED', $5, $5)")
        .bind(user_id).bind(user_class.id).bind("u2").bind(serde_json::json!({"user_id": user_id, "username": "u2", "email": "u2@e.com"}))
        .bind(user_id).execute(&pool).await.unwrap();

    // Create Mission and Task (Child)
    let mission_class = services
        .ontology_service
        .create_class(
            CreateClassInput {
                name: "Mission".into(),
                description: None,
                parent_class_id: None,
                is_abstract: Some(false),
            },
            Some(user_id),
        )
        .await
        .unwrap();
    let task_class = services
        .ontology_service
        .create_class(
            CreateClassInput {
                name: "Task".into(),
                description: None,
                parent_class_id: None,
                is_abstract: Some(false),
            },
            Some(user_id),
        )
        .await
        .unwrap();

    let mission = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: mission_class.id,
                display_name: "Root Mission".into(),
                parent_entity_id: None,
                attributes: None,
            },
            Some(user_id),
            None,
        )
        .await
        .unwrap();
    let task = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: task_class.id,
                display_name: "Child Task".into(),
                parent_entity_id: Some(mission.id),
                attributes: None,
            },
            Some(user_id),
            None,
        )
        .await
        .unwrap();

    // Setup Role "Viewer" and Permission "read"
    let role_class = services
        .ontology_service
        .get_system_class("Role")
        .await
        .unwrap();
    let perm_class = services
        .ontology_service
        .get_system_class("Permission")
        .await
        .unwrap();

    let role = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: role_class.id,
                display_name: "Viewer".into(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"name": "Viewer", "level": 10})),
            },
            Some(user_id),
            None,
        )
        .await
        .unwrap();

    let perm = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: perm_class.id,
                display_name: "read".into(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"name": "read", "level": 1})),
            },
            Some(user_id),
            None,
        )
        .await
        .unwrap();

    services
        .ontology_service
        .create_relationship(
            CreateRelationshipInput {
                source_entity_id: role.id,
                target_entity_id: perm.id,
                relationship_type: "grants_permission".into(),
                metadata: Some(serde_json::json!({"effect": "ALLOW"})),
            },
            Some(user_id),
        )
        .await
        .unwrap();

    // Assign Role on Mission (Root)
    services
        .ontology_service
        .create_relationship(
            CreateRelationshipInput {
                source_entity_id: user_id,
                target_entity_id: role.id,
                relationship_type: "has_role".into(),
                metadata: Some(serde_json::json!({"scope_entity_id": mission.id.to_string()})),
            },
            Some(user_id),
        )
        .await
        .unwrap();

    // Check on Task (Child) - Should Inherit
    let allowed = services
        .rebac_service
        .has_permission(user_id, task.id, "read", None)
        .await
        .expect("check");
    assert!(allowed, "Should inherit permission from parent entity");
}

#[sqlx::test]
async fn test_rebac_explicit_deny(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = Uuid::new_v4();

    // Setup User

    let user_class = services
        .ontology_service
        .get_system_class("User")
        .await
        .unwrap();
    sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes, approval_status, created_by, updated_by) VALUES ($1, $2, $3, $4, 'APPROVED', $5, $5)")
        .bind(user_id).bind(user_class.id).bind("u3").bind(serde_json::json!({"user_id": user_id, "username": "u3", "email": "u3@e.com"}))
        .bind(user_id).execute(&pool).await.unwrap();

    // Setup Mission
    let mission_class = services
        .ontology_service
        .create_class(
            CreateClassInput {
                name: "Mission".into(),
                description: None,
                parent_class_id: None,
                is_abstract: Some(false),
            },
            Some(user_id),
        )
        .await
        .unwrap();
    let mission = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: mission_class.id,
                display_name: "Secret Mission".into(),
                parent_entity_id: None,
                attributes: None,
            },
            Some(user_id),
            None,
        )
        .await
        .unwrap();

    // Setup Role "Viewer" (Allow) and "Blocked" (Deny)
    let role_class = services
        .ontology_service
        .get_system_class("Role")
        .await
        .unwrap();
    let perm_class = services
        .ontology_service
        .get_system_class("Permission")
        .await
        .unwrap();

    let role_viewer = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: role_class.id,
                display_name: "Viewer".into(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"name": "Viewer", "level": 10})),
            },
            Some(user_id),
            None,
        )
        .await
        .unwrap();

    let role_blocked = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: role_class.id,
                display_name: "Blocked".into(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"name": "Blocked", "level": 1})),
            },
            Some(user_id),
            None,
        )
        .await
        .unwrap();

    let perm = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: perm_class.id,
                display_name: "read".into(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"name": "read", "level": 1})),
            },
            Some(user_id),
            None,
        )
        .await
        .unwrap();

    // Viewer grants read
    services
        .ontology_service
        .create_relationship(
            CreateRelationshipInput {
                source_entity_id: role_viewer.id,
                target_entity_id: perm.id,
                relationship_type: "grants_permission".into(),
                metadata: Some(serde_json::json!({"effect": "ALLOW"})),
            },
            Some(user_id),
        )
        .await
        .unwrap();

    // Blocked ALSO "grants" read? Or we use is_deny on the assignment?
    // We can use is_deny on assignment OR deny effect on grant.
    // Let's test `is_deny` on ASSIGNMENT (has_role).
    // Assign Viewer (Allow)
    services
        .ontology_service
        .create_relationship(
            CreateRelationshipInput {
                source_entity_id: user_id,
                target_entity_id: role_viewer.id,
                relationship_type: "has_role".into(),
                metadata: Some(serde_json::json!({"scope_entity_id": mission.id.to_string()})),
            },
            Some(user_id),
        )
        .await
        .unwrap();

    // Assign Blocked (Deny) explicitly
    services
        .ontology_service
        .create_relationship(
            CreateRelationshipInput {
                source_entity_id: user_id,
                target_entity_id: role_blocked.id,
                relationship_type: "has_role".into(),
                metadata: Some(
                    serde_json::json!({"scope_entity_id": mission.id.to_string(), "is_deny": true}),
                ),
            },
            Some(user_id),
        )
        .await
        .unwrap();

    // Wait, if checking "read", user has Viewer (Allows Read) and Blocked (Is Denied).
    // Line 102 in Proc: IF EXISTS ... WHERE is_deny = TRUE THEN FALSE.
    // BUT `roles_with_permission` logic joins `rel_grant`.
    // Does "Blocked" role grant "read"?
    // If "Blocked" role does NOT grant "read", then it won't appear in `roles_with_permission`.
    // So "is_deny" on a role assignment only denies permissions GRANTED by that role?
    // NO. If `roles_with_permission` contains a row with `is_deny=TRUE`, then Access Denied.
    // So "Blocked" role MUST contain "read" permission (or admin) to trigger the deny.
    // So let's make Blocked role also grant "read" (or contain it).

    services
        .ontology_service
        .create_relationship(
            CreateRelationshipInput {
                source_entity_id: role_blocked.id,
                target_entity_id: perm.id,
                relationship_type: "grants_permission".into(),
                metadata: Some(serde_json::json!({"effect": "ALLOW"})),
            },
            Some(user_id),
        )
        .await
        .unwrap();

    // Check - Should be DENIED
    let allowed = services
        .rebac_service
        .has_permission(user_id, mission.id, "read", None)
        .await
        .expect("check");
    assert!(!allowed, "Explicit deny should override allow");
}
