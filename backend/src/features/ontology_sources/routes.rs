use super::models::{ActiveSourcesResponse, SetActiveInput, SourceResponse};
use super::service::{OntologySourceService, SourceError};
use axum::{extract::State, routing::get, Json, Router};

pub fn ontology_sources_routes() -> Router<OntologySourceService> {
    Router::new()
        .route("/", get(list_sources))
        .route("/active", get(get_active).put(set_active))
}

async fn list_sources(
    State(svc): State<OntologySourceService>,
) -> Result<Json<Vec<SourceResponse>>, SourceError> {
    svc.discover_sources().await.map(Json)
}

async fn get_active(
    State(svc): State<OntologySourceService>,
) -> Result<Json<ActiveSourcesResponse>, SourceError> {
    svc.get_active_sources().await.map(Json)
}

async fn set_active(
    State(svc): State<OntologySourceService>,
    Json(input): Json<SetActiveInput>,
) -> Result<Json<ActiveSourcesResponse>, SourceError> {
    svc.set_active_sources(input).await.map(Json)
}
