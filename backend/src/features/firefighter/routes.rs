use crate::features::auth::jwt::Claims;
use crate::features::firefighter::models::{
    DeactivateInput, FirefighterSession, FirefighterStatus, RequestElevationInput,
};
use crate::features::firefighter::service::{FirefighterError, FirefighterService};
use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Extension, Json, Router,
};
use uuid::Uuid;

pub fn firefighter_routes() -> Router<FirefighterService> {
    Router::new()
        .route("/request", post(request_elevation_handler))
        .route("/status", get(get_status_handler))
        .route("/deactivate", post(deactivate_handler))
        .route("/sessions", get(list_sessions_handler))
}

#[axum::debug_handler]
async fn request_elevation_handler(
    State(service): State<FirefighterService>,
    Extension(claims): Extension<Claims>,
    headers: axum::http::HeaderMap,
    Json(input): Json<RequestElevationInput>,
) -> Result<Json<FirefighterSession>, FirefighterError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| FirefighterError::NotFound)?;

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

    let session = service
        .request_elevation(
            user_id,
            &input.password,
            input.justification,
            input.duration_minutes,
            Some(ip),
            user_agent,
        )
        .await?;

    Ok(Json(session))
}

#[axum::debug_handler]
async fn get_status_handler(
    State(service): State<FirefighterService>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<FirefighterStatus>, FirefighterError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| FirefighterError::NotFound)?;
    let status = service.get_status(user_id).await?;
    Ok(Json(status))
}

#[axum::debug_handler]
async fn deactivate_handler(
    State(service): State<FirefighterService>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<DeactivateInput>,
) -> Result<StatusCode, FirefighterError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| FirefighterError::NotFound)?;
    service.deactivate(user_id, input.reason).await?;
    Ok(StatusCode::OK)
}

#[axum::debug_handler]
async fn list_sessions_handler(
    State(service): State<FirefighterService>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FirefighterSession>>, FirefighterError> {
    // Check for superadmin permission in claims
    if !claims.permissions.iter().any(|p| p == "*" || p == "admin") {
        return Err(FirefighterError::Forbidden(
            "Only admins can view all sessions".to_string(),
        ));
    }

    let sessions = service.list_sessions(None, false, 50).await?;
    Ok(Json(sessions))
}

impl axum::response::IntoResponse for FirefighterError {
    fn into_response(self) -> axum::response::Response {
        let (status, error_message) = match self {
            FirefighterError::DatabaseError(e) => {
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            }
            FirefighterError::AuthError(e) => (StatusCode::UNAUTHORIZED, e.to_string()),
            FirefighterError::InvalidCredentials => {
                (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string())
            }
            FirefighterError::Forbidden(e) => (StatusCode::FORBIDDEN, e),
            FirefighterError::NotFound => (StatusCode::NOT_FOUND, "Session not found".to_string()),
        };

        let body = Json(serde_json::json!({
            "error": error_message,
        }));

        (status, body).into_response()
    }
}
