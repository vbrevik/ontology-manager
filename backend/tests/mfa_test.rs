use sqlx::PgPool;
use uuid::Uuid;

mod common;

#[sqlx::test]
async fn test_mfa_setup_flow(pool: PgPool) {
    // Create a test user
    let user_id = Uuid::new_v4();
    let email = format!("mfa_test_{}@example.com", user_id);
    
    // Get User class ID
    let user_class_id = sqlx::query_scalar!("SELECT id FROM classes WHERE name = 'User' LIMIT 1")
        .fetch_one(&pool).await.expect("User class not found");

    sqlx::query!(
        "INSERT INTO entities (id, class_id, display_name, attributes) VALUES ($1, $2, $3, $4)",
        user_id,
        user_class_id,
        email,
        serde_json::json!({
            "username": email,
            "email": email,
            "password_hash": "test_hash"
        })
    )
    .execute(&pool)
    .await
    .expect("Failed to create test user");
    
    // Create MFA service
    let mfa_service = template_repo_backend::features::auth::mfa::MfaService::new(
        pool.clone(),
        "TestApp".to_string(),
    );
    
    // Setup MFA
    let setup_result = mfa_service.setup_mfa(user_id, &email).await;
    assert!(setup_result.is_ok(), "MFA setup should succeed: {:?}", setup_result.err());
    
    let setup = setup_result.unwrap();
    assert!(!setup.secret.is_empty(), "Secret should not be empty");
    assert!(!setup.qr_code_url.is_empty(), "QR code URL should not be empty");
    assert_eq!(setup.backup_codes.len(), 8, "Should have 8 backup codes");
    
    // Verify MFA status (not yet enabled)
    let status = mfa_service.get_status(user_id).await.unwrap();
    assert!(!status.is_enabled, "MFA should not be enabled yet");
    assert!(!status.is_verified, "MFA should not be verified yet");
    assert_eq!(status.backup_codes_remaining, 8, "Should have 8 backup codes remaining");
    
    // Generate a valid TOTP code using the secret
    use totp_rs::{Algorithm, Secret, TOTP};
    let secret = Secret::Encoded(setup.secret.clone());
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret.to_bytes().unwrap(),
        Some("TestApp".to_string()),
        email.clone(),
    ).unwrap();
    
    let valid_code = totp.generate_current().unwrap();
    
    // Verify setup with valid code
    let verify_result = mfa_service.verify_setup(user_id, &valid_code).await;
    assert!(verify_result.is_ok(), "Verify setup should succeed with valid code");
    
    // Verify MFA is now enabled
    let status = mfa_service.get_status(user_id).await.unwrap();
    assert!(status.is_enabled, "MFA should be enabled");
    assert!(status.is_verified, "MFA should be verified");
}

#[sqlx::test]
async fn test_mfa_backup_code_usage(pool: PgPool) {
    // Create a test user
    let user_id = Uuid::new_v4();
    let email = format!("mfa_backup_{}@example.com", user_id);
    
    // Get User class ID
    let user_class_id = sqlx::query_scalar!("SELECT id FROM classes WHERE name = 'User' LIMIT 1")
        .fetch_one(&pool).await.expect("User class not found");

    sqlx::query!(
        "INSERT INTO entities (id, class_id, display_name, attributes) VALUES ($1, $2, $3, $4)",
        user_id,
        user_class_id,
        email,
        serde_json::json!({
            "username": email,
            "email": email,
            "password_hash": "test_hash"
        })
    )
    .execute(&pool)
    .await
    .expect("Failed to create test user");
    
    let mfa_service = template_repo_backend::features::auth::mfa::MfaService::new(
        pool.clone(),
        "TestApp".to_string(),
    );
    
    // Setup and verify MFA
    let setup = mfa_service.setup_mfa(user_id, &email).await.unwrap();
    
    // Manually enable MFA for backup code test (skip TOTP verification)
    sqlx::query("UPDATE entities SET attributes = attributes || '{\"mfa_enabled\": true, \"mfa_verified\": true}'::jsonb WHERE id = $1")
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();
    
    // Use a backup code
    let first_backup_code = &setup.backup_codes[0];
    let verify_result = mfa_service.verify_backup_code(user_id, first_backup_code).await;
    assert!(verify_result.is_ok(), "Backup code should verify successfully");
    
    // Check remaining codes
    let status = mfa_service.get_status(user_id).await.unwrap();
    assert_eq!(status.backup_codes_remaining, 7, "Should have 7 backup codes remaining");
    
    // Try using the same code again - should fail
    let reuse_result = mfa_service.verify_backup_code(user_id, first_backup_code).await;
    assert!(reuse_result.is_err(), "Reusing backup code should fail");
}

#[sqlx::test]
async fn test_mfa_disable(pool: PgPool) {
    // Create a test user
    let user_id = Uuid::new_v4();
    let email = format!("mfa_disable_{}@example.com", user_id);
    
    // Get User class ID
    let user_class_id = sqlx::query_scalar!("SELECT id FROM classes WHERE name = 'User' LIMIT 1")
        .fetch_one(&pool).await.expect("User class not found");

    sqlx::query!(
        "INSERT INTO entities (id, class_id, display_name, attributes) VALUES ($1, $2, $3, $4)",
        user_id,
        user_class_id,
        email,
        serde_json::json!({
            "username": email,
            "email": email,
            "password_hash": "test_hash"
        })
    )
    .execute(&pool)
    .await
    .expect("Failed to create test user");
    
    let mfa_service = template_repo_backend::features::auth::mfa::MfaService::new(
        pool.clone(),
        "TestApp".to_string(),
    );
    
    // Setup and verify MFA
    mfa_service.setup_mfa(user_id, &email).await.unwrap();
    
    // Manually enable MFA
    sqlx::query("UPDATE entities SET attributes = attributes || '{\"mfa_enabled\": true, \"mfa_verified\": true}'::jsonb WHERE id = $1")
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();
    
    // Verify it's enabled
    let status = mfa_service.get_status(user_id).await.unwrap();
    assert!(status.is_enabled, "MFA should be enabled before disable");
    
    // Disable MFA
    let disable_result = mfa_service.disable_mfa(user_id).await;
    assert!(disable_result.is_ok(), "Disable should succeed");
    
    // Verify MFA is now disabled
    let status = mfa_service.get_status(user_id).await.unwrap();
    assert!(!status.is_enabled, "MFA should be disabled");
}
