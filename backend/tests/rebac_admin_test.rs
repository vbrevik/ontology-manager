use sqlx::PgPool;
use template_repo_backend::features::ontology::models::{CreateEntityInput, CreateRelationshipInput};
use template_repo_backend::features::rebac::models::{
    BatchUpdateRolePermissionsInput, RolePermissionUpdate,
};
use template_repo_backend::features::rebac::impact::SimulateRoleChangeInput;
use uuid::Uuid;

mod common;

#[sqlx::test]
async fn test_access_matrix_batch_update(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let admin_id = Uuid::new_v4();

    // 0. Create Admin User

    let user_class = services.ontology_service.get_system_class("User").await.unwrap();
    sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes, approval_status, created_by, updated_by) VALUES ($1, $2, $3, $4, 'APPROVED', $5, $5)")
        .bind(admin_id)
        .bind(user_class.id)
        .bind("admin_user")
        .bind(serde_json::json!({"user_id": admin_id}))
        .bind(admin_id)
        .execute(&pool)
        .await
        .unwrap();

    // 1. Setup entities
    let role_class = services.ontology_service.get_system_class("Role").await.unwrap();
    let perm_class = services.ontology_service.get_system_class("Permission").await.unwrap();

    let role_a = services.ontology_service.create_entity(
        CreateEntityInput {
            class_id: role_class.id,
            display_name: "RoleA".into(),
            parent_entity_id: None,
            attributes: Some(serde_json::json!({"name": "RoleA", "level": 10})),
        },
        Some(admin_id),
        None,
    ).await.unwrap();

    let _perm_1 = services.ontology_service.create_entity(
        CreateEntityInput {
            class_id: perm_class.id,
            display_name: "perm1".into(),
            parent_entity_id: None,
            attributes: Some(serde_json::json!({"name": "perm1", "level": 1})),
        },
        Some(admin_id),
        None,
    ).await.unwrap();

    // 2. Batch Update: Grant perm1 to RoleA
    services.rebac_service.batch_update_role_permissions(BatchUpdateRolePermissionsInput {
        updates: vec![
            RolePermissionUpdate {
                role_id: role_a.id,
                permission: "perm1".to_string(),
                grant: true,
            }
        ]
    }).await.expect("Batch update failed");

    // 3. Verify Matrix
    let matrix = services.rebac_service.get_full_role_permission_matrix(None).await.unwrap();
    let role_entry = matrix.roles.iter().find(|r| r.role_id == role_a.id).expect("Role not in matrix");
    assert!(role_entry.permissions.contains(&"perm1".to_string()));

    // 4. Batch Update: Revoke perm1 from RoleA
    services.rebac_service.batch_update_role_permissions(BatchUpdateRolePermissionsInput {
        updates: vec![
            RolePermissionUpdate {
                role_id: role_a.id,
                permission: "perm1".to_string(),
                grant: false,
            }
        ]
    }).await.expect("Batch update revoke failed");

    // 5. Verify Revoked
    let matrix_revoked = services.rebac_service.get_full_role_permission_matrix(None).await.unwrap();
    let role_entry_revoked = matrix_revoked.roles.iter().find(|r| r.role_id == role_a.id).unwrap();
    assert!(!role_entry_revoked.permissions.contains(&"perm1".to_string()));
}

#[sqlx::test]
async fn test_impact_analysis_simulation(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let admin_id = Uuid::new_v4();

    // 0. Create Admin User

    let user_class = services.ontology_service.get_system_class("User").await.unwrap();
    sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes, approval_status, created_by, updated_by) VALUES ($1, $2, $3, $4, 'APPROVED', $5, $5)")
        .bind(admin_id)
        .bind(user_class.id)
        .bind("imp_admin")
        .bind(serde_json::json!({"user_id": admin_id}))
        .bind(admin_id)
        .execute(&pool)
        .await
        .unwrap();

    // 1. Setup Role and 2 Users
    let role_class = services.ontology_service.get_system_class("Role").await.unwrap();
    let role_test = services.ontology_service.create_entity(
        CreateEntityInput {
            class_id: role_class.id,
            display_name: "ImpactRole".into(),
            parent_entity_id: None,
            attributes: Some(serde_json::json!({"name": "ImpactRole", "level": 10})),
        },
        Some(admin_id),
        None,
    ).await.unwrap();

    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();

    for uid in &[user1_id, user2_id] {

        // Create User Entity
        sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes, approval_status, created_by, updated_by) VALUES ($1, $2, $3, $4, 'APPROVED', $5, $5)")
            .bind(uid)
            .bind(user_class.id)
            .bind(format!("impact_{}", uid.simple()))
            .bind(serde_json::json!({"user_id": uid}))
            .bind(admin_id)
            .execute(&pool)
            .await
            .unwrap();

        // Assign Role
        services.ontology_service.create_relationship(
            CreateRelationshipInput {
                source_entity_id: *uid,
                target_entity_id: role_test.id,
                relationship_type: "has_role".into(),
                metadata: None,
            },
            Some(admin_id),
        ).await.unwrap();
    }

    // 2. Simulate Adding "new_secret_perm" to ImpactRole
    let impact_svc = template_repo_backend::features::rebac::impact::ImpactService::new(pool.clone());
    let report = impact_svc.simulate_role_change(SimulateRoleChangeInput {
        role_id: role_test.id,
        added_permissions: vec!["new_secret_perm".to_string()],
        removed_permissions: vec![],
    }).await.expect("Simulation failed");

    // 3. Verify Report: 2 users should gain access
    assert_eq!(report.affected_users_count, 2);
    assert_eq!(report.gained_access.len(), 2);
    
    // Check details mention the permission
    assert!(report.gained_access[0].details.contains("new_secret_perm"));
}
