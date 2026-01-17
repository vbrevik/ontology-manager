use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use std::sync::Arc;

use crate::features::auth::jwt::Claims;
use crate::features::rate_limit::service::RateLimitService;

#[allow(dead_code)]
const BYPASS_HEADER: &str = "x-test-rate-limit-bypass";

#[allow(dead_code)]
pub async fn rate_limit_middleware(
    State(rate_limit_service): State<Arc<RateLimitService>>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Response {
    // Check for bypass token in headers
    if let Some(token) = headers.get(BYPASS_HEADER) {
        if let Ok(token_str) = token.to_str() {
            if rate_limit_service
                .verify_bypass_token(token_str)
                .await
                .unwrap_or(false)
            {
                return next.run(request).await;
            }
        }
    }

    // Extract user ID from JWT claims if present (for user-based limiting)
    let user_id = request
        .extensions()
        .get::<Claims>()
        .map(|claims| claims.sub.clone());

    // Extract IP address (for IP-based limiting)
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.split(',').next())
        .or_else(|| headers.get("x-real-ip").and_then(|h| h.to_str().ok()))
        .unwrap_or("unknown")
        .to_string();

    // Determine which rule to apply based on path
    let path = request.uri().path();
    let method = request.method().as_str();

    let (rule_id, identifier) = determine_rule_and_identifier(path, method, user_id, &ip);

    // Check rate limit
    match rate_limit_service
        .check_rate_limit(&rule_id, &identifier)
        .await
    {
        Ok(()) => {
            // Request allowed
            next.run(request).await
        }
        Err(retry_after) => {
            // Rate limit exceeded
            let response_body = json!({
                "error": "Too many requests",
                "message": format!("Rate limit exceeded. Please try again in {} seconds.", retry_after),
                "retry_after": retry_after
            });

            (
                StatusCode::TOO_MANY_REQUESTS,
                [
                    ("Retry-After", retry_after.to_string()),
                    ("X-RateLimit-Rule", rule_id),
                ],
                Json(response_body),
            )
                .into_response()
        }
    }
}

/// Determine which rate limit rule to apply and the identifier to use
fn determine_rule_and_identifier(
    path: &str,
    method: &str,
    user_id: Option<String>,
    ip: &str,
) -> (String, String) {
    // Check auth endpoints first (highest priority)
    if path.starts_with("/api/auth/login") || path.starts_with("/api/auth/register") {
        return ("auth-login".to_string(), ip.to_string());
    }

    if path.starts_with("/api/auth/") {
        let identifier = user_id.unwrap_or_else(|| ip.to_string());
        return ("auth-general".to_string(), identifier);
    }

    // Admin endpoints
    if path.starts_with("/api/admin/") {
        let identifier = user_id.unwrap_or_else(|| ip.to_string());
        return ("admin".to_string(), identifier);
    }

    // API endpoints by method
    if path.starts_with("/api/") {
        let identifier = user_id.unwrap_or_else(|| ip.to_string());
        match method {
            "GET" | "HEAD" => ("api-read".to_string(), identifier),
            "POST" | "PUT" | "DELETE" | "PATCH" => ("api-write".to_string(), identifier),
            _ => ("api-read".to_string(), identifier),
        }
    } else {
        // Default: no rate limiting
        ("none".to_string(), "none".to_string())
    }
}
