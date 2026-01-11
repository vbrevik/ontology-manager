use axum::{
    routing::{get, post},
    Router, Json, extract::{State, Path, Query},
    http::StatusCode,
};
use serde::Deserialize;
use uuid::Uuid;
use super::policy_service::PolicyService;
use super::policy_models::*;

#[derive(Debug, Deserialize)]
pub struct ListPoliciesQuery {
    #[serde(default)]
    pub active_only: bool,
}

pub fn policy_routes() -> Router<PolicyService> {
    Router::new()
        .route("/", get(list_policies).post(create_policy))
        .route("/:id", get(get_policy).put(update_policy).delete(delete_policy))
        .route("/test", post(test_policy))
}

async fn list_policies(
    State(svc): State<PolicyService>,
    Query(query): Query<ListPoliciesQuery>,
) -> Result<Json<Vec<Policy>>, StatusCode> {
    svc.list_policies(query.active_only).await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to list policies: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

async fn get_policy(
    State(svc): State<PolicyService>,
    Path(id): Path<Uuid>,
) -> Result<Json<Policy>, StatusCode> {
    svc.get_policy(id).await
        .map(Json)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn create_policy(
    State(svc): State<PolicyService>,
    Json(input): Json<CreatePolicyInput>,
) -> Result<(StatusCode, Json<Policy>), StatusCode> {
    svc.create_policy(input, None).await
        .map(|p| (StatusCode::CREATED, Json(p)))
        .map_err(|e| {
            tracing::error!("Failed to create policy: {}", e);
            StatusCode::BAD_REQUEST
        })
}

async fn update_policy(
    State(svc): State<PolicyService>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdatePolicyInput>,
) -> Result<Json<Policy>, StatusCode> {
    svc.update_policy(id, input, None).await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to update policy: {}", e);
            StatusCode::BAD_REQUEST
        })
}

async fn delete_policy(
    State(svc): State<PolicyService>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    svc.delete_policy(id).await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn test_policy(
    State(svc): State<PolicyService>,
    Json(input): Json<TestPolicyRequest>,
) -> Json<TestPolicyResponse> {
    Json(svc.test_policy(&input))
}
