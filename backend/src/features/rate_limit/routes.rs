use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};
use std::sync::Arc;

use crate::features::auth::jwt::Claims;
use crate::features::rate_limit::models::*;
use crate::features::rate_limit::service::RateLimitService;
use uuid::Uuid;

/// Get all rate limit rules
pub async fn list_rules_handler(State(service): State<Arc<RateLimitService>>) -> impl IntoResponse {
    match service.list_rules().await {
        Ok(rules) => (StatusCode::OK, Json(rules)).into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to fetch rules"})),
        )
            .into_response(),
    }
}

/// Get a single rate limit rule
pub async fn get_rule_handler(
    State(service): State<Arc<RateLimitService>>,
    Path(rule_id): Path<String>,
) -> impl IntoResponse {
    match service.get_rule(&rule_id).await {
        Ok(Some(rule)) => (StatusCode::OK, Json(rule)).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Rule not found"})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to fetch rule"})),
        )
            .into_response(),
    }
}

/// Update a rate limit rule
pub async fn update_rule_handler(
    State(service): State<Arc<RateLimitService>>,
    Path(rule_id): Path<String>,
    Json(update): Json<UpdateRateLimitRule>,
) -> impl IntoResponse {
    match service.update_rule(&rule_id, update).await {
        Ok(()) => (
            StatusCode::OK,
            Json(serde_json::json!({"message": "Rule updated"})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to update rule"})),
        )
            .into_response(),
    }
}

/// Reset counters for a specific rule
pub async fn reset_counters_handler(
    State(service): State<Arc<RateLimitService>>,
    Path(rule_id): Path<String>,
) -> impl IntoResponse {
    service.reset_counters(&rule_id).await;
    (
        StatusCode::OK,
        Json(serde_json::json!({"message": "Counters reset"})),
    )
        .into_response()
}

/// List all bypass tokens
pub async fn list_bypass_tokens_handler(
    State(service): State<Arc<RateLimitService>>,
) -> impl IntoResponse {
    match service.list_bypass_tokens().await {
        Ok(tokens) => (StatusCode::OK, Json(tokens)).into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to fetch tokens"})),
        )
            .into_response(),
    }
}

/// Create a new bypass token
pub async fn create_bypass_token_handler(
    State(service): State<Arc<RateLimitService>>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(create): Json<CreateBypassToken>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(uid) => uid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid user ID in token"})),
            )
                .into_response()
        }
    };

    match service.create_bypass_token(create, Some(user_id)).await {
        Ok(token) => (StatusCode::CREATED, Json(token)).into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to create token"})),
        )
            .into_response(),
    }
}

/// Delete a bypass token
pub async fn delete_bypass_token_handler(
    State(service): State<Arc<RateLimitService>>,
    Path(token_id): Path<String>,
) -> impl IntoResponse {
    let id = match Uuid::parse_str(&token_id) {
        Ok(uid) => uid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid token ID"})),
            )
                .into_response()
        }
    };

    match service.delete_bypass_token(id).await {
        Ok(()) => (
            StatusCode::OK,
            Json(serde_json::json!({"message": "Token deleted"})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to delete token"})),
        )
            .into_response(),
    }
}

pub fn public_rate_limit_routes() -> Router<Arc<RateLimitService>> {
    Router::new()
        .route("/rules", get(list_rules_handler))
        .route("/rules/:id", get(get_rule_handler))
        .route("/rules/:id", put(update_rule_handler))
        .route("/rules/:id/reset", post(reset_counters_handler))
        .route("/bypass-tokens", get(list_bypass_tokens_handler))
        .route("/bypass-tokens", post(create_bypass_token_handler))
        .route(
            "/bypass-tokens/:id",
            axum::routing::delete(delete_bypass_token_handler),
        )
}
