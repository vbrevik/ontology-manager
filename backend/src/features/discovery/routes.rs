use crate::features::auth::service::AuthError;
use crate::features::discovery::models::{
    HeartbeatRequest, RegisterServiceRequest, ServiceInstance,
};
use crate::features::discovery::service::DiscoveryService;
use axum::{extract::State, routing::get, routing::post, Json, Router};

pub fn discovery_routes() -> Router<DiscoveryService> {
    Router::new()
        .route("/register", post(register_handler))
        .route("/heartbeat", post(heartbeat_handler))
        .route("/services", get(list_services_handler))
        .route("/services/:id", get(get_service_handler))
}

async fn get_service_handler(
    State(service): State<DiscoveryService>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ServiceInstance>, AuthError> {
    service
        .get_service(&id)
        .await
        .map(Json)
        .ok_or(AuthError::UserNotFound) // Reusing UserNotFound for simplicity or define DiscoveryError
}

async fn register_handler(
    State(service): State<DiscoveryService>,
    Json(req): Json<RegisterServiceRequest>,
) -> Json<serde_json::Value> {
    let id = service.register(req).await;
    Json(serde_json::json!({ "id": id }))
}

async fn heartbeat_handler(
    State(service): State<DiscoveryService>,
    Json(req): Json<HeartbeatRequest>,
) -> Result<Json<serde_json::Value>, AuthError> {
    if service.heartbeat(&req.service_id).await {
        Ok(Json(serde_json::json!({ "success": true })))
    } else {
        Err(AuthError::ValidationError(
            "Service ID not found".to_string(),
        ))
    }
}

async fn list_services_handler(
    State(service): State<DiscoveryService>,
) -> Json<Vec<ServiceInstance>> {
    let services = service.list_services().await;
    Json(services)
}
