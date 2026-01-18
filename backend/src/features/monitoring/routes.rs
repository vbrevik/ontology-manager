use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use serde::Deserialize;
use std::sync::Arc;

use super::service::MonitoringService;

/// Query parameters for listing events
#[derive(Debug, Deserialize)]
pub struct ListEventsQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

/// GET /api/monitoring/dashboard
/// Get dashboard statistics
pub async fn get_dashboard(
    State(service): State<Arc<MonitoringService>>,
) -> Result<Json<super::service::DashboardStats>, StatusCode> {
    service
        .get_dashboard_stats()
        .await
        .map(Json)
        .map_err(|e| {
            log::error!("Failed to get dashboard stats: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/events/recent
/// Get recent security events
pub async fn get_recent_events(
    State(service): State<Arc<MonitoringService>>,
    Query(params): Query<ListEventsQuery>,
) -> Result<Json<Vec<super::models::SecurityEvent>>, StatusCode> {
    service
        .get_recent_security_events(params.limit)
        .await
        .map(Json)
        .map_err(|e| {
            log::error!("Failed to get recent events: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/events/summary
/// Get security event summary
pub async fn get_event_summary(
    State(service): State<Arc<MonitoringService>>,
) -> Result<Json<Vec<super::models::SecurityEventSummary>>, StatusCode> {
    service
        .get_security_event_summary()
        .await
        .map(Json)
        .map_err(|e| {
            log::error!("Failed to get event summary: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/auth/failed
/// Get recent failed auth attempts
pub async fn get_failed_auth(
    State(service): State<Arc<MonitoringService>>,
    Query(params): Query<ListEventsQuery>,
) -> Result<Json<Vec<super::models::FailedAuthAttempt>>, StatusCode> {
    service
        .get_recent_failed_auth(params.limit)
        .await
        .map(Json)
        .map_err(|e| {
            log::error!("Failed to get failed auth: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/auth/by-ip
/// Get failed auth attempts grouped by IP
pub async fn get_failed_auth_by_ip(
    State(service): State<Arc<MonitoringService>>,
) -> Result<Json<Vec<super::models::FailedAuthByIp>>, StatusCode> {
    service
        .get_failed_auth_by_ip()
        .await
        .map(Json)
        .map_err(|e| {
            log::error!("Failed to get failed auth by IP: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/alerts/rules
/// Get alert rules
pub async fn get_alert_rules(
    State(service): State<Arc<MonitoringService>>,
) -> Result<Json<Vec<super::models::AlertRule>>, StatusCode> {
    service
        .get_alert_rules()
        .await
        .map(Json)
        .map_err(|e| {
            log::error!("Failed to get alert rules: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/health
/// Health check endpoint
pub async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "monitoring",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// Create monitoring routes
/// All routes require admin authentication
pub fn create_monitoring_routes(service: Arc<MonitoringService>) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/dashboard", get(get_dashboard))
        .route("/events/recent", get(get_recent_events))
        .route("/events/summary", get(get_event_summary))
        .route("/auth/failed", get(get_failed_auth))
        .route("/auth/by-ip", get(get_failed_auth_by_ip))
        .route("/alerts/rules", get(get_alert_rules))
        .with_state(service)
}
