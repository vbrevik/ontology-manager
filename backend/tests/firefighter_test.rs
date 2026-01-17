use sqlx::PgPool;

mod common;

#[sqlx::test]
async fn test_firefighter_activation_lifecycle(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    // Create user with specific password for verification
    let user = services
        .user_service
        .create("ff_test_user", "ff@e.com", "password123", None)
        .await
        .unwrap();

    // 1. Activate Firefighter Mode (request_elevation)
    let justification = "Integration Test Emergency";
    let session = services
        .firefighter_service
        .request_elevation(
            user.id,
            "password123",
            justification.to_string(),
            Some(30),
            None,
            None,
        )
        .await
        .expect("Failed to activate firefighter");

    assert_eq!(session.user_id, user.id);
    assert_eq!(session.justification, justification);
    assert!(session.deactivated_at.is_none());

    // 2. Check Active Session (get_status)
    let status = services
        .firefighter_service
        .get_status(user.id)
        .await
        .expect("Failed to get status");
    assert!(status.is_active);
    assert!(status.session.is_some());

    // 3. Deactivate Firefighter Mode (deactivate)
    services
        .firefighter_service
        .deactivate(user.id, Some("Resolved".to_string()))
        .await
        .expect("Failed to deactivate firefighter");

    let status_after = services
        .firefighter_service
        .get_status(user.id)
        .await
        .expect("Failed to check status again");
    assert!(!status_after.is_active);
}

#[sqlx::test]
async fn test_firefighter_invalid_password(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;
    let user = services
        .user_service
        .create("ff_fail_user", "ff_fail@e.com", "password123", None)
        .await
        .unwrap();

    let result = services
        .firefighter_service
        .request_elevation(
            user.id,
            "wrong_password",
            "Breakglass".to_string(),
            None,
            None,
            None,
        )
        .await;
    assert!(result.is_err());
}
