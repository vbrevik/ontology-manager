use axum::{
    routing::get,
    Json, Router, extract::State,
};
use super::service::SystemService;
use super::models::SystemMetricsResponse;

pub fn system_routes() -> Router<SystemService> {
    Router::new()
        .route("/metrics", get(get_system_metrics))
}

async fn get_system_metrics(
    State(service): State<SystemService>,
) -> Json<SystemMetricsResponse> {
    let metrics = service.get_metrics();
    Json(metrics)
}
