use axum::{Router, routing::{post, get, delete}, Json, extract::{State, Path}, Extension, response::sse::{Event, Sse}, http::StatusCode};
use futures::stream::{self, Stream};
use std::convert::Infallible;
use validator::Validate;
use serde::{Serialize, Deserialize};
use crate::features::auth::{RegisterUser, LoginUser, AuthService, AuthResponse, User};
use crate::features::auth::service::AuthError;
use tower_cookies::{Cookies, Cookie};

use crate::middleware::csrf::{set_csrf_cookie, CSRF_COOKIE_NAME};

const ACCESS_TOKEN_COOKIE: &str = "access_token";
const REFRESH_TOKEN_COOKIE: &str = "refresh_token";

fn set_auth_cookies(cookies: &Cookies, auth: &AuthResponse) {
    let access_cookie = Cookie::build((ACCESS_TOKEN_COOKIE, auth.access_token.clone()))
        .http_only(true)
        .path("/")
        .secure(false) // Explicitly allow insecure for localhost
        .max_age(tower_cookies::cookie::time::Duration::seconds(auth.expires_in))
        .same_site(tower_cookies::cookie::SameSite::Lax)
        .build();
    
    let mut refresh_builder = Cookie::build((REFRESH_TOKEN_COOKIE, auth.refresh_token.clone()))
        .http_only(true)
        .path("/") 
        .secure(false)
        .same_site(tower_cookies::cookie::SameSite::Lax);

    if auth.remember_me {
        // Set to 30 days if remember_me is true
        refresh_builder = refresh_builder.max_age(tower_cookies::cookie::time::Duration::days(30));
    }

    cookies.add(access_cookie);
    cookies.add(refresh_builder.build());
    
    // Also set CSRF cookie
    set_csrf_cookie(cookies);
}

fn clear_auth_cookies(cookies: &Cookies) {
    let mut access = Cookie::new(ACCESS_TOKEN_COOKIE, "");
    access.set_path("/");
    access.set_max_age(tower_cookies::cookie::time::Duration::seconds(0));
    cookies.add(access);

    let mut refresh = Cookie::new(REFRESH_TOKEN_COOKIE, "");
    refresh.set_path("/");
    refresh.set_max_age(tower_cookies::cookie::time::Duration::seconds(0));
    cookies.add(refresh);
    
    // Clear CSRF cookie too
    let mut csrf = Cookie::new(CSRF_COOKIE_NAME, "");
    csrf.set_path("/");
    csrf.set_max_age(tower_cookies::cookie::time::Duration::seconds(0));
    cookies.add(csrf);
}


pub fn public_auth_routes() -> Router<AuthService> {
    Router::new()
        .route("/register", post(register_handler))
        .route("/login", post(login_handler))
        .route("/refresh", post(refresh_token_handler))
}

pub fn protected_auth_routes() -> Router<AuthService> {
    tracing::info!("Initializing protected_auth_routes");
    Router::new()
        .route("/change-password", post(change_password_handler))
        .route("/notifications", get(notifications_handler))
        .route("/notifications/read-all", post(mark_all_notifications_read_handler))
        .route("/notifications/stream", get(notifications_stream_handler))
        .route("/notifications/:id/read", post(mark_notification_read_handler))
        .route("/sessions", get(list_sessions_handler))
        .route("/sessions/all", get(list_all_sessions_handler))
        .route("/sessions/:id", delete(revoke_session_handler))
        .route("/sessions/admin/:id", delete(revoke_any_session_handler))
        .route("/audit-logs", get(get_audit_logs_handler))
        .route("/logout", post(logout_handler))
        .route("/user", get(user_handler))
        .route("/profile", axum::routing::put(profile_update_handler))
        .route("/debug", get(debug_handler))
        .route("/test/cleanup", post(cleanup_handler))
}

#[axum::debug_handler]
async fn register_handler(
    State(auth_service): State<AuthService>,
    cookies: Cookies,
    Json(user): Json<RegisterUser>,
) -> Result<Json<AuthResponse>, AuthError> {
    if let Err(e) = user.validate() {
        tracing::warn!(email = %user.email, "Registration validation failed: {}", e);
        return Err(AuthError::ValidationError(e.to_string()));
    }

    match auth_service.register(user.clone()).await {
        Ok(response) => {
            tracing::info!(email = %user.email, "User registered successfully");
            set_auth_cookies(&cookies, &response);
            Ok(Json(response))
        }
        Err(e) => {
            tracing::warn!(email = %user.email, error = %e, "Registration failed");
            Err(e)
        }
    }
}

#[axum::debug_handler]
async fn login_handler(
    State(auth_service): State<AuthService>,
    headers: axum::http::HeaderMap,
    cookies: Cookies,
    Json(user): Json<LoginUser>,
) -> Result<Json<AuthResponse>, AuthError> {


    if let Err(e) = user.validate() {
        tracing::warn!(identifier = %user.identifier, "Login validation failed: {}", e);
        return Err(AuthError::ValidationError(e.to_string()));
    }
    // Extract client IP and user-agent (prefer X-Forwarded-For if present)
    let ip = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()).map(|s| s.split(',').next().unwrap_or("").trim().to_string())
        .or_else(|| headers.get("x-real-ip").and_then(|v| v.to_str().ok()).map(|s| s.to_string()))
        .unwrap_or_else(|| "unknown".to_string());
    
    let user_agent = headers.get("user-agent").and_then(|v| v.to_str().ok()).map(|s| s.to_string());

    match auth_service.login(user.clone(), Some(ip.clone()), user_agent).await {
        Ok(response) => {
            tracing::info!(identifier = %user.identifier, ip = %ip, "User logged in successfully");
            set_auth_cookies(&cookies, &response);
            Ok(Json(response))
        }

        Err(e) => {
            tracing::warn!(identifier = %user.identifier, ip = %ip, error = %e, "Login failed");
            Err(e)
        }
    }
}

#[axum::debug_handler]
async fn refresh_token_handler(
    State(auth_service): State<AuthService>,
    cookies: Cookies,
    // We try to get refresh token from cookie first, then body
    body: Option<Json<RefreshTokenRequest>>,
) -> Result<Json<AuthResponse>, AuthError> {
    let refresh_token = if let Some(cookie) = cookies.get(REFRESH_TOKEN_COOKIE) {
        cookie.value().to_string()
    } else if let Some(Json(req)) = body {
        req.refresh_token
    } else {
        return Err(AuthError::ValidationError("Missing refresh token".to_string()));
    };

    match auth_service.refresh_token(refresh_token).await {
        Ok(response) => {
            tracing::debug!("Token refreshed successfully");
            set_auth_cookies(&cookies, &response);
            Ok(Json(response))
        }
        Err(e) => {
            tracing::warn!(error = %e, "Token refresh failed");
            Err(e)
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChangePasswordRequest {
    pub email: String,
    pub current_password: String,
    pub new_password: String,
}

#[axum::debug_handler]
async fn change_password_handler(
    State(auth_service): State<AuthService>,
    Json(req): Json<ChangePasswordRequest>,
) -> Result<Json<serde_json::Value>, AuthError> {
    // Basic validation
    if req.new_password.len() < 8 {
        return Err(AuthError::ValidationError("new password must be at least 8 characters".to_string()));
    }

    auth_service
        .change_password(&req.email, &req.current_password, &req.new_password)
        .await
        .map(|_| {
            Json(serde_json::json!({
                "message": "Password changed successfully. Notification sent."
            }))
        })
}

#[axum::debug_handler]
async fn notifications_handler(
    State(auth_service): State<AuthService>,
    axum::extract::Query(query): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AuthError> {
    let user_id = query.get("user_id").ok_or(AuthError::ValidationError("missing user_id".to_string()))?;
    let notifs = auth_service.get_notifications(user_id).await?;
    let json: Vec<_> = notifs.into_iter().map(|(id, message, read, created_at)| {
        serde_json::json!({ "id": id, "message": message, "read": read, "created_at": created_at })
    }).collect();
    Ok(Json(serde_json::json!({ "notifications": json })))
}

#[axum::debug_handler]
async fn mark_notification_read_handler(
    State(auth_service): State<AuthService>,
    axum::extract::Path(id): axum::extract::Path<i64>,
    axum::extract::Query(query): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AuthError> {
    let user_id = query.get("user_id").ok_or(AuthError::ValidationError("missing user_id".to_string()))?;
    auth_service.mark_notification_read(id, user_id).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CleanupRequest {
    pub prefix: Option<String>,
}

#[axum::debug_handler]
async fn cleanup_handler(
    State(auth_service): State<AuthService>,
    Json(req): Json<CleanupRequest>,
) -> Result<&'static str, AuthError> {
    // Only allow when test endpoints are enabled
    if std::env::var("ENABLE_TEST_ENDPOINTS").unwrap_or_default() != "true" {
        return Err(AuthError::ValidationError("test endpoints disabled".to_string()));
    }

    let prefix = req.prefix.unwrap_or_else(|| "e2e_user_".to_string());
    auth_service.delete_users_by_prefix(&prefix).await.map(|_| "OK")
}

#[axum::debug_handler]
async fn logout_handler(
    State(auth_service): State<AuthService>,
    cookies: Cookies,
    body: Option<Json<RefreshTokenRequest>>,
) -> Result<&'static str, AuthError> {
    // Try to get refresh token from cookie or body to blacklist it
    let refresh_token = cookies.get(REFRESH_TOKEN_COOKIE)
        .map(|c| c.value().to_string())
        .or(body.map(|b| b.refresh_token.clone()));

    if let Some(token) = refresh_token {
        let _ = auth_service.logout(token).await;
        tracing::info!("User logged out");
    }
    
    clear_auth_cookies(&cookies);
    Ok("OK")
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserWithPermissions {
    pub id: String,
    pub username: String,
    pub email: String,
    pub roles: Vec<crate::features::auth::jwt::UserRoleClaim>,
    pub permissions: Vec<String>,
}

async fn user_handler(
    Extension(claims): Extension<crate::features::auth::jwt::Claims>,
) -> Result<Json<UserWithPermissions>, AuthError> {
    Ok(Json(UserWithPermissions {
        id: claims.sub,
        username: claims.username,
        email: claims.email,
        roles: claims.roles,
        permissions: claims.permissions,
    }))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DebugAuthResponse {
    pub raw_token: String,
    pub claims: crate::features::auth::jwt::Claims,
    pub db_roles: Vec<crate::features::abac::models::UserRoleAssignment>,
}

async fn list_sessions_handler(
    State(auth_service): State<AuthService>,
    Extension(claims): Extension<crate::features::auth::jwt::Claims>,
) -> Result<Json<Vec<crate::features::auth::models::SessionResponse>>, AuthError> {
    let user_id = uuid::Uuid::parse_str(&claims.sub).map_err(|_| AuthError::UserNotFound)?;
    let sessions = auth_service.list_active_sessions(user_id, claims.jti).await?;
    Ok(Json(sessions))
}

async fn list_all_sessions_handler(
    State(auth_service): State<AuthService>,
    Extension(_claims): Extension<crate::features::auth::jwt::Claims>,
) -> Result<Json<Vec<crate::features::auth::models::AdminSessionResponse>>, AuthError> {
    // In a real system, we'd check for 'superadmin' role here via claims or middleware
    let sessions = auth_service.list_all_sessions(100).await?;
    Ok(Json(sessions))
}

async fn revoke_session_handler(
    State(auth_service): State<AuthService>,
    Extension(claims): Extension<crate::features::auth::jwt::Claims>,
    Path(id): Path<String>,
) -> Result<StatusCode, AuthError> {
    let user_id = uuid::Uuid::parse_str(&claims.sub).map_err(|_| AuthError::UserNotFound)?;
    auth_service.revoke_session(user_id, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn revoke_any_session_handler(
    State(auth_service): State<AuthService>,
    Extension(claims): Extension<crate::features::auth::jwt::Claims>,
    Path(id): Path<String>,
) -> Result<StatusCode, AuthError> {
    // In a real system, we'd check for 'superadmin' role here
    let admin_id = uuid::Uuid::parse_str(&claims.sub).map_err(|_| AuthError::UserNotFound)?;
    auth_service.revoke_any_session(&id, admin_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn get_audit_logs_handler(
    State(auth_service): State<AuthService>,
    Extension(_claims): Extension<crate::features::auth::jwt::Claims>,
) -> Result<Json<Vec<crate::features::auth::models::AuditLog>>, AuthError> {
    // In a real system, we'd check for 'superadmin' role here
    let logs = auth_service.audit_service.get_logs().await?;
    Ok(Json(logs))
}

#[axum::debug_handler]
async fn debug_handler(
    State(auth_service): State<AuthService>,
    cookies: Cookies,
    Extension(claims): Extension<crate::features::auth::jwt::Claims>,
) -> Result<Json<DebugAuthResponse>, AuthError> {
    let raw_token = cookies.get(ACCESS_TOKEN_COOKIE)
        .map(|c| c.value().to_string())
        .unwrap_or_else(|| "Not found in cookies".to_string());

    let db_roles = auth_service.get_abac_service().get_user_roles(&claims.sub).await
        .map_err(|e| AuthError::ValidationError(e.to_string()))?;

    Ok(Json(DebugAuthResponse {
        raw_token,
        claims,
        db_roles,
    }))
}

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub username: Option<String>,
}

#[axum::debug_handler]
async fn profile_update_handler(
    State(auth_service): State<AuthService>,
    Extension(claims): Extension<crate::features::auth::jwt::Claims>,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<User>, AuthError> {
    let user_id = uuid::Uuid::parse_str(&claims.sub).ok();
    let user = auth_service.get_user_service()
        .update(&claims.sub, req.username, None, user_id).await?;
    
    auth_service.create_notification(&claims.sub, "Your profile was updated.").await?;
    
    Ok(Json(user))
}

#[axum::debug_handler]
async fn mark_all_notifications_read_handler(
    State(auth_service): State<AuthService>,
    Extension(claims): Extension<crate::features::auth::jwt::Claims>,
) -> Result<Json<serde_json::Value>, AuthError> {
    auth_service.mark_all_notifications_read(&claims.sub).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

async fn notifications_stream_handler(
    State(auth_service): State<AuthService>,
    Extension(claims): Extension<crate::features::auth::jwt::Claims>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = auth_service.subscribe_notifications();
    let user_id = claims.sub.clone();

    let stream = stream::unfold((rx, user_id), move |(mut rx, user_id)| async move {
        loop {
            match rx.recv().await {
                Ok(event) => {
                    if event.user_id == user_id {
                        let event = Event::default()
                            .data(serde_json::to_string(&event).unwrap_or_default());
                        return Some((Ok(event), (rx, user_id)));
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(tokio::sync::broadcast::error::RecvError::Closed) => return None,
            }
        }
    });

    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default())
}
