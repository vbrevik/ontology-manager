use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{get, post},
    Extension,
    Router,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;
use tracing;

use super::unified_service::UnifiedMonitoringService;
use crate::features::auth::jwt::Claims;

/// Query parameters for listing
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

/// GET /api/monitoring/ontology/failed-auth
/// Get failed auth attempts from ontology (with ABAC filtering)
pub async fn get_failed_auth_ontology(
    State(service): State<Arc<UnifiedMonitoringService>>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListQuery>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    service
        .get_failed_auth_ontology(user_id, params.limit)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to get failed auth from ontology: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/ontology/security-events
/// Get security events from ontology (with ABAC filtering)
pub async fn get_security_events_ontology(
    State(service): State<Arc<UnifiedMonitoringService>>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListQuery>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    service
        .get_security_events_ontology(user_id, params.limit)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to get security events from ontology: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/ontology/alert-rules
/// Get alert rules from ontology (with ABAC filtering)
pub async fn get_alert_rules_ontology(
    State(service): State<Arc<UnifiedMonitoringService>>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    service
        .get_alert_rules_ontology(user_id)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to get alert rules from ontology: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

/// GET /api/monitoring/ontology/entity/:id
/// Get specific monitoring entity with permission check
pub async fn get_monitoring_entity(
    State(service): State<Arc<UnifiedMonitoringService>>,
    Extension(claims): Extension<Claims>,
    Path(entity_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Check permission
    let can_view = service
        .check_monitoring_permission(user_id, entity_id, "view_security_events")
        .await
        .map_err(|e| {
            tracing::error!("Permission check failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if !can_view {
        return Err(StatusCode::FORBIDDEN);
    }

    // Log the access
    service
        .log_entity_access(user_id, entity_id, "view")
        .await
        .ok();

    // Get entity
    let entity = sqlx::query!(
        r#"
        SELECT 
            e.id,
            e.class_id,
            c.name as class_name,
            e.display_name,
            e.attributes,
            e.created_at,
            e.updated_at
        FROM entities e
        JOIN classes c ON c.id = e.class_id
        WHERE e.id = $1
          AND e.deleted_at IS NULL
        "#,
        entity_id
    )
    .fetch_optional(service.db())
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match entity {
        Some(e) => {
            let mut attrs = e.attributes.clone();
            if let Some(obj) = attrs.as_object_mut() {
                obj.insert("id".to_string(), serde_json::json!(e.id));
                obj.insert("class_name".to_string(), serde_json::json!(e.class_name));
                obj.insert("display_name".to_string(), serde_json::json!(e.display_name));
                obj.insert("created_at".to_string(), serde_json::json!(e.created_at));
                obj.insert("updated_at".to_string(), serde_json::json!(e.updated_at));
            }
            Ok(Json(attrs))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// POST /api/monitoring/ontology/failed-auth
/// Create failed auth attempt in ontology
pub async fn create_failed_auth_ontology(
    State(service): State<Arc<UnifiedMonitoringService>>,
    Json(request): Json<super::models::CreateFailedAuthAttempt>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let entity_id = service
        .log_failed_auth_ontology(request)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create failed auth in ontology: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "id": entity_id,
        "message": "Failed auth logged to ontology"
    })))
}

/// POST /api/monitoring/ontology/security-event
/// Create security event in ontology
pub async fn create_security_event_ontology(
    State(service): State<Arc<UnifiedMonitoringService>>,
    Json(request): Json<super::models::CreateSecurityEvent>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let entity_id = service
        .log_security_event_ontology(request)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create security event in ontology: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "id": entity_id,
        "message": "Security event logged to ontology"
    })))
}

/// GET /api/monitoring/ontology/health
/// Health check
pub async fn health_check_ontology() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "unified-monitoring-ontology",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// Create unified monitoring routes (ontology-based)
pub fn create_unified_monitoring_routes(service: Arc<UnifiedMonitoringService>) -> Router {
    Router::new()
        .route("/health", get(health_check_ontology))
        .route("/failed-auth", get(get_failed_auth_ontology))
        .route("/failed-auth", post(create_failed_auth_ontology))
        .route("/security-events", get(get_security_events_ontology))
        .route("/security-event", post(create_security_event_ontology))
        .route("/alert-rules", get(get_alert_rules_ontology))
        .route("/entity/:id", get(get_monitoring_entity))
        .with_state(service)
}
