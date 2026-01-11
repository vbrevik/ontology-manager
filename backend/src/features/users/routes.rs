use axum::{
    extract::{Path, State, Json},
    routing::{get, post, put, delete},
    Router, Extension,
};
use crate::features::auth::jwt::Claims;
use crate::features::users::service::UserService;
use crate::features::auth::models::User;
use crate::features::auth::service::AuthError;
use serde::Deserialize;

pub fn users_routes() -> Router<UserService> {
    Router::new()
        .route("/", get(list_users))
        .route("/", post(create_user))
        .route("/:id", get(get_user))
        .route("/:id", put(update_user))
        .route("/:id", delete(delete_user))
}

#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub email: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct UpdateUserRequest {
    pub username: Option<String>,
    pub email: Option<String>,
}

async fn list_users(
    State(service): State<UserService>,
) -> Result<Json<Vec<User>>, AuthError> {
    let users = service.find_all().await?;
    Ok(Json(users))
}

async fn get_user(
    State(service): State<UserService>,
    Path(id): Path<String>,
) -> Result<Json<User>, AuthError> {
    let user = service.find_by_id(&id).await?;
    Ok(Json(user))
}

async fn create_user(
    State(service): State<UserService>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreateUserRequest>,
) -> Result<Json<User>, AuthError> {
    let performing_user_id = uuid::Uuid::parse_str(&claims.sub).ok();
    let user = service.create(&req.username, &req.email, &req.password, performing_user_id).await?;
    Ok(Json(user))
}

async fn update_user(
    State(service): State<UserService>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<String>,
    Json(req): Json<UpdateUserRequest>,
) -> Result<Json<User>, AuthError> {
    let performing_user_id = uuid::Uuid::parse_str(&claims.sub).ok();
    let user = service.update(&id, req.username, req.email, performing_user_id).await?;
    Ok(Json(user))
}

async fn delete_user(
    State(service): State<UserService>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AuthError> {
    let performing_user_id = uuid::Uuid::parse_str(&claims.sub).ok();
    service.delete(&id, performing_user_id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}
