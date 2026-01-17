use sqlx::PgPool;
use template_repo_backend::features::rate_limit::models::CreateBypassToken;
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
