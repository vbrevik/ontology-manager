use axum::{extract::State, http::StatusCode, routing::post, Extension, Json, Router};
use serde::{Deserialize, Serialize};

use super::models::{
    default_navigation, evaluate_navigation, flatten_visible_items, NavItemSummary,
    NavSectionVisibility,
};
use super::service::{NavigationError, NavigationService};
use crate::features::auth::jwt::Claims;

#[derive(Debug, Deserialize)]
pub struct EvaluateRequest {
    pub permissions: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct SimulateRequest {
    pub baseline_permissions: Vec<String>,
    pub proposed_permissions: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct SimulationSummary {
    pub added: usize,
    pub removed: usize,
    pub unchanged: usize,
}

#[derive(Debug, Serialize)]
pub struct SimulationResponse {
    pub added_items: Vec<NavItemSummary>,
    pub removed_items: Vec<NavItemSummary>,
    pub unchanged_items: Vec<NavItemSummary>,
    pub summary: SimulationSummary,
}

pub fn navigation_routes() -> Router<NavigationService> {
    Router::new()
        .route("/evaluate", post(evaluate_navigation_handler))
        .route("/simulate", post(simulate_navigation_handler))
}

async fn evaluate_navigation_handler(
    State(service): State<NavigationService>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<EvaluateRequest>,
) -> Result<Json<Vec<NavSectionVisibility>>, StatusCode> {
    if let Some(permissions) = payload.permissions {
        return Ok(Json(service.evaluate_with_permissions(&permissions)));
    }

    service
        .evaluate_for_user(&claims.sub)
        .await
        .map(Json)
        .map_err(map_nav_error)
}

async fn simulate_navigation_handler(
    Extension(claims): Extension<Claims>,
    Json(payload): Json<SimulateRequest>,
) -> Result<Json<SimulationResponse>, StatusCode> {
    if !has_permission(&claims.permissions, "ui.view.roles") {
        return Err(StatusCode::FORBIDDEN);
    }

    let defs = default_navigation();
    let baseline = evaluate_navigation(
        &defs,
        &payload.baseline_permissions.iter().cloned().collect(),
    );
    let proposed = evaluate_navigation(
        &defs,
        &payload.proposed_permissions.iter().cloned().collect(),
    );

    let baseline_items = flatten_visible_items(&baseline);
    let proposed_items = flatten_visible_items(&proposed);

    let baseline_ids: std::collections::HashSet<_> =
        baseline_items.iter().map(|i| i.id.clone()).collect();
    let proposed_ids: std::collections::HashSet<_> =
        proposed_items.iter().map(|i| i.id.clone()).collect();

    let added_items = proposed_items
        .iter()
        .filter(|i| !baseline_ids.contains(&i.id))
        .cloned()
        .collect::<Vec<_>>();
    let removed_items = baseline_items
        .iter()
        .filter(|i| !proposed_ids.contains(&i.id))
        .cloned()
        .collect::<Vec<_>>();
    let unchanged_items = proposed_items
        .iter()
        .filter(|i| baseline_ids.contains(&i.id))
        .cloned()
        .collect::<Vec<_>>();

    let summary = SimulationSummary {
        added: added_items.len(),
        removed: removed_items.len(),
        unchanged: unchanged_items.len(),
    };

    Ok(Json(SimulationResponse {
        added_items,
        removed_items,
        unchanged_items,
        summary,
    }))
}

fn has_permission(permissions: &[String], required: &str) -> bool {
    permissions
        .iter()
        .any(|perm| perm == required || perm == "*")
}

fn map_nav_error(error: NavigationError) -> StatusCode {
    match error {
        NavigationError::InvalidUserId(_) => StatusCode::BAD_REQUEST,
        NavigationError::PermissionCheck(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
