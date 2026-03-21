use super::models::{ImportParams, ImportResult, UnloadResult};
use super::service::ImportService;
use crate::features::import_engine::ImportError;
use axum::{
    extract::{Path, Query, State},
    routing::post,
    Json, Router,
};

pub fn import_engine_routes() -> Router<ImportService> {
    Router::new().route("/{id}/import", post(import_source).delete(unload_source))
}

async fn import_source(
    State(svc): State<ImportService>,
    Path(source_id): Path<String>,
    Query(params): Query<ImportParams>,
) -> Result<Json<ImportResult>, ImportError> {
    let role = params.role.as_deref().unwrap_or("base");
    svc.import_source(&source_id, role).await.map(Json)
}

async fn unload_source(
    State(svc): State<ImportService>,
    Path(source_id): Path<String>,
) -> Result<Json<UnloadResult>, ImportError> {
    svc.unload_source(&source_id).await.map(Json)
}
