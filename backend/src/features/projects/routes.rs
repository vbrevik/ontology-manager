use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use uuid::Uuid;

use crate::features::auth::jwt::Claims;
use crate::features::projects::{
    CreateProjectInput, CreateTaskInput, ProjectService, UpdateProjectInput, UpdateTaskInput,
};

use super::service::ProjectError;

impl IntoResponse for ProjectError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match &self {
            ProjectError::NotFound => (StatusCode::NOT_FOUND, "Project not found"),
            ProjectError::TaskNotFound => (StatusCode::NOT_FOUND, "Task not found"),
            ProjectError::ValidationError(_) => (StatusCode::BAD_REQUEST, "Validation error"),
            ProjectError::DatabaseError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error"),
            ProjectError::OntologyError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Ontology error"),
        };

        (status, Json(serde_json::json!({ "error": message, "details": self.to_string() }))).into_response()
    }
}

pub fn project_routes() -> Router<ProjectService> {
    Router::new()
        // Projects
        .route("/", get(list_projects_handler).post(create_project_handler))
        .route("/:id", get(get_project_handler).put(update_project_handler).delete(delete_project_handler))
        .route("/:id/sub-projects", get(get_sub_projects_handler))
        // Tasks
        .route("/:id/tasks", get(get_project_tasks_handler).post(create_task_handler))
        .route("/:project_id/tasks/:task_id", put(update_task_handler).delete(delete_task_handler))
        // Members
        .route("/:id/members", get(get_project_members_handler))
        .route("/:id/members/:user_id", post(add_project_member_handler).delete(remove_project_member_handler))
        // Dependencies
        .route("/:project_id/tasks/:task_id/dependencies", get(get_task_dependencies_handler).post(add_task_dependency_handler))
        .route("/:project_id/tasks/:task_id/dependencies/:depends_on_id", delete(remove_task_dependency_handler))
}

// ============================================================================
// PROJECT HANDLERS
// ============================================================================

async fn list_projects_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    let projects = service.list_projects(user_id, 100).await?;
    Ok(Json(serde_json::json!({ "projects": projects })))
}

async fn create_project_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<CreateProjectInput>,
) -> Result<impl IntoResponse, ProjectError> {
    let owner_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;
    
    let project = service.create_project(input, owner_id).await?;
    Ok((StatusCode::CREATED, Json(project)))
}

async fn get_project_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    let project = service.get_project(id, user_id).await?;
    Ok(Json(project))
}

async fn update_project_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateProjectInput>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    let project = service.update_project(id, input, user_id).await?;
    Ok(Json(project))
}

async fn delete_project_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    service.delete_project(id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn get_sub_projects_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    let sub_projects = service.get_sub_projects(id, user_id).await?;
    Ok(Json(serde_json::json!({ "projects": sub_projects })))
}


// ============================================================================
// TASK HANDLERS
// ============================================================================

async fn get_project_tasks_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    let tasks = service.get_project_tasks(id, user_id).await?;
    Ok(Json(serde_json::json!({ "tasks": tasks })))
}

async fn create_task_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(project_id): Path<Uuid>,
    Json(input): Json<CreateTaskInput>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    let task = service.create_task(project_id, input, user_id).await?;
    Ok((StatusCode::CREATED, Json(task)))
}

#[derive(serde::Deserialize)]
struct TaskPathParams {
    #[allow(dead_code)]
    project_id: Uuid,
    task_id: Uuid,
}

async fn update_task_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(params): Path<TaskPathParams>,
    Json(input): Json<UpdateTaskInput>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    let task = service.update_task(params.task_id, input, user_id).await?;
    Ok(Json(task))
}

async fn delete_task_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(params): Path<TaskPathParams>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    service.delete_task(params.task_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// MEMBER HANDLERS
// ============================================================================

async fn get_project_members_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    let members = service.get_project_members(id, user_id).await?;
    Ok(Json(serde_json::json!({ "members": members })))
}

#[derive(serde::Deserialize)]
struct MemberPathParams {
    id: Uuid,
    user_id: Uuid,
}

async fn add_project_member_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(params): Path<MemberPathParams>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    service.add_project_member(params.id, params.user_id, user_id).await?;
    Ok(StatusCode::CREATED)
}

async fn remove_project_member_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(params): Path<MemberPathParams>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    service.remove_project_member(params.id, params.user_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// DEPENDENCY HANDLERS
// ============================================================================

async fn get_task_dependencies_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(params): Path<TaskPathParams>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    let dependencies = service.get_task_dependencies(params.task_id, user_id).await?;
    Ok(Json(serde_json::json!({ "dependencies": dependencies })))
}

#[derive(serde::Deserialize)]
struct DependencyPathParams {
    #[allow(dead_code)]
    project_id: Uuid,
    task_id: Uuid,
    depends_on_id: Uuid,
}

async fn add_task_dependency_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(params): Path<TaskPathParams>,
    Json(payload): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    // payload should contain "depends_on_id"
    let depends_on_id = payload.get("depends_on_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| ProjectError::ValidationError("Missing or invalid depends_on_id".to_string()))?;

    service.add_task_dependency(params.task_id, depends_on_id, user_id).await?;
    Ok(StatusCode::CREATED)
}

async fn remove_task_dependency_handler(
    State(service): State<ProjectService>,
    Extension(claims): Extension<Claims>,
    Path(params): Path<DependencyPathParams>,
) -> Result<impl IntoResponse, ProjectError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ProjectError::ValidationError("Invalid user ID".to_string()))?;

    service.remove_task_dependency(params.task_id, params.depends_on_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

