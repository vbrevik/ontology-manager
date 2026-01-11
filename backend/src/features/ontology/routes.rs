use axum::{
    routing::{get, post, put, delete},
    Router, Json, extract::{State, Path, Query},
    http::StatusCode, Extension,
};
use crate::features::auth::jwt::Claims;
use serde::Deserialize;
use uuid::Uuid;
use super::service::OntologyService;
use super::models::*;

#[derive(Debug, Deserialize)]
pub struct ListEntitiesQuery {
    pub class_id: Option<Uuid>,
    pub tenant_id: Option<Uuid>,
    pub is_root: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RelationshipsQuery {
    pub direction: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CloneVersionInput {
    pub name: String,
}

pub fn ontology_routes() -> Router<OntologyService> {
    Router::new()
        // Schema versions
        .route("/versions", get(list_versions).post(create_version))
        .route("/versions/current", get(get_current_version))
        .route("/versions/:id/clone", post(clone_version))
        .route("/versions/:id/publish", post(publish_version))
        // Classes
        .route("/classes", get(list_classes).post(create_class))
        .route("/classes/:id", get(get_class).put(update_class).delete(delete_class))
        .route("/classes/:id/properties", get(list_properties))
        // Properties
        .route("/properties", post(create_property))
        .route("/properties/:id", put(update_property).delete(delete_property))
        // Entities
        .route("/entities", get(list_entities).post(create_entity))
        .route("/entities/:id", get(get_entity).put(update_entity).delete(delete_entity))
        .route("/entities/:id/approve", post(approve_entity))
        .route("/entities/:id/reject", post(reject_entity))
        .route("/entities/:id/ancestors", get(get_entity_ancestors))
        .route("/entities/:id/descendants", get(get_entity_descendants))
        .route("/entities/:id/relationships", get(get_entity_relationships))
        // Relationships
        .route("/relationship-types", get(list_relationship_types))
        .route("/relationships", post(create_relationship))
        .route("/relationships/:id", delete(delete_relationship))
}

// ============================================================================
// VERSIONS
// ============================================================================

async fn list_versions(
    State(svc): State<OntologyService>,
) -> Result<Json<Vec<OntologyVersion>>, StatusCode> {
    svc.list_versions().await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_current_version(
    State(svc): State<OntologyService>,
) -> Result<Json<OntologyVersion>, StatusCode> {
    svc.get_current_version().await
        .map(Json)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn create_version(
    State(svc): State<OntologyService>,
    Json(input): Json<CreateVersionInput>,
) -> Result<Json<OntologyVersion>, StatusCode> {
    svc.create_version(input, None).await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn clone_version(
    State(svc): State<OntologyService>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(input): Json<CloneVersionInput>,
) -> Result<Json<OntologyVersion>, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).ok();
    svc.clone_version(id, input.name, user_id).await
        .map(Json)
        .map_err(|e| {
            tracing::error!(error = ?e, "clone_version failed");
            e.to_status_code()
        })
}

async fn publish_version(
    State(svc): State<OntologyService>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OntologyVersion>, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).ok();
    svc.publish_version(id, user_id).await
        .map(Json)
        .map_err(|e| {
            tracing::error!(error = ?e, "publish_version failed");
            e.to_status_code()
        })
}

// ============================================================================
// CLASSES
// ============================================================================

async fn list_classes(
    State(svc): State<OntologyService>,
) -> Result<Json<Vec<ClassWithParent>>, StatusCode> {
    svc.list_classes(None).await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_class(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
) -> Result<Json<Class>, StatusCode> {
    svc.get_class(id).await
        .map(Json)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn create_class(
    State(svc): State<OntologyService>,
    Json(input): Json<CreateClassInput>,
) -> Result<Json<Class>, StatusCode> {
    svc.create_class(input, None).await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn update_class(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateClassInput>,
) -> Result<Json<Class>, StatusCode> {
    svc.update_class(id, input).await
        .map(Json)
        .map_err(|e| e.to_status_code())
}

async fn delete_class(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    svc.delete_class(id).await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| e.to_status_code())
}

// ============================================================================
// PROPERTIES
// ============================================================================

async fn list_properties(
    State(svc): State<OntologyService>,
    Path(class_id): Path<Uuid>,
) -> Result<Json<Vec<Property>>, StatusCode> {
    svc.list_properties(class_id).await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn create_property(
    State(svc): State<OntologyService>,
    Json(input): Json<CreatePropertyInput>,
) -> Result<Json<Property>, StatusCode> {
    svc.create_property(input).await
        .map(Json)
        .map_err(|e| e.to_status_code())
}

async fn update_property(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdatePropertyInput>,
) -> Result<Json<Property>, StatusCode> {
    svc.update_property(id, input).await
        .map(Json)
        .map_err(|e| e.to_status_code())
}

async fn delete_property(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    svc.delete_property(id).await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| e.to_status_code())
}

// ============================================================================
// ENTITIES
// ============================================================================

async fn list_entities(
    State(svc): State<OntologyService>,
    Query(query): Query<ListEntitiesQuery>,
) -> Result<Json<Vec<EntityWithDetails>>, StatusCode> {
    svc.list_entities(query.class_id, query.tenant_id, query.is_root).await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_entity(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
) -> Result<Json<Entity>, StatusCode> {
    svc.get_entity(id).await
        .map(Json)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn create_entity(
    State(svc): State<OntologyService>,
    Json(input): Json<CreateEntityInput>,
) -> Result<Json<Entity>, (StatusCode, Json<serde_json::Value>)> {
    svc.create_entity(input, None, None).await
        .map(Json)
        .map_err(|e| {
            (e.to_status_code(), Json(serde_json::json!({ "error": e.to_string() })))
        })
}

async fn update_entity(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateEntityInput>,
) -> Result<Json<Entity>, (StatusCode, Json<serde_json::Value>)> {
    svc.update_entity(id, input, None).await
        .map(Json)
        .map_err(|e| {
            (e.to_status_code(), Json(serde_json::json!({ "error": e.to_string() })))
        })
}

async fn approve_entity(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
) -> Result<Json<Entity>, (StatusCode, Json<serde_json::Value>)> {
    svc.approve_entity(id, None).await
        .map(Json)
        .map_err(|e| {
            (e.to_status_code(), Json(serde_json::json!({ "error": e.to_string() })))
        })
}

async fn reject_entity(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
) -> Result<Json<Entity>, (StatusCode, Json<serde_json::Value>)> {
    svc.reject_entity(id, None).await
        .map(Json)
        .map_err(|e| {
            (e.to_status_code(), Json(serde_json::json!({ "error": e.to_string() })))
        })
}

async fn delete_entity(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    svc.delete_entity(id, None).await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_entity_ancestors(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<EntityPathNode>>, StatusCode> {
    svc.get_entity_ancestors(id).await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_entity_descendants(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<EntityDescendantNode>>, StatusCode> {
    svc.get_entity_descendants(id).await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

// ============================================================================
// RELATIONSHIPS
// ============================================================================

async fn list_relationship_types(
    State(svc): State<OntologyService>,
) -> Result<Json<Vec<RelationshipType>>, StatusCode> {
    svc.list_relationship_types().await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_entity_relationships(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
    Query(query): Query<RelationshipsQuery>,
) -> Result<Json<Vec<RelationshipWithDetails>>, StatusCode> {
    svc.get_entity_relationships(id, query.direction.as_deref()).await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn create_relationship(
    State(svc): State<OntologyService>,
    Json(input): Json<CreateRelationshipInput>,
) -> Result<Json<Relationship>, StatusCode> {
    svc.create_relationship(input, None).await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn delete_relationship(
    State(svc): State<OntologyService>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    svc.delete_relationship(id).await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
