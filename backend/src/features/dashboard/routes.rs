use axum::{routing::get, Json, Router, extract::State};
use serde::Serialize;

use crate::features::auth::service::AuthService;
use crate::features::auth::service::AuthError;

pub fn dashboard_routes() -> Router<AuthService> {
    Router::new()
        .route("/stats", get(stats_handler))
        .route("/activity", get(activity_handler))
}

#[derive(Serialize)]
struct Stats {
    total_users: i64,
    active_refresh_tokens: i64,
}

#[derive(Serialize)]
struct ActivityEntry {
    id: String,
    username: String,
    email: String,
    created_at: String,
}

async fn stats_handler(State(auth_service): State<AuthService>) -> Result<Json<Stats>, AuthError> {
    let total = auth_service.count_users().await?;
    let active_tokens = auth_service.count_active_refresh_tokens().await?;
    Ok(Json(Stats {
        total_users: total,
        active_refresh_tokens: active_tokens,
    }))
}

async fn activity_handler(State(auth_service): State<AuthService>) -> Result<Json<Vec<ActivityEntry>>, AuthError> {
    let users = auth_service.recent_users(10).await?;

    let activities: Vec<ActivityEntry> = users.into_iter().map(|r| ActivityEntry {
        id: r.id.to_string(),
        username: r.username,
        email: r.email,
        created_at: r.created_at.to_rfc3339(),
    }).collect();

    Ok(Json(activities))
}


