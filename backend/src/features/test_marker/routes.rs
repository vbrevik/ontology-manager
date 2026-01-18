use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::features::auth::jwt::Claims;
use crate::features::test_marker::service::{TestMarkerError, TestMarkerService};

pub fn create_routes() -> Router<TestMarkerService> {
    Router::new()
        .route("/mark-test-data", post(mark_test_data_handler))
        .route("/mark-current-user", post(mark_current_user_handler))
        .route("/is-test-data/:entity_id", get(is_test_data_handler))
        .route("/cleanup/:days", post(cleanup_test_data_handler))
}

#[derive(Deserialize)]
struct MarkTestDataRequest {
    entity_id: Uuid,
    test_suite: Option<String>,
    test_name: Option<String>,
}

#[derive(Deserialize)]
struct MarkCurrentUserRequest {
    test_suite: Option<String>,
    test_name: Option<String>,
}

#[derive(Serialize)]
struct IsTestDataResponse {
    is_test_data: bool,
}

#[derive(Serialize)]
struct CleanupResponse {
    deleted_count: usize,
    deleted_ids: Vec<Uuid>,
}

impl IntoResponse for TestMarkerError {
    fn into_response(self) -> axum::response::Response {
        let status = match self {
            TestMarkerError::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            TestMarkerError::InfrastructureNotFound => StatusCode::NOT_FOUND,
        };
        (status, self.to_string()).into_response()
    }
}

async fn mark_test_data_handler(
    State(service): State<TestMarkerService>,
    Extension(_claims): Extension<Claims>,
    Json(input): Json<MarkTestDataRequest>,
) -> Result<StatusCode, TestMarkerError> {
    let test_suite = input.test_suite.as_deref().unwrap_or("e2e");
    let test_name = input.test_name.as_deref();

    service.mark_as_test_data(input.entity_id, test_suite, test_name).await?;

    Ok(StatusCode::OK)
}

async fn mark_current_user_handler(
    State(service): State<TestMarkerService>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<MarkCurrentUserRequest>,
) -> Result<StatusCode, TestMarkerError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| TestMarkerError::DatabaseError(sqlx::Error::RowNotFound))?;

    let test_suite = input.test_suite.as_deref().unwrap_or("e2e");
    let test_name = input.test_name.as_deref();

    service.mark_as_test_data(user_id, test_suite, test_name).await?;

    Ok(StatusCode::OK)
}

async fn is_test_data_handler(
    State(service): State<TestMarkerService>,
    Extension(_claims): Extension<Claims>,
    Path(entity_id): Path<Uuid>,
) -> Result<Json<IsTestDataResponse>, TestMarkerError> {
    let is_test = service.is_test_data(entity_id).await?;

    Ok(Json(IsTestDataResponse { is_test_data: is_test }))
}

async fn cleanup_test_data_handler(
    State(service): State<TestMarkerService>,
    Extension(claims): Extension<Claims>,
    Path(days): Path<i32>,
) -> Result<Json<CleanupResponse>, TestMarkerError> {
    // Only superadmin can cleanup
    if !claims.roles.iter().any(|r| r.role_name == "superadmin") {
        return Err(TestMarkerError::DatabaseError(sqlx::Error::RowNotFound));
    }

    let deleted_ids = service.cleanup_expired_test_data(days).await?;
    let deleted_count = deleted_ids.len();

    Ok(Json(CleanupResponse {
        deleted_count,
        deleted_ids,
    }))
}
