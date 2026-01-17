use sqlx::PgPool;
use template_repo_backend::features::ontology::models::{
    CreateClassInput, CreateEntityInput, CreateRelationshipInput, UpdateEntityInput,
};
use template_repo_backend::features::rebac::policy_models::CreatePolicyInput;
use uuid::Uuid;

mod common;

#[sqlx::test]
async fn test_policy_engine_integration_flow(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = Uuid::new_v4();

    // 1. Setup User and User Entity

    let user_class = services
        .ontology_service
        .get_system_class("User")
        .await
        .expect("User class missing");
    sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes, approval_status, created_by, updated_by) VALUES ($1, $2, $3, $4, 'APPROVED', $5, $5)")
        .bind(user_id).bind(user_class.id).bind("Policy User").bind(serde_json::json!({"user_id": user_id})).bind(user_id).execute(&pool).await.unwrap();

    // 2. Setup Ontology (Mission Class)
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

    // 3. Setup ReBAC (Viewer Role -> Read Permission)
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
            Some(user_id),
            None,
        )
        .await
        .expect("Failed to create Viewer role");

    let perm_read = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: perm_class.id,
                display_name: "read".to_string(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"name": "read", "level": 1})),
            },
            Some(user_id),
            None,
        )
        .await
        .expect("Failed to create Permission");

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
        .expect("Failed to link role and permission");

    // 4. Create Mission Entity
    let mission_alpha = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: mission_class.id,
                display_name: "Mission Alpha".to_string(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"status": "active"})),
            },
            Some(user_id),
            None,
        )
        .await
        .expect("Failed to create Mission Alpha");

    // 5. Assign Role (Baseline Access)
    services
        .ontology_service
        .create_relationship(
            CreateRelationshipInput {
                source_entity_id: user_id,
                target_entity_id: role_viewer.id,
                relationship_type: "has_role".to_string(),
                metadata: Some(serde_json::json!({
                    "scope_entity_id": mission_alpha.id.to_string()
                })),
            },
            Some(user_id),
        )
        .await
        .expect("Failed to grant access");

    // 6. Verify Baseline Access (Should be TRUE)
    let can_read_baseline = services
        .rebac_service
        .check_permission_integrated(user_id, mission_alpha.id, "read", None, None, None)
        .await
        .expect("Baseline check failed");
    assert!(can_read_baseline, "User should have read access via ReBAC");

    // 7. Create Lockdown Policy (DENY if entity.status == 'lockdown')
    let policy_input = CreatePolicyInput {
        name: "Lockdown Policy".to_string(),
        description: Some("Deny access during lockdown".to_string()),
        effect: "DENY".to_string(),
        priority: Some(100), // High priority
        target_class_id: Some(mission_class.id),
        target_permissions: vec!["read".to_string()],
        conditions: serde_json::json!({
            "all": [
                {
                    "attribute": "entity.status",
                    "operator": "equals",
                    "value": "lockdown"
                }
            ]
        }),
        scope_entity_id: None, // Global
        is_active: Some(true),
        valid_from: None,
        valid_until: None,
    };

    let policy = services
        .rebac_service
        .policy_service
        .create_policy(policy_input, Some(user_id))
        .await
        .expect("Failed to create policy");

    // 8. Verify Access Still TRUE (Status is 'active')
    let can_read_active = services
        .rebac_service
        .check_permission_integrated(user_id, mission_alpha.id, "read", None, None, None)
        .await
        .expect("Active check failed");
    assert!(can_read_active, "Policy should NOT trigger yet");

    // 9. Update Entity Status to 'lockdown'
    services
        .ontology_service
        .update_entity(
            mission_alpha.id,
            UpdateEntityInput {
                display_name: None,
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"status": "lockdown"})),
            },
            Some(user_id),
        )
        .await
        .expect("Failed to update entity");

    // 9. Update Entity Status to 'lockdown'
    services
        .ontology_service
        .update_entity(
            mission_alpha.id,
            UpdateEntityInput {
                display_name: None,
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"status": "lockdown"})),
            },
            Some(user_id),
        )
        .await
        .expect("Failed to update entity");

    // 10. Verify Access is DENIED (Policy Override)
    let can_read_lockdown = services
        .rebac_service
        .check_permission_integrated(user_id, mission_alpha.id, "read", None, None, None)
        .await
        .expect("Lockdown check failed");

    assert!(
        !can_read_lockdown,
        "Access should be DENIED by policy during lockdown"
    );

    // 11. Deactivate Policy
    services
        .rebac_service
        .policy_service
        .update_policy(
            policy.id,
            template_repo_backend::features::rebac::policy_models::UpdatePolicyInput {
                name: None,
                description: None,
                effect: None,
                priority: None,
                target_class_id: None,
                target_permissions: None,
                conditions: None,
                scope_entity_id: None,
                is_active: Some(false),
                valid_from: None,
                valid_until: None,
            },
            Some(user_id),
        )
        .await
        .expect("Failed to disable policy");

    // 12. Verify Access Restored (ReBAC Allow)
    let can_read_restored = services
        .rebac_service
        .check_permission_integrated(user_id, mission_alpha.id, "read", None, None, None)
        .await
        .expect("Restored check failed");
    assert!(
        can_read_restored,
        "Access should be RESTORED after policy deactivation"
    );
}

#[sqlx::test]
async fn test_policy_dynamic_keyword_access(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user_id = Uuid::new_v4();

    // 1. Setup User
    // Create VIP User Entity
    let user_class_id = sqlx::query_scalar!("SELECT id FROM classes WHERE name = 'User' LIMIT 1")
        .fetch_one(&pool).await.expect("User class not found");

    sqlx::query("INSERT INTO entities (id, class_id, display_name, attributes, approval_status) VALUES ($1, $2, $3, $4, 'APPROVED')")
        .bind(user_id)
        .bind(user_class_id)
        .bind("vip")
        .bind(serde_json::json!({"username": "vip", "email": "vip@test.com"}))
        .execute(&pool)
        .await
        .unwrap();

    // 2. Setup Entity (Secret Vault)
    let class = services
        .ontology_service
        .create_class(
            CreateClassInput {
                name: "Vault".to_string(),
                description: None,
                parent_class_id: None,
                is_abstract: Some(false),
            },
            Some(user_id),
        )
        .await
        .unwrap();

    let vault = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: class.id,
                display_name: "Secret Vault".to_string(),
                parent_entity_id: None,
                attributes: Some(
                    serde_json::json!({"status": "locked", "unlock_key": "OpenSesame"}),
                ),
            },
            Some(user_id),
            None,
        )
        .await
        .unwrap();

    // 3. User has NO ReBAC role (Baseline = No Access)
    let can_access_baseline = services
        .rebac_service
        .check_permission_integrated(user_id, vault.id, "open", None, None, None)
        .await
        .unwrap();
    assert!(!can_access_baseline, "Baseline should be false");

    // 4. Create 'Keyword Override' Policy
    // If request.keyword matches entity.unlock_key, then ALLOW (overriding lack of ReBAC)
    services
        .rebac_service
        .policy_service
        .create_policy(
            CreatePolicyInput {
                name: "Keyword Override".to_string(),
                description: Some("Allow access if keyword matches".to_string()),
                effect: "ALLOW".to_string(),
                priority: Some(200),
                target_class_id: Some(class.id),
                target_permissions: vec!["open".to_string()],
                conditions: serde_json::json!({
                    "all": [
                        {
                            "attribute": "entity.status",
                            "operator": "eq",
                            "value": "locked"
                        },
                        {
                            "attribute": "request.keyword",
                            "operator": "eq",
                            "value": "OpenSesame"
                        }
                    ]
                }),
                scope_entity_id: None,
                is_active: Some(true),
                valid_from: None,
                valid_until: None,
            },
            Some(user_id),
        )
        .await
        .unwrap();

    // 5. Test FAIL (No Keyword)
    let can_access_fail = services
        .rebac_service
        .check_permission_integrated(user_id, vault.id, "open", None, None, None)
        .await
        .unwrap();
    assert!(!can_access_fail, "Should FAIL without keyword");

    // 6. Test FAIL (Wrong Keyword)
    let mut wrong_context = serde_json::Map::new();
    wrong_context.insert("keyword".to_string(), serde_json::json!("WrongKey"));
    let can_access_wrong = services
        .rebac_service
        .check_permission_integrated(user_id, vault.id, "open", None, None, Some(wrong_context))
        .await
        .unwrap();
    assert!(!can_access_wrong, "Should FAIL with wrong keyword");

    // 7. Test SUCCESS (Correct Keyword)
    let mut correct_context = serde_json::Map::new();
    correct_context.insert("keyword".to_string(), serde_json::json!("OpenSesame"));
    let can_access_correct = services
        .rebac_service
        .check_permission_integrated(user_id, vault.id, "open", None, None, Some(correct_context))
        .await
        .unwrap();
    assert!(can_access_correct, "Should SUCCEED with correct keyword");
}
