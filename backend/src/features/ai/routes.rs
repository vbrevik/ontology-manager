use super::service::{AiService, GenerateRequest, GenerateResponse};
use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
use serde::{Deserialize, Serialize};

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
        .route(
            "/generate-class-description",
            post(generate_class_description),
        )
        .route("/suggest-roles", post(suggest_roles))
        .route("/suggest-ontology", post(suggest_ontology))
        .route("/suggest-contexts", post(suggest_contexts))
        .route("/status", post(get_status).get(get_status))
        .route("/models", post(get_models).get(get_models))
}

async fn suggest_roles(
    State(svc): State<AiService>,
    Json(payload): Json<SuggestRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 1. Fetch existing permissions and roles for context
    let permissions = sqlx::query_scalar::<_, String>(
        r#"
        SELECT e.display_name FROM entities e
        JOIN classes c ON e.class_id = c.id
        WHERE c.name = 'Permission' AND e.deleted_at IS NULL
        "#,
    )
    .fetch_all(svc.pool())
    .await
    .unwrap_or_default();

    let roles = sqlx::query_scalar::<_, String>(
        r#"
        SELECT e.display_name FROM entities e
        JOIN classes c ON e.class_id = c.id
        WHERE c.name = 'Role' AND e.deleted_at IS NULL
        "#,
    )
    .fetch_all(svc.pool())
    .await
    .unwrap_or_default();

    // 2. Call AI service with context
    let result = svc
        .generate_role_suggestions(&payload.context, &permissions, &roles)
        .await
        .map_err(|e| {
            tracing::error!("Role suggestion failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let json: serde_json::Value = serde_json::from_str(&result).map_err(|e| {
        tracing::error!("Failed to parse role suggestion JSON: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json))
}

async fn suggest_ontology(
    State(svc): State<AiService>,
    Json(payload): Json<SuggestRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let result = svc
        .generate_ontology_suggestions(&payload.context)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let json: serde_json::Value =
        serde_json::from_str(&result).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json))
}

async fn suggest_contexts(
    State(svc): State<AiService>,
    Json(payload): Json<SuggestRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let result = svc
        .generate_context_suggestions(&payload.context)
        .await
        .map_err(|e| {
            tracing::error!("Context suggestion failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let json: serde_json::Value = serde_json::from_str(&result).map_err(|e| {
        tracing::error!("Failed to parse context suggestion JSON: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json))
}

async fn get_status(State(svc): State<AiService>) -> Result<Json<serde_json::Value>, StatusCode> {
    match svc.check_health().await {
        Ok(status) => Ok(Json(status)),
        Err(e) => {
            tracing::warn!("AI Status check failed: {}", e);
            Ok(Json(serde_json::json!({
                "status": "Unhealthy",
                "message": e
            })))
        }
    }
}

async fn get_models(State(svc): State<AiService>) -> Result<Json<Vec<String>>, StatusCode> {
    svc.list_models().await.map(Json).map_err(|e| {
        tracing::error!("Failed to list models: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })
}

async fn generate_text(
    State(svc): State<AiService>,
    Json(payload): Json<GenerateRequest>,
) -> Result<Json<GenerateResponse>, StatusCode> {
    svc.generate_text(payload).await.map(Json).map_err(|e| {
        tracing::error!("AI generation failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })
}

async fn generate_class_description(
    State(svc): State<AiService>,
    Json(payload): Json<GenerateClassDescriptionRequest>,
) -> Result<Json<GenerateClassDescriptionResponse>, StatusCode> {
    svc.generate_class_description(&payload.name, payload.properties)
        .await
        .map(|description| Json(GenerateClassDescriptionResponse { description }))
        .map_err(|e| {
            tracing::error!("Class description generation failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}
