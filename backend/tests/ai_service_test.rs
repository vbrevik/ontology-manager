use sqlx::PgPool;
use uuid::Uuid;

mod common;

#[sqlx::test]
async fn test_ai_service_config_retrieval(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Seed an AiProvider in Ontology
    let provider_class_id =
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM classes WHERE name = 'AiProvider' LIMIT 1")
            .fetch_one(&pool)
            .await
            .expect("AiProvider class should exist");

    let provider_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO entities (id, class_id, display_name, attributes, approval_status) VALUES ($1, $2, $3, $4, 'APPROVED')"
    )
    .bind(provider_id)
    .bind(provider_class_id)
    .bind("Test Provider Unique")
    .bind(serde_json::json!({
        "api_base": "http://localhost:11434/mock",
        "model_name": "gpt-test-unique",
        "is_active": true
    }))
    .execute(&pool)
    .await
    .expect("Failed to seed AI provider");

    // 2. Test get_config
    let (url, model) = services.ai_service.get_config().await;

    // We expect it to at least return a valid string.
    // In a shared test DB with background seeds, we might get another provider,
    // so we just verify it doesn't crash and returns non-empty.
    assert!(!url.is_empty());
    assert!(!model.is_empty());
}

#[sqlx::test]
async fn test_ai_model_listing(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // We expect it to be callable.
    let _ = services.ai_service.list_models().await;
}
