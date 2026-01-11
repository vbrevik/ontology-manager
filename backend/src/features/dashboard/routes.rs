use axum::{
    routing::get,
    Json, Router, extract::State,
    http::StatusCode,
};

use super::service::DashboardService;
use super::models::{DashboardStats, ActivityEntry, AdminDashboardStats};

pub fn dashboard_routes() -> Router<DashboardService> {
    Router::new()
        .route("/stats", get(stats_handler))
        .route("/activity", get(activity_handler))
        .route("/admin-stats", get(admin_stats_handler))
}

async fn stats_handler(State(service): State<DashboardService>) -> Result<Json<DashboardStats>, (StatusCode, String)> {
    match service.get_dashboard_stats().await {
        Ok(stats) => Ok(Json(stats)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

async fn activity_handler(State(service): State<DashboardService>) -> Result<Json<Vec<ActivityEntry>>, (StatusCode, String)> {
    match service.get_recent_activity(10).await {
        Ok(activity) => Ok(Json(activity)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

async fn admin_stats_handler(State(service): State<DashboardService>) -> Result<Json<AdminDashboardStats>, (StatusCode, String)> {
    match service.get_admin_stats().await {
        Ok(stats) => Ok(Json(stats)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}
