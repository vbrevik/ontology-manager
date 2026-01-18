use sqlx::PgPool;
use uuid::Uuid;

mod common;

#[sqlx::test]
async fn test_user_crud_flow_with_ontology_sync(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Create User
    let username = "service_test_user";
    let email = "service_test@example.com";
    let password = "Password123!";

    let user = services
        .user_service
        .create(username, email, password, None)
        .await
        .expect("Failed to create user via service");

    assert_eq!(user.username, username);
    assert_eq!(user.email.as_deref(), Some(email));

    // 2. Verify SQL Existence
    let sql_user = services
        .user_service
        .find_by_id(&user.id.to_string())
        .await
        .expect("Failed to find user in SQL");
    assert_eq!(sql_user.username, username);

    // 3. Verify Ontology Existence (Dual-write check)
    let user_class = services
        .ontology_service
        .get_system_class("User")
        .await
        .expect("Missing User class");
    let entity_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM entities WHERE class_id = $1 AND attributes->>'user_id' = $2",
    )
    .bind(user_class.id)
    .bind(user.id.to_string())
    .fetch_optional(&pool)
    .await
    .expect("DB error searching for entity")
    .expect("Ontology entity not created for user");

    // 4. Update User
    let new_username = "updated_service_user";
    let updated_user = services
        .user_service
        .update(
            &user.id.to_string(),
            Some(new_username.to_string()),
            None,
            None,
        )
        .await
        .expect("Failed to update user");

    assert_eq!(updated_user.username, new_username);

    // 5. Verify Ontology Update Sync
    let updated_entity_attrs =
        sqlx::query_scalar::<_, serde_json::Value>("SELECT attributes FROM entities WHERE id = $1")
            .bind(entity_id)
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(
        updated_entity_attrs
            .get("username")
            .and_then(|v| v.as_str()),
        Some(new_username)
    );

    // 6. Delete User
    services
        .user_service
        .delete(&user.id.to_string(), None)
        .await
        .expect("Failed to delete user");

    // 7. Verify Deletion in SQL
    let find_res = services.user_service.find_by_id(&user.id.to_string()).await;
    assert!(find_res.is_err(), "User should be deleted from SQL");
}

#[sqlx::test]
async fn test_find_all_users(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // Create a few users
    services
        .user_service
        .create("u1", "u1@e.com", "p", None)
        .await
        .unwrap();
    services
        .user_service
        .create("u2", "u2@e.com", "p", None)
        .await
        .unwrap();

    let all = services
        .user_service
        .find_all()
        .await
        .expect("Failed to list users");
    assert!(all.len() >= 2);
}
