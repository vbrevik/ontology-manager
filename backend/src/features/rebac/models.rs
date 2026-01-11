use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

// ============================================================================
// PERMISSION TYPES
// ============================================================================

/// Granular permission type (Discover, Read, ReadSensitive, Update, etc.)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PermissionType {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub level: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePermissionTypeInput {
    pub name: String,
    pub description: Option<String>,
    pub level: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePermissionTypeInput {
    pub description: Option<String>,
    pub level: Option<i32>,
}

// ============================================================================
// ROLE PERMISSION MAPPINGS
// ============================================================================

/// Links a role to a permission type
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RolePermissionType {
    pub id: Uuid,
    pub role_id: Uuid,
    pub permission_type_id: Uuid,
    pub field_name: Option<String>,
    pub effect: String,
    pub created_at: DateTime<Utc>,
}

/// Role with its permissions (for API responses)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleWithPermissions {
    pub role_id: Uuid,
    pub role_name: String,
    pub permissions: Vec<String>,
}

// ============================================================================
// RELATIONSHIP TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RelationshipType {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub grants_permission_inheritance: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRelationshipTypeInput {
    pub name: String,
    pub description: Option<String>,
    pub grants_permission_inheritance: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRelationshipTypeInput {
    pub description: Option<String>,
    pub grants_permission_inheritance: Option<bool>,
}

/// A scoped role assignment with temporal and DENY support
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScopedUserRole {
    pub id: Uuid,
    pub user_id: Uuid,
    pub role_id: Uuid,
    pub scope_entity_id: Option<Uuid>,
    pub valid_from: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,
    pub schedule_cron: Option<String>,
    pub is_deny: bool,
    pub granted_by: Option<Uuid>,
    pub granted_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoked_by: Option<Uuid>,
    pub revoke_reason: Option<String>,
}

/// Scoped role with resolved names
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScopedUserRoleWithDetails {
    pub id: Uuid,
    pub user_id: Uuid,
    pub role_id: Uuid,
    pub role_name: String,
    pub scope_entity_id: Option<Uuid>,
    pub scope_entity_name: Option<String>,
    pub valid_from: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,
    pub schedule_cron: Option<String>,
    pub is_deny: bool,
    pub granted_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AssignScopedRoleInput {
    pub user_id: Uuid,
    pub role_name: String,
    pub scope_entity_id: Option<Uuid>,
    pub valid_from: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,
    pub schedule_cron: Option<String>,
    pub is_deny: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RevokeRoleInput {
    pub reason: Option<String>,
}

// ============================================================================
// PERMISSION CHECK RESULTS
// ============================================================================

/// Result of a permission check
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PermissionCheckResult {
    pub has_permission: Option<bool>,
    pub granted_via_entity_id: Option<Uuid>,
    pub granted_via_role: Option<String>,
    pub is_inherited: Option<bool>,
    pub is_denied: Option<bool>,
}

/// User's permissions on an entity
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EntityPermission {
    pub permission_name: String,
    pub has_permission: Option<bool>,
    pub is_denied: Option<bool>,
}

/// Entity accessible by user
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AccessibleEntity {
    pub entity_id: Uuid,
    pub entity_name: String,
    pub class_name: String,
    pub access_type: String,
}

// ============================================================================
// API REQUEST/RESPONSE
// ============================================================================

#[derive(Debug, Serialize)]
pub struct PermissionCheckResponse {
    pub user_id: Uuid,
    pub entity_id: Uuid,
    pub permission: String,
    pub allowed: bool,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct CheckPermissionQuery {
    pub user_id: Uuid,
    pub entity_id: Uuid,
    pub permission: String,
    pub tenant_id: Option<Uuid>,
    pub field_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BulkCheckRequest {
    pub user_id: Uuid,
    pub entity_ids: Vec<Uuid>,
    pub permission: String,
    pub tenant_id: Option<Uuid>,
}

#[derive(Debug, serde::Serialize)]
pub struct BulkCheckResponse {
    pub results: Vec<EntityPermissionResult>,
}

#[derive(Debug, serde::Serialize)]
pub struct EntityPermissionResult {
    pub entity_id: Uuid,
    pub allowed: bool,
    pub is_denied: bool,
}

/// Cron schedule preset for easy selection
#[derive(Debug, Clone, Serialize)]
pub struct CronPreset {
    pub name: String,
    pub cron: String,
    pub description: String,
}

/// Request to validate a cron expression
#[derive(Debug, Deserialize)]
pub struct ValidateCronRequest {
    pub cron: String,
}

/// Response for cron validation
#[derive(Debug, Serialize)]
pub struct CronValidationResponse {
    pub valid: bool,
    pub error: Option<String>,
    pub next_occurrences: Vec<String>,
}

/// Request to update role schedule
#[derive(Debug, Deserialize)]
pub struct UpdateScheduleRequest {
    pub schedule_cron: Option<String>,
}
