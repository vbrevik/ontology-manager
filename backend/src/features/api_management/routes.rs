use axum::{
    routing::{get, post, delete},
    Json, Router, extract::{State, Path},
    http::StatusCode,
};
use uuid::Uuid;
use super::service::ApiManagementService;
use super::models::{ApiKey, CreateApiKeyRequest, CreateApiKeyResponse, WebhookEndpoint};

pub fn api_management_routes() -> Router<ApiManagementService> {
    Router::new()
        .route("/keys", get(list_api_keys).post(create_api_key))
        .route("/keys/:id", delete(revoke_api_key))
        .route("/webhooks", get(list_webhooks))
}

async fn list_api_keys(
    State(service): State<ApiManagementService>,
) -> Result<Json<Vec<ApiKey>>, (StatusCode, String)> {
    match service.list_keys().await {
        Ok(keys) => Ok(Json(keys)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

async fn create_api_key(
    State(service): State<ApiManagementService>,
    Json(payload): Json<CreateApiKeyRequest>,
) -> Result<Json<CreateApiKeyResponse>, (StatusCode, String)> {
    let scopes = payload.scopes.unwrap_or_else(|| vec!["read:*".to_string()]);
    match service.create_key(payload.name, scopes).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

async fn revoke_api_key(
    State(service): State<ApiManagementService>,
    Path(id): Path<Uuid>,
) -> Result<(), (StatusCode, String)> {
    match service.revoke_key(id).await {
        Ok(_) => Ok(()),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

async fn list_webhooks(
    State(service): State<ApiManagementService>,
) -> Result<Json<Vec<WebhookEndpoint>>, (StatusCode, String)> {
    match service.list_webhooks().await {
        Ok(webhooks) => Ok(Json(webhooks)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}
