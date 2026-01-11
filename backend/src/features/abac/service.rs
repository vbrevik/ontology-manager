use sqlx::{Pool, Postgres};
use super::models::{Resource, Role, UserRole, Permission, UserRoleAssignment, AssignRoleInput, CreateResourceInput};
use uuid::Uuid;

#[derive(Debug)]
pub enum AbacError {
    DatabaseError(String),
    NotFound(String),
    InvalidInput(String),
}

impl std::fmt::Display for AbacError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AbacError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            AbacError::NotFound(msg) => write!(f, "Not found: {}", msg),
            AbacError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
        }
    }
}

impl From<sqlx::Error> for AbacError {
    fn from(err: sqlx::Error) -> Self {
        AbacError::DatabaseError(err.to_string())
    }
}

use crate::features::rebac::RebacService;

#[derive(Clone)]
pub struct AbacService {
    pool: Pool<Postgres>,
    rebac_service: RebacService,
}

impl AbacService {
    pub fn new(pool: Pool<Postgres>, rebac_service: RebacService) -> Self {
        Self { pool, rebac_service }
    }

    // ==================== ROLES ====================

    pub async fn list_roles(&self) -> Result<Vec<Role>, AbacError> {
        let roles = sqlx::query_as::<_, Role>("SELECT id, name, description, created_at FROM roles ORDER BY name")
            .fetch_all(&self.pool)
            .await?;
        Ok(roles)
    }

    pub async fn get_role_by_name(&self, name: &str) -> Result<Role, AbacError> {
        sqlx::query_as::<_, Role>("SELECT id, name, description, created_at FROM roles WHERE name = $1")
            .bind(name)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| AbacError::NotFound(format!("Role '{}' not found", name)))
    }

    pub async fn create_role(&self, name: &str, description: Option<&str>) -> Result<Role, AbacError> {
        let role = sqlx::query_as::<_, Role>(
            "INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at"
        )
            .bind(name)
            .bind(description)
            .fetch_one(&self.pool)
            .await?;
        Ok(role)
    }

    // ==================== RESOURCES ====================

    pub async fn list_resources(&self) -> Result<Vec<Resource>, AbacError> {
        let resources = sqlx::query_as::<_, Resource>("SELECT id, name, resource_type, created_at FROM resources ORDER BY name")
            .fetch_all(&self.pool)
            .await?;
        Ok(resources)
    }

    pub async fn create_resource(&self, input: CreateResourceInput) -> Result<Resource, AbacError> {
        let resource = sqlx::query_as::<_, Resource>(
            "INSERT INTO resources (name, resource_type) VALUES ($1, $2) RETURNING id, name, resource_type, created_at"
        )
            .bind(&input.name)
            .bind(&input.resource_type)
            .fetch_one(&self.pool)
            .await?;
        Ok(resource)
    }

    // ==================== USER ROLES ====================

    pub async fn get_user_roles(&self, user_id: &str) -> Result<Vec<UserRoleAssignment>, AbacError> {
        let user_uuid = Uuid::parse_str(user_id).map_err(|e| AbacError::InvalidInput(e.to_string()))?;
        let assignments = sqlx::query_as::<_, UserRoleAssignment>(
            r#"
            SELECT 
                ur.id,
                ur.user_id,
                r.name as role_name,
                ur.resource_id,
                res.name as resource_name
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            LEFT JOIN resources res ON ur.resource_id = res.id
            WHERE ur.user_id = $1
            ORDER BY r.name, res.name
            "#
        )
            .bind(user_uuid)
            .fetch_all(&self.pool)
            .await?;
        Ok(assignments)
    }

    pub async fn assign_role(&self, input: AssignRoleInput, granter_id: Option<Uuid>) -> Result<UserRole, AbacError> {
        // Find the role by name
        let role = self.get_role_by_name(&input.role_name).await?;
        
        let user_uuid = Uuid::parse_str(&input.user_id).map_err(|e| AbacError::InvalidInput(e.to_string()))?;
        let resource_uuid = if let Some(ref rid) = input.resource_id {
            Some(Uuid::parse_str(rid).map_err(|e| AbacError::InvalidInput(e.to_string()))?)
        } else {
            None
        };

        // Convert AssignRoleInput (ABAC) to AssignScopedRoleInput (ReBAC)
        let scoped_input = crate::features::rebac::models::AssignScopedRoleInput {
            user_id: user_uuid,
            role_name: input.role_name.clone(),
            scope_entity_id: resource_uuid,
            valid_from: None,
            valid_until: None,
            schedule_cron: None,
            is_deny: Some(false),
        };

        // Delegate to RebacService to enforce delegation rules and level checks
        self.rebac_service.assign_scoped_role(scoped_input, granter_id).await
            .map_err(|e| match e {
                crate::features::rebac::service::RebacError::PermissionDenied(msg) => AbacError::InvalidInput(msg),
                crate::features::rebac::service::RebacError::NotFound(msg) => AbacError::NotFound(msg),
                _ => AbacError::DatabaseError(e.to_string()),
            })?;

        // Re-fetch or reconstruct UserRole to match the expected return type
        // Since assign_scoped_role returns a ScopedUserRole (which uses 'roles' table hierarchy),
        // and UserRole (ABAC) uses the 'user_roles' table (legacy), 
        // we might need to actually insert into user_roles if we want to maintain the legacy table,
        // OR we should transition ABAC to use the same table.
        // Looking at the codebase, user_roles and scoped_user_roles seem to be separate entities for now.
        // However, the USER objective specifically mentioned "role delegation rules" which were added to ReBAC.
        // Let's check the schema for user_roles vs scoped_user_roles.
        
        let user_role = sqlx::query_as::<_, UserRole>(
            r#"
            INSERT INTO user_roles (user_id, role_id, resource_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, role_id, resource_id) DO UPDATE SET user_id = EXCLUDED.user_id
            RETURNING id, user_id, role_id, resource_id, created_at
            "#
        )
            .bind(user_uuid)
            .bind(role.id)
            .bind(resource_uuid)
            .fetch_one(&self.pool)
            .await?;
        Ok(user_role)
    }

    pub async fn remove_role(&self, user_role_id: &str) -> Result<(), AbacError> {
        let ur_uuid = Uuid::parse_str(user_role_id).map_err(|e| AbacError::InvalidInput(e.to_string()))?;
        let result = sqlx::query("DELETE FROM user_roles WHERE id = $1")
            .bind(ur_uuid)
            .execute(&self.pool)
            .await?;
        
        if result.rows_affected() == 0 {
            return Err(AbacError::NotFound("User role assignment not found".to_string()));
        }
        Ok(())
    }

    // ==================== PERMISSIONS ====================

    pub async fn get_role_permissions(&self, role_id: &str) -> Result<Vec<Permission>, AbacError> {
        let role_uuid = Uuid::parse_str(role_id).map_err(|e| AbacError::InvalidInput(e.to_string()))?;
        let permissions = sqlx::query_as::<_, Permission>(
            "SELECT id, role_id, action, created_at FROM permissions WHERE role_id = $1"
        )
            .bind(role_uuid)
            .fetch_all(&self.pool)
            .await?;
        Ok(permissions)
    }

    pub async fn add_permission(&self, role_id: &str, action: &str) -> Result<Permission, AbacError> {
        let role_uuid = Uuid::parse_str(role_id).map_err(|e| AbacError::InvalidInput(e.to_string()))?;
        let permission = sqlx::query_as::<_, Permission>(
            "INSERT INTO permissions (role_id, action) VALUES ($1, $2) RETURNING id, role_id, action, created_at"
        )
            .bind(role_uuid)
            .bind(action)
            .fetch_one(&self.pool)
            .await?;
        Ok(permission)
    }

    pub async fn remove_permission(&self, permission_id: &str) -> Result<(), AbacError> {
        let perm_uuid = Uuid::parse_str(permission_id).map_err(|e| AbacError::InvalidInput(e.to_string()))?;
        let result = sqlx::query("DELETE FROM permissions WHERE id = $1")
            .bind(perm_uuid)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AbacError::NotFound("Permission not found".to_string()));
        }
        Ok(())
    }

    /// Check if a user has a specific permission for a resource
    /// Delegates to the new integrated ReBAC/Policy engine
    /// Now supports optional tenant_id and field_name for Phase 2c
    pub async fn check_permission(
        &self, 
        user_id: &str, 
        action: &str, 
        resource_id: Option<&str>,
        tenant_id: Option<Uuid>,
        field_name: Option<&str>
    ) -> Result<bool, AbacError> {
        let user_uuid = Uuid::parse_str(user_id).map_err(|e| AbacError::InvalidInput(e.to_string()))?;
        
        let resource_uuid = if let Some(rid) = resource_id {
            Some(Uuid::parse_str(rid).map_err(|e| AbacError::InvalidInput(e.to_string()))?)
        } else {
            None
        };

        match resource_uuid {
            Some(entity_id) => {
                // Entity-level check: use full integrated ReBAC + Cron + Policies
                // Propagate tenant_id and field_name to the integrated checker
                self.rebac_service.check_permission_integrated(user_uuid, entity_id, action, tenant_id, field_name).await
                    .map_err(|e| AbacError::DatabaseError(e.to_string()))
            },
            None => {
                // Global check: fallback to legacy SQL for now
                // Note: We're not using tenant/field context for global checks yet
                let has_permission = sqlx::query_scalar::<_, bool>(
                    r#"
                    SELECT EXISTS (
                        SELECT 1 
                        FROM user_roles ur
                        JOIN permissions p ON ur.role_id = p.role_id
                        WHERE ur.user_id = $1
                          AND (p.action = $2 OR p.action = '*')
                          AND ur.resource_id IS NULL
                    )
                    "#
                )
                    .bind(user_uuid)
                    .bind(action)
                    .fetch_one(&self.pool)
                    .await?;
                
                Ok(has_permission)
            }
        }
    }
}
