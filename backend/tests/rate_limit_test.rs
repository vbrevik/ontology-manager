// CVE-004 Rate Limiting Integration Tests
// 
// Tests verify that rate limiting protects against brute force attacks:
// - Login: 5 attempts per 15 minutes per IP
// - MFA: 10 attempts per 5 minutes per token
// - Password Reset: 3 requests per hour per IP
// - Registration: 3 accounts per hour per IP

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use sqlx::PgPool;
use template_repo_backend::features::rate_limit::models::CreateBypassToken;
use tower::ServiceExt;
use uuid::Uuid;

mod common;

#[sqlx::test]
async fn test_rate_limit_checks(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let identifier = Uuid::new_v4().to_string();
    let rule_id = "test_rule";

    // 1. Check initial rate limit (should pass as rule doesn't exist yet)
    let result = services
        .rate_limit_service
        .check_rate_limit(rule_id, &identifier)
        .await;
    assert!(result.is_ok());
}

#[sqlx::test]
async fn test_bypass_tokens(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Create Bypass Token
    let create = CreateBypassToken {
        description: Some("integration_test_token".to_string()),
        expires_at: None,
    };
    let bypass_token = services
        .rate_limit_service
        .create_bypass_token(create, None)
        .await
        .expect("Failed to create bypass token");

    assert!(!bypass_token.token.is_empty());

    // 2. Verify Bypass Token
    let is_valid = services
        .rate_limit_service
        .verify_bypass_token(&bypass_token.token)
        .await
        .expect("Failed to verify token");
    assert!(is_valid);

    // 3. Delete Bypass Token (Revoke/Delete) - using the UUID directly
    services
        .rate_limit_service
        .delete_bypass_token(bypass_token.id)
        .await
        .expect("Failed to delete bypass token");

    let is_valid_after = services
        .rate_limit_service
        .verify_bypass_token(&bypass_token.token)
        .await
        .expect("Failed to verify token after delete");
    assert!(!is_valid_after);
}

// CVE-004: Test login rate limiting (5 attempts per 15 minutes)
#[sqlx::test]
async fn test_cve004_login_rate_limit(pool: PgPool) {
    // Migration 20270127000000_rate_limit_ontology.sql seeds the rules
    let app = common::setup_test_app(pool.clone()).await;

    // Make 5 failed login attempts (should all succeed in being processed)
    for i in 1..=5 {
        let login_body = serde_json::json!({
            "username": format!("test_user_{}", i),
            "password": "wrong_password"
        });

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/auth/login")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&login_body).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        let status = response.status();
        eprintln!("Request {}: status = {}", i, status);
        
        // Should be 401 Unauthorized (wrong password), not 429 (rate limited)
        assert_ne!(
            status,
            StatusCode::TOO_MANY_REQUESTS,
            "Request {} should not be rate limited yet, got status {}",
            i,
            status
        );
    }

    // 6th attempt should be rate limited
    let login_body = serde_json::json!({
        "username": "test_user_6",
        "password": "wrong_password"
    });

    let response = app
        .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/auth/login")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&login_body).unwrap()))
                    .unwrap(),
        )
        .await
        .unwrap();

    let status = response.status();
    eprintln!("Request 6 (should be limited): status = {}", status);
    
    // Should be rate limited now
    assert_eq!(
        status,
        StatusCode::TOO_MANY_REQUESTS,
        "6th login attempt should be rate limited, got status {}", status
    );
}

// CVE-004: Test registration rate limiting (3 accounts per hour)
#[sqlx::test]
async fn test_cve004_registration_rate_limit(pool: PgPool) {
    // Migration 20270127000000_rate_limit_ontology.sql seeds the rules
    let app = common::setup_test_app(pool.clone()).await;

    // Make 3 registration attempts
    for i in 1..=3 {
        let register_body = serde_json::json!({
            "username": format!("newuser_{}", i),
            "email": format!("newuser_{}@example.com", i),
            "password": "Password123!"
        });

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/auth/register")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&register_body).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        // Should not be rate limited yet (may succeed or fail for other reasons)
        assert_ne!(
            response.status(),
            StatusCode::TOO_MANY_REQUESTS,
            "Request {} should not be rate limited yet",
            i
        );
    }

    // 4th attempt should be rate limited
    let register_body = serde_json::json!({
        "username": "newuser_4",
        "email": "newuser_4@example.com",
        "password": "Password123!"
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&register_body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        StatusCode::TOO_MANY_REQUESTS,
        "4th registration attempt should be rate limited"
    );
}

// CVE-004: Test password reset rate limiting (3 requests per hour)
#[sqlx::test]
async fn test_cve004_password_reset_rate_limit(pool: PgPool) {
    // Migration 20270127000000_rate_limit_ontology.sql seeds the rules
    let app = common::setup_test_app(pool.clone()).await;

    // Make 3 password reset requests
    for i in 1..=3 {
        let reset_body = serde_json::json!({
            "email": format!("user_{}@example.com", i)
        });

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/auth/forgot-password")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&reset_body).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_ne!(
            response.status(),
            StatusCode::TOO_MANY_REQUESTS,
            "Request {} should not be rate limited yet",
            i
        );
    }

    // 4th attempt should be rate limited
    let reset_body = serde_json::json!({
        "email": "user_4@example.com"
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/forgot-password")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&reset_body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        StatusCode::TOO_MANY_REQUESTS,
        "4th password reset attempt should be rate limited"
    );
}

// CVE-004: Test MFA rate limiting (10 attempts per 5 minutes)
#[sqlx::test]
async fn test_cve004_mfa_rate_limit(pool: PgPool) {
    // Migration 20270127000000_rate_limit_ontology.sql seeds the rules
    let services = common::setup_services(pool.clone()).await;
    let app = common::setup_test_app(pool.clone()).await;
    let user = common::create_test_user(&services, "mfa_test_user", "mfa@example.com", "Password123!")
        .await;

    // Setup MFA for user (this generates secret and backup codes)
    let _mfa_setup = services
        .mfa_service
        .setup_mfa(user.id, "mfa@example.com")
        .await
        .expect("Failed to setup MFA");

    // Make 10 MFA challenge attempts
    for i in 1..=10 {
        let mfa_body = serde_json::json!({
            "user_id": user.id,
            "code": format!("{:06}", i) // Wrong codes
        });

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/auth/mfa/challenge")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&mfa_body).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_ne!(
            response.status(),
            StatusCode::TOO_MANY_REQUESTS,
            "Request {} should not be rate limited yet",
            i
        );
    }

    // 11th attempt should be rate limited
    let mfa_body = serde_json::json!({
        "user_id": user.id,
        "code": "000011"
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/mfa/challenge")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_string(&mfa_body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        StatusCode::TOO_MANY_REQUESTS,
        "11th MFA attempt should be rate limited"
    );
}
