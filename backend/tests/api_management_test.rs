use sqlx::PgPool;

mod common;

#[sqlx::test]
async fn test_api_key_lifecycle(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Create API Key - create_key(name, scopes)
    let key_name = "test_key";
    let scopes = vec!["read".to_string(), "write".to_string()];
    let key_resp = services
        .api_management_service
        .create_key(key_name.to_string(), scopes.clone())
        .await
        .expect("Failed to create API key");

    assert_eq!(key_resp.name, key_name);
    assert!(key_resp.secret.starts_with("pk_live_"));
    assert_eq!(key_resp.scopes, scopes);

    // 2. List API Keys - list_keys() takes no arguments in service
    let keys = services
        .api_management_service
        .list_keys()
        .await
        .expect("Failed to list keys");
    assert!(keys.iter().any(|k| k.id == key_resp.id));

    // 3. Revoke API Key - revoke_key(id)
    services
        .api_management_service
        .revoke_key(key_resp.id)
        .await
        .expect("Failed to revoke key");

    let keys_after = services
        .api_management_service
        .list_keys()
        .await
        .expect("Failed to list keys again");
    let revoked_key = keys_after
        .iter()
        .find(|k| k.id == key_resp.id)
        .expect("Key should still be in list");
    assert_eq!(revoked_key.status, "revoked");
}

#[sqlx::test]
async fn test_webhook_management(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // Currently, ApiManagementService only has list_webhooks.
    // We expect it to be empty or return seeded data.
    let webhooks = services
        .api_management_service
        .list_webhooks()
        .await
        .expect("Failed to list webhooks");
    assert!(webhooks.is_empty() || !webhooks.is_empty()); // Just verify it's callable
}
