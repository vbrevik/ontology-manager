use sqlx::PgPool;
use uuid::Uuid;

mod common;

#[sqlx::test]
async fn test_abac_global_permission(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = Uuid::new_v4();

    // 1. Setup User
    sqlx::query("INSERT INTO users (id, email, username, password_hash) VALUES ($1, $2, $3, $4)")
        .bind(user_id)
        .bind("abac@e.com")
        .bind("abac_u")
        .bind("dummy")
        .execute(&pool)
        .await
        .unwrap();

    // Create User Entity (needed for relationship constraints in some paths, though ABAC global check might just use ID)
    let user_class = services
        .ontology_service
        .get_system_class("User")
        .await
        .unwrap();
    sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes, approval_status, created_by, updated_by) VALUES ($1, $2, $3, $4, 'APPROVED', $5, $5)")
        .bind(user_id).bind(user_class.id).bind("abac_u").bind(serde_json::json!({"user_id": user_id, "username": "abac_u"}))
        .bind(user_id).execute(&pool).await.unwrap();

    // 2. Create Global Role "Admin" and Permission "configure"
    let role = services
        .abac_service
        .create_role("GlobalAdmin", Some("Global Administrator"))
        .await
        .expect("Failed to create role");

    // Add permission (Action name) to role.
    // ABAC add_permission creates a "Permission" entity if needed?
    // Let's check `add_permission` implementation. It calls `rebac_service.add_permission_to_role`.
    // It assumes Permission entity with display_name = action exists? Or creates it?
    // RebacService::add_permission_to_role usually finds or creates.
    // Let's assume it works or we pre-create if needed.
    // Actually, `check_permission` does: `perm_entity.display_name = $4`.

    // We need to ensure the Permission Entity exists first, presumably.
    // `RebacService::add_permission_to_role` might expect it.
    // But `AbacService` has `add_permission`.
    // Let's try calling it.

    // First, ensure "configure" permission entity exists?
    // ReBAC usually seeds permissions. We can manually create one to be safe.
    let perm_class = services
        .ontology_service
        .get_system_class("Permission")
        .await
        .unwrap();
    let _perm = services
        .ontology_service
        .create_entity(
            template_repo_backend::features::ontology::models::CreateEntityInput {
                class_id: perm_class.id,
                display_name: "configure".into(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"name": "configure", "level": 10})),
            },
            Some(user_id),
            None,
        )
        .await
        .expect("Failed to create permission entity");

    services
        .abac_service
        .add_permission(&role.id.to_string(), "configure")
        .await
        .expect("Failed to add permission");

    // 3. Assign Role to User (Global)
    // `assign_role` input takes user_id string, role_name, resource_id (opt).
    // For global, resource_id = None.
    services
        .abac_service
        .assign_role(
            template_repo_backend::features::abac::models::AssignRoleInput {
                user_id: user_id.to_string(),
                role_name: role.name.clone(),
                resource_id: None,
            },
            None, // Granter: None (System) bypasses delegation checks
        )
        .await
        .expect("Failed to assign role");

    // 4. Check Global Permission
    let allowed = services
        .abac_service
        .check_permission(user_id, "configure", None, None, None)
        .await
        .expect("Check failed");

    assert!(allowed, "User should have global 'configure' permission");

    let denied = services
        .abac_service
        .check_permission(user_id, "delete_world", None, None, None)
        .await
        .expect("Check failed");
    assert!(!denied, "User should NOT have 'delete_world' permission");
}

#[sqlx::test]
async fn test_abac_resource_permission(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = Uuid::new_v4();

    // Setup User
    sqlx::query("INSERT INTO users (id, email, username, password_hash) VALUES ($1, $2, $3, $4)")
        .bind(user_id)
        .bind("abac2@e.com")
        .bind("abac2")
        .bind("dummy")
        .execute(&pool)
        .await
        .unwrap();
    let user_class = services
        .ontology_service
        .get_system_class("User")
        .await
        .unwrap();
    sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes, approval_status, created_by, updated_by) VALUES ($1, $2, $3, $4, 'APPROVED', $5, $5)")
        .bind(user_id).bind(user_class.id).bind("abac2").bind(serde_json::json!({"user_id": user_id, "username": "abac2"}))
        .bind(user_id).execute(&pool).await.unwrap();

    // Create Resource (Entity)
    // Create a File class first explicitly
    let file_class = services
        .ontology_service
        .create_class(
            template_repo_backend::features::ontology::models::CreateClassInput {
                name: "File".into(),
                description: None,
                parent_class_id: None,
                is_abstract: Some(false),
            },
            Some(user_id),
        )
        .await
        .unwrap();

    let file = services
        .ontology_service
        .create_entity(
            template_repo_backend::features::ontology::models::CreateEntityInput {
                class_id: file_class.id,
                display_name: "SecretFile".into(),
                parent_entity_id: None,
                attributes: None,
            },
            Some(user_id),
            None,
        )
        .await
        .unwrap();

    // Create Role "Editor" and Permission "edit"
    let role = services
        .abac_service
        .create_role("Editor", None)
        .await
        .expect("create role");

    let perm_class = services
        .ontology_service
        .get_system_class("Permission")
        .await
        .unwrap();
    let _perm = services
        .ontology_service
        .create_entity(
            template_repo_backend::features::ontology::models::CreateEntityInput {
                class_id: perm_class.id,
                display_name: "edit".into(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"name": "edit", "level": 1})),
            },
            Some(user_id),
            None,
        )
        .await
        .unwrap();

    services
        .abac_service
        .add_permission(&role.id.to_string(), "edit")
        .await
        .expect("add perm");

    // Assign Editor Role on SecretFile
    services
        .abac_service
        .assign_role(
            template_repo_backend::features::abac::models::AssignRoleInput {
                user_id: user_id.to_string(),
                role_name: role.name.clone(),
                resource_id: Some(file.id.to_string()),
            },
            None, // System assignment
        )
        .await
        .expect("assign role");

    // Check Permission
    let allowed = services
        .abac_service
        .check_permission(user_id, "edit", Some(file.id), None, None)
        .await
        .expect("check perm");
    assert!(allowed, "User should have 'edit' permission on SecretFile");

    // Check on another file
    let file2 = services
        .ontology_service
        .create_entity(
            template_repo_backend::features::ontology::models::CreateEntityInput {
                class_id: file_class.id,
                display_name: "OtherFile".into(),
                parent_entity_id: None,
                attributes: None,
            },
            Some(user_id),
            None,
        )
        .await
        .unwrap();

    let allowed2 = services
        .abac_service
        .check_permission(user_id, "edit", Some(file2.id), None, None)
        .await
        .expect("check perm 2");
    assert!(
        !allowed2,
        "User should NOT have 'edit' permission on OtherFile"
    );
}
