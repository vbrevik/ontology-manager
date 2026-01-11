use axum::{
    routing::{get, post},
    Json, Router, extract::{State, Path},
    http::StatusCode,
};
use super::service::SystemService;
use super::models::{SystemMetricsResponse, GeneratedReport, CreateReportRequest};
use crate::features::auth::models::AuditLog;

pub fn system_routes() -> Router<SystemService> {
    Router::new()
        .route("/metrics", get(get_system_metrics))
        .route("/logs", get(get_system_logs))
        .route("/reports", get(get_system_reports).post(generate_system_report))
}

async fn get_system_metrics(
    State(service): State<SystemService>,
) -> Json<SystemMetricsResponse> {
    let metrics = service.get_metrics();
    Json(metrics)
}

async fn get_system_logs(
    State(service): State<SystemService>,
) -> Result<Json<Vec<AuditLog>>, (StatusCode, String)> {
    match service.get_logs().await {
        Ok(logs) => Ok(Json(logs)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

async fn get_system_reports(
    State(service): State<SystemService>,
) -> Result<Json<Vec<GeneratedReport>>, (StatusCode, String)> {
    match service.get_reports().await {
        Ok(reports) => Ok(Json(reports)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

async fn generate_system_report(
    State(service): State<SystemService>,
    Json(payload): Json<CreateReportRequest>,
) -> Result<Json<GeneratedReport>, (StatusCode, String)> {
    match service.generate_report(payload.report_type).await {
        Ok(report) => Ok(Json(report)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}
