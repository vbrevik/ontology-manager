use axum::{
    routing::post,
    Router, Json, extract::State,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use super::service::{AiService, GenerateRequest, GenerateResponse};

#[derive(Debug, Deserialize)]
pub struct GenerateClassDescriptionRequest {
    pub name: String,
    pub properties: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct GenerateClassDescriptionResponse {
    pub description: String,
}

#[derive(Debug, Deserialize)]
pub struct SuggestRequest {
    pub context: String,
}

pub fn ai_routes() -> Router<AiService> {
    Router::new()
        .route("/generate", post(generate_text))
        .route("/generate-class-description", post(generate_class_description))
        .route("/suggest-roles", post(suggest_roles))
        .route("/suggest-ontology", post(suggest_ontology))
}

async fn suggest_roles(
    State(svc): State<AiService>,
    Json(payload): Json<SuggestRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let result = svc.generate_role_suggestions(&payload.context).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let json: serde_json::Value = serde_json::from_str(&result)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(json))
}

async fn suggest_ontology(
    State(svc): State<AiService>,
    Json(payload): Json<SuggestRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let result = svc.generate_ontology_suggestions(&payload.context).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let json: serde_json::Value = serde_json::from_str(&result)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(json))
}

async fn generate_text(
    State(svc): State<AiService>,
    Json(payload): Json<GenerateRequest>,
) -> Result<Json<GenerateResponse>, StatusCode> {
    svc.generate_text(payload).await
        .map(Json)
        .map_err(|e| {
            tracing::error!("AI generation failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

async fn generate_class_description(
    State(svc): State<AiService>,
    Json(payload): Json<GenerateClassDescriptionRequest>,
) -> Result<Json<GenerateClassDescriptionResponse>, StatusCode> {
    svc.generate_class_description(&payload.name, payload.properties).await
        .map(|description| Json(GenerateClassDescriptionResponse { description }))
        .map_err(|e| {
            tracing::error!("Class description generation failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}
