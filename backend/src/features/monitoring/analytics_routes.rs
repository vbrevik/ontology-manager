use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::get,
    Extension,
    Router,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;
use tracing;

use super::analytics::MonitoringAnalytics;
use crate::features::auth::jwt::Claims;

/// Query parameters for timeline
#[derive(Debug, Deserialize)]
pub struct TimelineQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
    pub event_classes: Option<String>, // Comma-separated
    pub severity: Option<String>,
    pub hours: Option<i64>,
}

fn default_limit() -> i64 {
    100
}

/// Query parameters for trends
#[derive(Debug, Deserialize)]
pub struct TrendQuery {
    pub event_class: String,
    #[serde(default = "default_hours")]
    pub hours: i64,
    #[serde(default = "default_interval")]
    pub interval_minutes: i64,
}

fn default_hours() -> i64 {
    24
}

fn default_interval() -> i64 {
    60
}

/// Query parameters for hourly stats
#[derive(Debug, Deserialize)]
pub struct HourlyQuery {
    #[serde(default = "default_hours")]
    pub hours: i64,
}

/// Query parameters for general time-based queries
#[derive(Debug, Deserialize)]
pub struct TimeQuery {
    #[serde(default = "default_hours")]
    pub hours: i64,
}

/// Query parameters for top lists
#[derive(Debug, Deserialize)]
pub struct TopQuery {
    #[serde(default = "default_top_limit")]
    pub limit: i64,
}

fn default_top_limit() -> i64 {
    10
}

/// GET /api/monitoring/analytics/dashboard
/// Get dashboard statistics
pub async fn get_dashboard_stats(
    State(analytics): State<Arc<MonitoringAnalytics>>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<super::analytics::DashboardStats>, StatusCode> {
    analytics
        .get_dashboard_stats()
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to get dashboard stats: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/analytics/timeline
/// Get unified event timeline
pub async fn get_timeline(
    State(analytics): State<Arc<MonitoringAnalytics>>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<TimelineQuery>,
) -> Result<Json<Vec<super::analytics::TimelineEvent>>, StatusCode> {
    let event_classes = params.event_classes
        .map(|s| s.split(',').map(String::from).collect());
    
    let since = params.hours.map(|h| chrono::Utc::now() - chrono::Duration::hours(h));

    analytics
        .get_timeline(params.limit, params.offset, event_classes, params.severity, since)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to get timeline: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/analytics/hourly
/// Get hourly event statistics
pub async fn get_hourly_stats(
    State(analytics): State<Arc<MonitoringAnalytics>>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<HourlyQuery>,
) -> Result<Json<Vec<super::analytics::HourlyStats>>, StatusCode> {
    analytics
        .get_hourly_stats(params.hours)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to get hourly stats: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/analytics/top-ips
/// Get top attacking IPs
pub async fn get_top_ips(
    State(analytics): State<Arc<MonitoringAnalytics>>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<TopQuery>,
) -> Result<Json<Vec<super::analytics::IPReputation>>, StatusCode> {
    analytics
        .get_top_attacking_ips(params.limit)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to get top IPs: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/analytics/user-activity
/// Get user activity summary
pub async fn get_user_activity(
    State(analytics): State<Arc<MonitoringAnalytics>>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<TopQuery>,
) -> Result<Json<Vec<super::analytics::UserActivitySummary>>, StatusCode> {
    analytics
        .get_user_activity(params.limit)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to get user activity: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/analytics/distribution
/// Get event type distribution
pub async fn get_distribution(
    State(analytics): State<Arc<MonitoringAnalytics>>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<TimeQuery>,
) -> Result<Json<Vec<super::analytics::EventDistribution>>, StatusCode> {
    analytics
        .get_event_distribution(params.hours)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to get distribution: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/analytics/trend
/// Get trend for specific event type
pub async fn get_trend(
    State(analytics): State<Arc<MonitoringAnalytics>>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<TrendQuery>,
) -> Result<Json<Vec<super::analytics::TrendPoint>>, StatusCode> {
    analytics
        .get_event_trend(&params.event_class, params.hours, params.interval_minutes)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to get trend: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/analytics/anomalies
/// Detect anomalies in monitoring data
pub async fn get_anomalies(
    State(analytics): State<Arc<MonitoringAnalytics>>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<TimeQuery>,
) -> Result<Json<Vec<super::analytics::Anomaly>>, StatusCode> {
    analytics
        .detect_anomalies(params.hours)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to detect anomalies: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/analytics/severity
/// Get severity breakdown
pub async fn get_severity_breakdown(
    State(analytics): State<Arc<MonitoringAnalytics>>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<TimeQuery>,
) -> Result<Json<std::collections::HashMap<String, i64>>, StatusCode> {
    analytics
        .get_severity_breakdown(params.hours)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to get severity breakdown: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/analytics/health
/// Health check
pub async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "monitoring-analytics",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// Create analytics routes
pub fn create_analytics_routes(analytics: Arc<MonitoringAnalytics>) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/dashboard", get(get_dashboard_stats))
        .route("/timeline", get(get_timeline))
        .route("/hourly", get(get_hourly_stats))
        .route("/top-ips", get(get_top_ips))
        .route("/user-activity", get(get_user_activity))
        .route("/distribution", get(get_distribution))
        .route("/trend", get(get_trend))
        .route("/anomalies", get(get_anomalies))
        .route("/severity", get(get_severity_breakdown))
        .with_state(analytics)
}
