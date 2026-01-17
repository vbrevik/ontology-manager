use super::impact::{ImpactReport, ImpactService, SimulateRoleChangeInput};
use super::models::*;
use super::service::RebacService;
use crate::features::auth::jwt::Claims;
use axum::Extension;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct UserIdQuery {
    pub user_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct PermissionQuery {
    pub permission: String,
}

pub fn rebac_routes() -> Router<RebacService> {
    Router::new()
        // Permission types
        // User scoped roles
        .route(
            "/users/:user_id/roles",
            get(list_user_roles).post(assign_role),
        )
        .route("/users/roles/:id", delete(revoke_role))
        .route("/users/roles/:id/schedule", put(update_role_schedule))
        // Permission checks
        .route("/check", get(check_permission))
        .route("/check/bulk", post(check_bulk_permissions))
        .route("/accessible-entities", get(get_accessible_entities))
        // Permission Types CRUD
        .route(
            "/permission-types",
            get(list_permission_types).post(create_permission_type),
        )
        .route(
            "/permission-types/:id",
            put(update_permission_type).delete(delete_permission_type),
        )
        // Relationship Types CRUD
        .route(
            "/relationship-types",
            get(list_relationship_types).post(create_relationship_type),
        )
        .route(
            "/relationship-types/:id",
            put(update_relationship_type).delete(delete_relationship_type),
        )
        // Role permission management
        .route("/roles/:role_id/permissions", get(get_role_permissions))
        .route(
            "/roles/:role_id/permission-mappings",
            get(get_role_permission_mappings),
        )
        .route(
            "/roles/:role_id/permissions/:permission",
            post(add_role_permission).delete(remove_role_permission),
        )
        // Cron schedule management
        .route("/schedules/validate", post(validate_cron))
        .route("/schedules/presets", get(get_schedule_presets))
        // Role management & Hierarchy
        .route("/roles", get(list_all_roles))
        .route("/roles/:id/level", put(update_role_level))
        // Delegation Rules
        .route(
            "/delegation-rules",
            get(list_delegation_rules).post(add_delegation_rule),
        )
        .route("/delegation-rules/:id", delete(remove_delegation_rule))
        // Impact Analysis
        .route("/impact/simulate-role", post(simulate_role_change))
        // Access Matrix
        .route("/matrix", post(get_access_matrix))
}

#[derive(Debug, Deserialize)]
pub struct MatrixRequest {
    pub user_ids: Vec<Uuid>,
}

async fn get_access_matrix(
    State(svc): State<RebacService>,
    Json(input): Json<MatrixRequest>,
) -> Result<Json<std::collections::HashMap<Uuid, Vec<String>>>, StatusCode> {
    svc.get_active_user_roles_batch(input.user_ids)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to fetch access matrix: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

// ============================================================================
// USER SCOPED ROLES
// ============================================================================

async fn list_user_roles(
    State(svc): State<RebacService>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<ScopedUserRoleWithDetails>>, StatusCode> {
    svc.list_user_scoped_roles(user_id)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn assign_role(
    State(svc): State<RebacService>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
    Json(mut input): Json<AssignScopedRoleInput>,
) -> Result<Json<ScopedUserRole>, StatusCode> {
    input.user_id = user_id;
    let granter_id = Uuid::parse_str(&claims.sub).ok();

    svc.assign_scoped_role(input, granter_id)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to assign role: {}", e);
            match e {
                super::service::RebacError::PermissionDenied(_) => StatusCode::FORBIDDEN,
                _ => StatusCode::BAD_REQUEST,
            }
        })
}

async fn revoke_role(
    State(svc): State<RebacService>,
    Path(id): Path<Uuid>,
    Json(input): Json<RevokeRoleInput>,
) -> Result<StatusCode, StatusCode> {
    svc.revoke_scoped_role(id, None, input.reason)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn update_role_schedule(
    State(svc): State<RebacService>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateScheduleRequest>,
) -> Result<Json<ScopedUserRole>, StatusCode> {
    svc.update_role_schedule(id, input.schedule_cron)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to update schedule: {}", e);
            StatusCode::BAD_REQUEST
        })
}

// ============================================================================
// PERMISSION CHECKS
// ============================================================================

async fn check_permission(
    State(svc): State<RebacService>,
    Query(query): Query<CheckPermissionQuery>,
) -> Result<Json<PermissionCheckResponse>, StatusCode> {
    let result = svc
        .check_permission(
            query.user_id,
            query.entity_id,
            &query.permission,
            query.tenant_id,
            query.field_name.as_deref(),
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = PermissionCheckResponse {
        user_id: query.user_id,
        entity_id: query.entity_id,
        permission: query.permission,
        allowed: result.has_permission.unwrap_or(false),
        reason: if result.is_denied.unwrap_or(false) {
            "Explicitly denied".to_string()
        } else if result.has_permission.unwrap_or(false) {
            format!(
                "Granted via role '{}'{}",
                result.granted_via_role.unwrap_or_default(),
                if result.is_inherited.unwrap_or(false) {
                    " (inherited)"
                } else {
                    ""
                }
            )
        } else {
            "No permission granted".to_string()
        },
    };

    Ok(Json(response))
}

async fn check_bulk_permissions(
    State(svc): State<RebacService>,
    Json(payload): Json<BulkCheckRequest>,
) -> Result<Json<BulkCheckResponse>, StatusCode> {
    let results = svc
        .check_multiple_permissions(
            payload.user_id,
            payload.entity_ids,
            &payload.permission,
            payload.tenant_id,
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = BulkCheckResponse {
        results: results
            .into_iter()
            .map(|(id, allowed, denied)| EntityPermissionResult {
                entity_id: id,
                allowed,
                is_denied: denied,
            })
            .collect(),
    };

    Ok(Json(response))
}

async fn _get_entity_permissions(
    State(svc): State<RebacService>,
    Path(entity_id): Path<Uuid>,
    Query(query): Query<UserIdQuery>,
) -> Result<Json<Vec<EntityPermission>>, StatusCode> {
    svc.get_user_entity_permissions(query.user_id, entity_id)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_accessible_entities(
    State(svc): State<RebacService>,
    Query(query): Query<UserIdQuery>,
    Query(perm_query): Query<PermissionQuery>,
) -> Result<Json<Vec<AccessibleEntity>>, StatusCode> {
    svc.get_accessible_entities(query.user_id, &perm_query.permission)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

// ============================================================================
// ROLE PERMISSIONS
// ============================================================================

async fn get_role_permission_mappings(
    State(svc): State<RebacService>,
    Path(role_id): Path<Uuid>,
) -> Result<Json<Vec<RolePermissionType>>, StatusCode> {
    svc.get_role_permission_mappings(role_id)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_role_permissions(
    State(svc): State<RebacService>,
    Path(role_id): Path<Uuid>,
) -> Result<Json<Vec<String>>, StatusCode> {
    svc.get_role_permissions(role_id)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Debug, Deserialize)]
pub struct AddRolePermissionQuery {
    pub field_name: Option<String>,
}

async fn add_role_permission(
    State(svc): State<RebacService>,
    Path((role_id, permission)): Path<(Uuid, String)>,
    Query(query): Query<AddRolePermissionQuery>,
) -> Result<StatusCode, StatusCode> {
    svc.add_permission_to_role(role_id, &permission, query.field_name)
        .await
        .map(|_| StatusCode::CREATED)
        .map_err(|_| StatusCode::BAD_REQUEST)
}

async fn remove_role_permission(
    State(svc): State<RebacService>,
    Path((role_id, permission)): Path<(Uuid, String)>,
) -> Result<StatusCode, StatusCode> {
    svc.remove_permission_from_role(role_id, &permission)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|_| StatusCode::NOT_FOUND)
}

// ============================================================================
// CRON SCHEDULE MANAGEMENT
// ============================================================================

async fn validate_cron(Json(input): Json<ValidateCronRequest>) -> Json<CronValidationResponse> {
    use std::str::FromStr;

    match cron::Schedule::from_str(&input.cron) {
        Ok(schedule) => {
            // Get next 5 occurrences
            let now = chrono::Utc::now();
            let next_occurrences: Vec<String> = schedule
                .after(&now)
                .take(5)
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S UTC").to_string())
                .collect();

            Json(CronValidationResponse {
                valid: true,
                error: None,
                next_occurrences,
            })
        }
        Err(e) => Json(CronValidationResponse {
            valid: false,
            error: Some(format!("Invalid cron expression: {}", e)),
            next_occurrences: vec![],
        }),
    }
}

async fn get_schedule_presets() -> Json<Vec<CronPreset>> {
    Json(RebacService::get_schedule_presets())
}

// ============================================================================
// PERMISSION TYPES HANDLERS
// ============================================================================

async fn list_permission_types(
    State(svc): State<RebacService>,
) -> Result<Json<Vec<PermissionType>>, StatusCode> {
    svc.list_permission_types()
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn create_permission_type(
    State(svc): State<RebacService>,
    Json(input): Json<CreatePermissionTypeInput>,
) -> Result<(StatusCode, Json<PermissionType>), StatusCode> {
    svc.create_permission_type(input)
        .await
        .map(|pt| (StatusCode::CREATED, Json(pt)))
        .map_err(|_| StatusCode::BAD_REQUEST)
}

async fn update_permission_type(
    State(svc): State<RebacService>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdatePermissionTypeInput>,
) -> Result<Json<PermissionType>, StatusCode> {
    svc.update_permission_type(id, input)
        .await
        .map(Json)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn delete_permission_type(
    State(svc): State<RebacService>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    svc.delete_permission_type(id)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|_| StatusCode::NOT_FOUND)
}

// ============================================================================
// RELATIONSHIP TYPES HANDLERS
// ============================================================================

async fn list_relationship_types(
    State(svc): State<RebacService>,
) -> Result<Json<Vec<RelationshipType>>, StatusCode> {
    svc.list_relationship_types()
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn create_relationship_type(
    State(svc): State<RebacService>,
    Json(input): Json<CreateRelationshipTypeInput>,
) -> Result<(StatusCode, Json<RelationshipType>), StatusCode> {
    svc.create_relationship_type(input)
        .await
        .map(|rt| (StatusCode::CREATED, Json(rt)))
        .map_err(|_| StatusCode::BAD_REQUEST)
}

async fn update_relationship_type(
    State(svc): State<RebacService>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateRelationshipTypeInput>,
) -> Result<Json<RelationshipType>, StatusCode> {
    svc.update_relationship_type(id, input)
        .await
        .map(Json)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn delete_relationship_type(
    State(svc): State<RebacService>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    svc.delete_relationship_type(id)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|_| StatusCode::NOT_FOUND)
}

// ============================================================================
// ROLE HIERARCHY & DELEGATION HANDLERS
// ============================================================================

async fn list_all_roles(
    State(svc): State<RebacService>,
) -> Result<Json<Vec<crate::features::abac::models::Role>>, StatusCode> {
    svc.list_roles(None)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Debug, Deserialize)]
pub struct UpdateRoleLevelInput {
    pub level: i32,
}

async fn update_role_level(
    State(svc): State<RebacService>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateRoleLevelInput>,
) -> Result<StatusCode, StatusCode> {
    svc.update_role_level(id, input.level)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn list_delegation_rules(
    State(svc): State<RebacService>,
) -> Result<Json<Vec<crate::features::abac::models::RoleDelegationRule>>, StatusCode> {
    svc.list_delegation_rules(None)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Debug, Deserialize)]
pub struct AddDelegationRuleInput {
    pub granter_role_id: Uuid,
    pub grantee_role_id: Uuid,
    pub can_grant: bool,
    pub can_modify: bool,
    pub can_revoke: bool,
    pub tenant_id: Option<Uuid>,
}

async fn add_delegation_rule(
    State(svc): State<RebacService>,
    Json(input): Json<AddDelegationRuleInput>,
) -> Result<Json<crate::features::abac::models::RoleDelegationRule>, StatusCode> {
    svc.add_delegation_rule(
        input.granter_role_id,
        input.grantee_role_id,
        input.can_grant,
        input.can_modify,
        input.can_revoke,
        input.tenant_id,
    )
    .await
    .map(Json)
    .map_err(|_| StatusCode::BAD_REQUEST)
}

async fn remove_delegation_rule(
    State(svc): State<RebacService>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    svc.remove_delegation_rule(id)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn simulate_role_change(
    State(svc): State<RebacService>,
    Json(input): Json<SimulateRoleChangeInput>,
) -> Result<Json<ImpactReport>, StatusCode> {
    let impact_svc = ImpactService::new(svc.pool.clone());
    impact_svc
        .simulate_role_change(input)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Impact simulation failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}
