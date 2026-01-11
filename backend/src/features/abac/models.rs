use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Represents an area/scope within the application (e.g., a project, team, module)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Resource {
    pub id: Uuid,
    pub name: String,
    pub resource_type: String,
    pub created_at: DateTime<Utc>,
}

/// A role that can be assigned to users
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Role {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub level: i32,
    pub tenant_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// Defines which role can grant/modify/revoke another role
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RoleDelegationRule {
    pub id: Uuid,
    pub granter_role_id: Uuid,
    pub grantee_role_id: Uuid,
    pub can_grant: bool,
    pub can_modify: bool,
    pub can_revoke: bool,
    pub tenant_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// Links a user to a role, optionally scoped to a specific resource
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserRole {
    pub id: Uuid,
    pub user_id: Uuid,
    pub role_id: Uuid,
    pub resource_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// A permission (action) granted by a role
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Permission {
    pub id: Uuid,
    pub role_id: Uuid,
    pub action: String,
    pub created_at: DateTime<Utc>,
}

/// Represents a user's role assignment with resolved names (for API responses)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserRoleAssignment {
    pub id: Uuid,
    pub user_id: Uuid,
    pub role_name: String,
    pub resource_id: Option<Uuid>,
    pub resource_name: Option<String>,
}

/// Input for assigning a role to a user
#[derive(Debug, Deserialize)]
pub struct AssignRoleInput {
    pub user_id: String,
    pub role_name: String,
    pub resource_id: Option<String>,
}

/// Input for creating a new resource
#[derive(Debug, Deserialize)]
pub struct CreateResourceInput {
    pub name: String,
    pub resource_type: String,
}
