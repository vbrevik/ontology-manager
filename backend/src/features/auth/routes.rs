use crate::features::auth::service::AuthError;
use crate::features::auth::{AuthResponse, AuthService, LoginUser, RegisterUser, User};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{sse::{Event, Sse}, IntoResponse},
    routing::{delete, get, post},
    Extension, Json, Router,
};
use futures::stream::{self, Stream};
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use tower_cookies::{Cookie, Cookies};
use uuid::Uuid;
use validator::Validate;

use crate::middleware::csrf::{set_csrf_cookie, CSRF_COOKIE_NAME};

const ACCESS_TOKEN_COOKIE: &str = "access_token";
const REFRESH_TOKEN_COOKIE: &str = "refresh_token";

pub(crate) fn set_auth_cookies(cookies: &Cookies, auth: &AuthResponse) {
    if let Some(access_token) = &auth.access_token {
        let access_cookie = Cookie::build((ACCESS_TOKEN_COOKIE, access_token.clone()))
            .http_only(true)
            .path("/")
            .secure(cfg!(not(debug_assertions))) // CVE-002 Fix: Secure in production, allow HTTP in debug
            .max_age(tower_cookies::cookie::time::Duration::seconds(
                auth.expires_in.unwrap_or(3600),
            ))
            .same_site(tower_cookies::cookie::SameSite::Lax)
            .build();
        cookies.add(access_cookie);
    }

    if let Some(refresh_token) = &auth.refresh_token {
        let mut refresh_builder = Cookie::build((REFRESH_TOKEN_COOKIE, refresh_token.clone()))
            .http_only(true)
            .path("/")
            .secure(cfg!(not(debug_assertions))) // CVE-002 Fix: Secure in production, allow HTTP in debug
            .same_site(tower_cookies::cookie::SameSite::Lax);

        if auth.remember_me {
            refresh_builder = refresh_builder.max_age(tower_cookies::cookie::time::Duration::days(30));
        }
        cookies.add(refresh_builder.build());
    }

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
        .route("/forgot-password", post(forgot_password_handler))
        .route("/reset-password", post(reset_password_handler))
        .route("/mfa/challenge", post(mfa_challenge_handler))
        .route("/verify-reset-token/:token", get(verify_reset_token_handler))
        // CVE-005 Fix: Test endpoints removed for security
}

pub fn protected_auth_routes() -> Router<AuthService> {
    tracing::info!("Initializing protected_auth_routes");
    Router::new()
        .route("/change-password", post(change_password_handler))
        .route("/notifications", get(notifications_handler))
        .route(
            "/notifications/read-all",
            post(mark_all_notifications_read_handler),
        )
        .route("/notifications/stream", get(notifications_stream_handler))
        .route(
            "/notifications/:id/read",
            post(mark_notification_read_handler),
        )
        .route("/sessions", get(list_sessions_handler))
        .route("/sessions/all", get(list_all_sessions_handler))
        .route("/sessions/:id", delete(revoke_session_handler))
        .route("/sessions/admin/:id", delete(revoke_any_session_handler))
        .route("/audit-logs", get(get_audit_logs_handler))
        .route("/logout", post(logout_handler))
        .route("/user", get(user_handler))
        .route("/profile", axum::routing::put(profile_update_handler))
        .route("/debug", get(debug_handler))
        // CVE-005 Fix: Test cleanup endpoint removed
}

#[axum::debug_handler]
async fn register_handler(
    State(auth_service): State<AuthService>,
    cookies: Cookies,
    Json(user): Json<RegisterUser>,
) -> Result<(StatusCode, Json<AuthResponse>), AuthError> {
    if let Err(e) = user.validate() {
        tracing::warn!(email = %user.email, "Registration validation failed: {}", e);
        return Err(AuthError::ValidationError(e.to_string()));
    }

    match auth_service.register(user.clone()).await {
        Ok(response) => {
            tracing::info!(email = %user.email, "User registered successfully");
            set_auth_cookies(&cookies, &response);
            Ok((StatusCode::OK, Json(response)))
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
) -> Result<(StatusCode, Json<AuthResponse>), AuthError> {
    if let Err(e) = user.validate() {
        tracing::warn!(identifier = %user.identifier, "Login validation failed: {}", e);
        return Err(AuthError::ValidationError(e.to_string()));
    }
    // Extract client IP and user-agent (prefer X-Forwarded-For if present)
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or("").trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "unknown".to_string());

    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    match auth_service
        .login(user.clone(), Some(ip.clone()), user_agent)
        .await
    {
        Ok(response) => {
            tracing::info!(identifier = %user.identifier, ip = %ip, "User logged in successfully");
            set_auth_cookies(&cookies, &response);
            
            let status = if response.mfa_required {
                StatusCode::ACCEPTED
            } else {
                StatusCode::OK
            };
            
            Ok((status, Json(response)))
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
) -> Result<(StatusCode, Json<AuthResponse>), AuthError> {
    let refresh_token = if let Some(cookie) = cookies.get(REFRESH_TOKEN_COOKIE) {
        cookie.value().to_string()
    } else if let Some(Json(req)) = body {
        req.refresh_token
    } else {
        return Err(AuthError::ValidationError(
            "Missing refresh token".to_string(),
        ));
    };

    match auth_service.refresh_token(refresh_token).await {
        Ok(response) => {
            tracing::debug!("Token refreshed successfully");
            set_auth_cookies(&cookies, &response);
            Ok((StatusCode::OK, Json(response)))
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
        return Err(AuthError::ValidationError(
            "new password must be at least 8 characters".to_string(),
        ));
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

#[derive(Deserialize, Validate)]
pub struct ForgotPasswordRequest {
    #[validate(email)]
    pub email: String,
}

#[derive(Deserialize)]
pub struct MfaChallengeRequest {
    pub mfa_token: String,
    pub code: String,
    pub remember_me: Option<bool>,
}

#[derive(Deserialize, Validate)]
pub struct ResetPasswordRequest {
    pub token: String,
    #[validate(length(min = 8))]
    pub new_password: String,
}

#[axum::debug_handler]
async fn forgot_password_handler(
    State(auth_service): State<AuthService>,
    Json(req): Json<ForgotPasswordRequest>,
) -> Result<Json<serde_json::Value>, AuthError> {
    if let Err(e) = req.validate() {
        return Err(AuthError::ValidationError(e.to_string()));
    }

    // Always return success to prevent email enumeration
    let _ = auth_service.request_password_reset(&req.email).await;
    
    Ok(Json(serde_json::json!({
        "message": "If an account with that email exists, a password reset link has been sent."
    })))
}

#[axum::debug_handler]
async fn verify_reset_token_handler(
    State(auth_service): State<AuthService>,
    Path(token): Path<String>,
) -> Result<Json<serde_json::Value>, AuthError> {
    auth_service.verify_reset_token(&token).await?;
    Ok(Json(serde_json::json!({ "valid": true })))
}

#[axum::debug_handler]
async fn reset_password_handler(
    State(auth_service): State<AuthService>,
    Json(req): Json<ResetPasswordRequest>,
) -> Result<Json<serde_json::Value>, AuthError> {
    if let Err(e) = req.validate() {
        return Err(AuthError::ValidationError(e.to_string()));
    }

    auth_service.reset_password(&req.token, &req.new_password).await?;

    Ok(Json(serde_json::json!({
        "message": "Password has been reset successfully. You can now login with your new password."
    })))
}

#[axum::debug_handler]
async fn mfa_challenge_handler(
    State(auth_service): State<AuthService>,
    cookies: Cookies,
    Json(req): Json<MfaChallengeRequest>,
) -> Result<impl IntoResponse, AuthError> {
    // This handler processes MFA code submission after login
    auth_service.verify_mfa_and_login(
        req.mfa_token,
        req.code,
        req.remember_me,
        cookies
    ).await
}

#[axum::debug_handler]
async fn notifications_handler(
    State(auth_service): State<AuthService>,
    axum::extract::Query(query): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AuthError> {
    let user_id = query
        .get("user_id")
        .ok_or(AuthError::ValidationError("missing user_id".to_string()))?;
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
    let user_id = query
        .get("user_id")
        .ok_or(AuthError::ValidationError("missing user_id".to_string()))?;
    auth_service.mark_notification_read(id, user_id).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

// CVE-005 Fix: Test endpoints and their handlers removed for security
// If test utilities are needed, use test-only modules or feature flags instead

#[axum::debug_handler]
async fn logout_handler(
    State(auth_service): State<AuthService>,
    cookies: Cookies,
    body: Option<Json<RefreshTokenRequest>>,
) -> Result<&'static str, AuthError> {
    // Try to get refresh token from cookie or body to blacklist it
    let refresh_token = cookies
        .get(REFRESH_TOKEN_COOKIE)
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
    let sessions = auth_service
        .list_active_sessions(user_id, claims.jti)
        .await?;
    Ok(Json(sessions))
}

async fn list_all_sessions_handler(
    State(auth_service): State<AuthService>,
    Extension(claims): Extension<crate::features::auth::jwt::Claims>,
) -> Result<Json<Vec<crate::features::auth::models::AdminSessionResponse>>, AuthError> {
    // CVE-001 Fix: Check for superadmin role
    if !claims.roles.iter().any(|r| r.role_name == "superadmin") {
        return Err(AuthError::PermissionDenied);
    }
    
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
    // CVE-001 Fix: Check for superadmin role
    if !claims.roles.iter().any(|r| r.role_name == "superadmin") {
        return Err(AuthError::PermissionDenied);
    }
    
    let admin_id = uuid::Uuid::parse_str(&claims.sub).map_err(|_| AuthError::UserNotFound)?;
    auth_service.revoke_any_session(&id, admin_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn get_audit_logs_handler(
    State(auth_service): State<AuthService>,
    Extension(claims): Extension<crate::features::auth::jwt::Claims>,
) -> Result<Json<Vec<crate::features::auth::models::AuditLog>>, AuthError> {
    // CVE-001 Fix: Check for superadmin role
    if !claims.roles.iter().any(|r| r.role_name == "superadmin") {
        return Err(AuthError::PermissionDenied);
    }
    
    let logs = auth_service.audit_service.get_logs().await?;
    Ok(Json(logs))
}

#[axum::debug_handler]
async fn debug_handler(
    State(auth_service): State<AuthService>,
    cookies: Cookies,
    Extension(claims): Extension<crate::features::auth::jwt::Claims>,
) -> Result<Json<DebugAuthResponse>, AuthError> {
    let raw_token = cookies
        .get(ACCESS_TOKEN_COOKIE)
        .map(|c| c.value().to_string())
        .unwrap_or_else(|| "Not found in cookies".to_string());

    let db_roles = auth_service
        .get_abac_service()
        .get_user_roles(&claims.sub)
        .await
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
    let user = auth_service
        .get_user_service()
        .update(&claims.sub, req.username, None, user_id)
        .await?;

    auth_service
        .create_notification(&claims.sub, "Your profile was updated.")
        .await?;

    Ok(Json(user))
}

#[axum::debug_handler]
async fn mark_all_notifications_read_handler(
    State(auth_service): State<AuthService>,
    Extension(claims): Extension<crate::features::auth::jwt::Claims>,
) -> Result<Json<serde_json::Value>, AuthError> {
    auth_service
        .mark_all_notifications_read(&claims.sub)
        .await?;
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

// =====================================================================
// MFA ROUTES
// =====================================================================

use crate::features::auth::mfa::{MfaError, MfaService, MfaSetupResponse, MfaStatus};

#[derive(Clone)]
pub struct MfaState {
    pub mfa_service: MfaService,
    pub auth_service: AuthService,
}

pub fn mfa_routes() -> Router<MfaState> {
    Router::new()
        .route("/setup", post(mfa_setup_handler))
        .route("/verify-setup", post(mfa_verify_setup_handler))
        .route("/verify", post(mfa_verify_handler))
        .route("/disable", post(mfa_disable_handler))
        .route("/status", get(mfa_status_handler))
        .route("/backup-codes/regenerate", post(mfa_regenerate_backup_codes_handler))
}

#[derive(Debug, Deserialize)]
struct MfaSetupRequest {
    user_id: Uuid,
    email: String,
}

#[derive(Debug, Deserialize)]
struct MfaVerifyRequest {
    user_id: Uuid,
    code: String,
    remember_me: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct MfaDisableRequest {
    user_id: Uuid,
}

#[derive(Debug, Deserialize)]
struct MfaStatusRequest {
    user_id: Uuid,
}

impl axum::response::IntoResponse for MfaError {
    fn into_response(self) -> axum::response::Response {
        let status = self.to_status_code();
        let body = Json(serde_json::json!({
            "error": self.to_string()
        }));
        (status, body).into_response()
    }
}

async fn mfa_setup_handler(
    State(state): State<MfaState>,
    Json(req): Json<MfaSetupRequest>,
) -> Result<Json<MfaSetupResponse>, MfaError> {
    let result = state.mfa_service.setup_mfa(req.user_id, &req.email).await?;
    Ok(Json(result))
}

async fn mfa_verify_setup_handler(
    State(state): State<MfaState>,
    Json(req): Json<MfaVerifyRequest>,
) -> Result<Json<serde_json::Value>, MfaError> {
    state.mfa_service.verify_setup(req.user_id, &req.code).await?;
    Ok(Json(serde_json::json!({ "success": true, "message": "MFA enabled successfully" })))
}

async fn mfa_verify_handler(
    State(state): State<MfaState>,
    headers: axum::http::HeaderMap,
    cookies: Cookies,
    Json(req): Json<MfaVerifyRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), AuthError> {
    // 1. Verify code (TOTP or Backup)
    let totp_result = state.mfa_service.verify_code(req.user_id, &req.code).await;
    let _method = if totp_result.is_ok() {
        "totp"
    } else {
        // Try backup code
        match state.mfa_service.verify_backup_code(req.user_id, &req.code).await {
            Ok(_) => "backup_code",
            Err(_) => return Err(AuthError::InvalidCredentials),
        }
    };

    // 2. Fetch User
    let user = state.auth_service.get_user_service().find_by_id(&req.user_id.to_string()).await
        .map_err(|_| AuthError::UserNotFound)?;

    // 3. Context (IP/UA)
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or("").trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "unknown".to_string());

    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // 4. Generate Tokens
    // Force mfa_required=false because we just verified it
    // Wait, generate_tokens sets mfa_required=false by default now (in my previous edit).
    let response = state.auth_service.generate_tokens(
        user.id,
        user.username,
        user.email.clone().unwrap_or_default(),
        user.tenant_id,
        req.remember_me.unwrap_or(false),
        Some(ip),
        user_agent
    ).await?;

    // 5. Set Cookies
    set_auth_cookies(&cookies, &response);

    // 6. Return
    Ok((StatusCode::OK, Json(response)))
}

async fn mfa_disable_handler(
    State(state): State<MfaState>,
    Json(req): Json<MfaDisableRequest>,
) -> Result<Json<serde_json::Value>, MfaError> {
    state.mfa_service.disable_mfa(req.user_id).await?;
    Ok(Json(serde_json::json!({ "success": true, "message": "MFA disabled" })))
}

async fn mfa_status_handler(
    State(state): State<MfaState>,
    axum::extract::Query(req): axum::extract::Query<MfaStatusRequest>,
) -> Result<Json<MfaStatus>, MfaError> {
    let status = state.mfa_service.get_status(req.user_id).await?;
    Ok(Json(status))
}

async fn mfa_regenerate_backup_codes_handler(
    State(state): State<MfaState>,
    Json(req): Json<MfaDisableRequest>,
) -> Result<Json<serde_json::Value>, MfaError> {
    let new_codes = state.mfa_service.regenerate_backup_codes(req.user_id).await?;
    Ok(Json(serde_json::json!({ 
        "success": true, 
        "backup_codes": new_codes,
        "message": "New backup codes generated. Save them securely."
    })))
}
