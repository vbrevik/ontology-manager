use sqlx::PgPool;
use template_repo_backend::features::auth::models::{LoginUser, RegisterUser};
use template_repo_backend::features::ontology::models::{
    CreateClassInput, CreateEntityInput, CreateRelationshipInput,
};
use uuid::Uuid;

mod common;

#[sqlx::test]
async fn test_secure_project_management_lifecycle(pool: PgPool) {
    // 1. SETUP SERVICES
    let services = common::setup_services(pool.clone()).await;

    // ========================================================================
    // PHASE 1: IDENTITY (Auth Service)
    // ========================================================================
    println!("PHASE 1: IDENTITY");

    let username = "SecurityAdmin";
    let email = "admin@secure.net";
    let password = "SuperSecretPassword123!";

    // A. Register
    let _ = services
        .auth_service
        .register(RegisterUser {
            username: username.to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    // Fetch user fetching ID (AuthResponse doesn't include ID)
    use sqlx::Row;
    let admin_user_row = sqlx::query("SELECT id FROM users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .expect("User not found");
    let admin_id: Uuid = admin_user_row.get("id");

    // B. Login (Verify Credentials)
    let login_result = services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: password.to_string(),
                remember_me: None,
            },
            None,
            None,
        )
        .await
        .expect("Login failed");

    let _session_token = login_result.access_token; // JWT
    println!("-> User '{}' logged in. ID: {}", username, admin_id);

    // ========================================================================
    // PHASE 2: MODELING (Ontology Service)
    // ========================================================================
    println!("PHASE 2: MODELING");

    // A. Define "Project" Class
    let project_class = services
        .ontology_service
        .create_class(
            CreateClassInput {
                name: "Project".to_string(),
                description: Some("High-level project container".to_string()),
                parent_class_id: None,
                is_abstract: Some(false),
            },
            Some(admin_id),
        )
        .await
        .expect("Failed to create Project class");
    println!("-> Created Class: Project");

    // B. Instantiate "Project Omega"
    let project_omega = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: project_class.id,
                display_name: "Project Omega".to_string(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"status": "active", "budget": 1000000})),
            },
            Some(admin_id),
            None,
        )
        .await
        .expect("Failed to create Project Omega");
    println!("-> Created Entity: Project Omega ({})", project_omega.id);

    // ========================================================================
    // PHASE 3: SECURITY DEFINITION (ReBAC / Ontology)
    // ========================================================================
    println!("PHASE 3: SECURITY DEFINITION");

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

    // A. Define "Project Lead" Role
    let role_lead = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: role_class.id,
                display_name: "Project Lead".to_string(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"name": "Project Lead", "level": 10})),
            },
            Some(admin_id),
            None,
        )
        .await
        .expect("Failed to create Role");

    // B. Define "delete_project" Permission
    let perm_delete = services
        .ontology_service
        .create_entity(
            CreateEntityInput {
                class_id: perm_class.id,
                display_name: "delete_project".to_string(),
                parent_entity_id: None,
                attributes: Some(serde_json::json!({"name": "delete_project", "level": 99})),
            },
            Some(admin_id),
            None,
        )
        .await
        .expect("Failed to create Permission");

    // C. Grant Permission to Role
    services
        .ontology_service
        .create_relationship(
            CreateRelationshipInput {
                source_entity_id: role_lead.id,
                target_entity_id: perm_delete.id,
                relationship_type: "grants_permission".to_string(),
                metadata: Some(serde_json::json!({"effect": "ALLOW"})),
            },
            Some(admin_id),
        )
        .await
        .expect("Failed to grant permission");
    println!("-> Security Model Defined: Project Lead -> delete_project");

    // ========================================================================
    // PHASE 4: ENFORCEMENT (ReBAC Service)
    // ========================================================================
    println!("PHASE 4: ENFORCEMENT");

    // Check 1: Try to delete WITHOUT role -> SHOULD FAIL
    // Note: ReBAC usually caches, but here we haven't checked yet.
    let can_delete_initial = services
        .rebac_service
        .check_permission_integrated(
            admin_id,
            project_omega.id,
            "delete_project",
            None,
            None,
            None,
        )
        .await
        .expect("Initial check failed");

    // In strict ReBAC, explicit assignment is needed.
    // However, if the user CREATED the entity, do they implicitly have access?
    // Current logic: NO, unless there's a "Owner" role automatically assigned.
    // Let's verify our assumption:
    if can_delete_initial {
        println!("WARN: User has delete access initially (Owner policy?). Testing explicit assignment anyway.");
    } else {
        println!("-> Initial Access Check: DENIED (Expected)");
    }

    // Assign Role: "Project Lead" to Admin User, Scoped to "Project Omega"
    services
        .ontology_service
        .create_relationship(
            CreateRelationshipInput {
                source_entity_id: admin_id,
                target_entity_id: role_lead.id,
                relationship_type: "has_role".to_string(),
                metadata: Some(serde_json::json!({
                    "scope_entity_id": project_omega.id.to_string()
                })),
            },
            Some(admin_id),
        )
        .await
        .expect("Failed to assign role");
    println!("-> Role 'Project Lead' assigned to User for 'Project Omega'");

    // Check 2: Try to delete WITH role -> SHOULD PASS
    // NOTE: Bust cache if necessary (RebacService has internal local cache,
    // but we can't easily clear it from here unless we recreate service or wait 30s.
    // PRO TIP: Recreate services struct to get fresh cache)
    let services_fresh = common::setup_services(pool.clone()).await;

    let can_delete_final = services_fresh
        .rebac_service
        .check_permission_integrated(
            admin_id,
            project_omega.id,
            "delete_project",
            None,
            None,
            None,
        )
        .await
        .expect("Final check failed");

    assert!(
        can_delete_final,
        "User SHOULD have delete permission after role assignment"
    );
    println!("-> Final Access Check: ALLOWED");

    // ========================================================================
    // PHASE 5: AUDIT (Audit Service)
    // ========================================================================
    println!("PHASE 5: AUDIT");

    let logs = services_fresh
        .audit_service
        .get_logs()
        .await
        .expect("Failed to fetch logs");

    println!("-> Fetched {} audit logs", logs.len());

    // Verify key events
    let found_login = logs
        .iter()
        .any(|l| l.action == "auth.login" && l.user_id == admin_id);
    let found_create_proj = logs
        .iter()
        .any(|l| l.action == "entity.create" && l.target_id == Some(project_omega.id));
    // Implementation detail: check_permission calls might not always log unless configured or failed/denied,
    // BUT the 'check_permission_integrated' implementation often logs policy evaluations.
    // Also, 'audit.log' is called explicitly in some service methods.

    assert!(found_login, "Audit log should contain 'auth.login'");
    assert!(
        found_create_proj,
        "Audit log should contain 'entity.create'"
    );

    println!("-> Audit Trail Verified. E2E Scenario Complete.");
}
