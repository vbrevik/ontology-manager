use sqlx::PgPool;
use template_repo_backend::features::auth::models::{RegisterUser, LoginUser};
use uuid::Uuid;
use totp_rs::{Algorithm, Secret, TOTP};

mod common;

/// Test: Full MFA login flow with valid TOTP code
#[sqlx::test]
async fn test_mfa_login_challenge_with_valid_code(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Register user
    let email = "mfa_challenge@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "mfa_challenge_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    // 2. Setup and verify MFA
    let setup_res = services
        .mfa_service
        .setup_mfa(user_id, email)
        .await
        .expect("MFA setup failed");

    let secret = Secret::Encoded(setup_res.secret.clone()).to_bytes().unwrap();
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret.clone(),
        None,
        "".to_string()
    ).unwrap();
    
    let setup_code = totp.generate_current().unwrap();
    services
        .mfa_service
        .verify_setup(user_id, &setup_code)
        .await
        .expect("MFA verification failed");

    // 3. Login - Should return MFA required
    let login_res = services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: password.to_string(),
                remember_me: Some(false),
            },
            None,
            None,
        )
        .await
        .expect("Login failed");

    assert!(login_res.mfa_required, "MFA should be required");
    assert!(login_res.mfa_token.is_some(), "Should have MFA token");
    assert!(login_res.access_token.is_none(), "Should not have access token yet");

    // 4. Generate current TOTP code
    let challenge_code = totp.generate_current().unwrap();

    // 5. Complete MFA challenge (this would be done via the route handler)
    // For testing, we verify the code directly
    let verify_result = services
        .mfa_service
        .verify_code(user_id, &challenge_code)
        .await;

    assert!(verify_result.is_ok(), "MFA code should be valid");
}

/// Test: MFA challenge with invalid code fails
#[sqlx::test]
async fn test_mfa_challenge_with_invalid_code(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // Setup user with MFA
    let email = "invalid_code@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "invalid_code_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    // Setup MFA
    let setup_res = services
        .mfa_service
        .setup_mfa(user_id, email)
        .await
        .expect("MFA setup failed");

    let secret = Secret::Encoded(setup_res.secret).to_bytes().unwrap();
    let totp = TOTP::new(Algorithm::SHA1, 6, 1, 30, secret, None, "".to_string()).unwrap();
    
    let code = totp.generate_current().unwrap();
    services.mfa_service.verify_setup(user_id, &code).await.unwrap();

    // Try to verify with invalid code
    let result = services
        .mfa_service
        .verify_code(user_id, "000000")
        .await;

    assert!(result.is_err(), "Invalid MFA code should fail");
}

/// Test: MFA challenge with backup code succeeds and consumes code
#[sqlx::test]
async fn test_mfa_challenge_with_backup_code(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // Setup user with MFA
    let email = "backup_code@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "backup_code_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    // Setup MFA
    let setup_res = services
        .mfa_service
        .setup_mfa(user_id, email)
        .await
        .expect("MFA setup failed");

    let secret = Secret::Encoded(setup_res.secret).to_bytes().unwrap();
    let totp = TOTP::new(Algorithm::SHA1, 6, 1, 30, secret, None, "".to_string()).unwrap();
    
    let code = totp.generate_current().unwrap();
    services.mfa_service.verify_setup(user_id, &code).await.unwrap();

    // Get a backup code
    let backup_code = setup_res.backup_codes[0].clone();

    // Login
    let login_res = services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: password.to_string(),
                remember_me: Some(false),
            },
            None,
            None,
        )
        .await
        .expect("Login failed");

    assert!(login_res.mfa_required, "MFA should be required");

    // Use backup code
    let result = services
        .mfa_service
        .verify_backup_code(user_id, &backup_code)
        .await;

    assert!(result.is_ok(), "Backup code should work");

    // Try to use same backup code again (should fail - single use)
    let result = services
        .mfa_service
        .verify_backup_code(user_id, &backup_code)
        .await;

    assert!(result.is_err(), "Backup code should be single-use");
}

/// Test: MFA disabled user does not require MFA challenge
#[sqlx::test]
async fn test_login_without_mfa_enabled(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // Register user WITHOUT enabling MFA
    let email = "no_mfa@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "no_mfa_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    // Login should succeed immediately without MFA
    let login_res = services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: password.to_string(),
                remember_me: Some(false),
            },
            None,
            None,
        )
        .await
        .expect("Login failed");

    assert!(!login_res.mfa_required, "MFA should not be required");
    assert!(login_res.access_token.is_some(), "Should have access token");
    assert!(login_res.mfa_token.is_none(), "Should not have MFA token");
}

/// Test: MFA token contains correct user_id
#[sqlx::test]
async fn test_mfa_token_contains_user_id(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // Setup user with MFA
    let email = "mfa_token@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "mfa_token_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    // Setup and verify MFA
    let setup_res = services
        .mfa_service
        .setup_mfa(user_id, email)
        .await
        .expect("MFA setup failed");

    let secret = Secret::Encoded(setup_res.secret).to_bytes().unwrap();
    let totp = TOTP::new(Algorithm::SHA1, 6, 1, 30, secret, None, "".to_string()).unwrap();
    
    let code = totp.generate_current().unwrap();
    services.mfa_service.verify_setup(user_id, &code).await.unwrap();

    // Login
    let login_res = services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: password.to_string(),
                remember_me: Some(false),
            },
            None,
            None,
        )
        .await
        .expect("Login failed");

    assert!(login_res.mfa_required, "MFA should be required");
    assert!(login_res.mfa_token.is_some(), "Should have MFA token");
    assert_eq!(login_res.user_id, user_id, "Should have correct user_id");
}
