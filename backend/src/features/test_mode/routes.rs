use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};

use crate::features::auth::jwt::Claims;
use super::models::{
    ActivateTestModeRequest, ActivateTestModeResponse, DeactivateTestModeResponse,
    TestModeStatus,
};
use super::service::{TestModeError, TestModeService};
use uuid::Uuid;

pub fn create_test_mode_routes() -> Router<TestModeService> {
    Router::new()
        .route("/activate", post(activate_handler))
        .route("/deactivate", post(deactivate_handler))
        .route("/status", get(status_handler))
        .route("/active-sessions", get(list_active_sessions_handler))
}

impl IntoResponse for TestModeError {
    fn into_response(self) -> axum::response::Response {
        let status = match self {
            TestModeError::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            TestModeError::AlreadyActive => StatusCode::CONFLICT,
            TestModeError::NotActive => StatusCode::NOT_FOUND,
            TestModeError::InvalidDuration(_) => StatusCode::BAD_REQUEST,
        };
        (status, self.to_string()).into_response()
    }
}

/// Activate test mode for current user
#[axum::debug_handler]
async fn activate_handler(
    State(service): State<TestModeService>,
    Extension(claims): Extension<Claims>,
    Json(request): Json<ActivateTestModeRequest>,
) -> Result<Json<ActivateTestModeResponse>, TestModeError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| TestModeError::DatabaseError(sqlx::Error::RowNotFound))?;

    let session = service
        .activate(
            user_id,
            request.test_suite,
            request.test_run_id,
            request.justification,
            request.duration_minutes,
            None, // IP address - could extract from request
            None, // User agent - could extract from request
        )
        .await?;

    let message = format!(
        "Test mode activated for {} minutes. All entities you create will be automatically marked as test data.",
        request.duration_minutes.unwrap_or(120)
    );

    Ok(Json(ActivateTestModeResponse { session, message }))
}

/// Deactivate test mode for current user
#[axum::debug_handler]
async fn deactivate_handler(
    State(service): State<TestModeService>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DeactivateTestModeResponse>, TestModeError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| TestModeError::DatabaseError(sqlx::Error::RowNotFound))?;

    let session = service.deactivate(user_id).await?;

    let duration = (session.ended_at.unwrap_or_else(chrono::Utc::now) - session.activated_at)
        .num_seconds() as f64
        / 60.0;

    let message = format!(
        "Test mode deactivated. {} entities were marked as test data during this session.",
        session.entities_marked
    );

    Ok(Json(DeactivateTestModeResponse {
        message,
        entities_marked: session.entities_marked,
        duration_minutes: duration,
    }))
}

/// Get test mode status for current user
#[axum::debug_handler]
async fn status_handler(
    State(service): State<TestModeService>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<TestModeStatus>, TestModeError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| TestModeError::DatabaseError(sqlx::Error::RowNotFound))?;

    let status = service.get_status(user_id).await?;

    Ok(Json(status))
}

/// List all active test mode sessions (admin only)
#[axum::debug_handler]
async fn list_active_sessions_handler(
    State(service): State<TestModeService>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<super::models::TestModeSession>>, TestModeError> {
    // Check if user is superadmin
    if !claims.roles.iter().any(|r| r.role_name == "superadmin") {
        return Err(TestModeError::DatabaseError(sqlx::Error::RowNotFound));
    }

    let sessions = service.list_active_sessions().await?;

    Ok(Json(sessions))
}
