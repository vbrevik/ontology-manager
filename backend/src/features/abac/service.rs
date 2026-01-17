use super::models::{
    AssignRoleInput, CreateResourceInput, Permission, Resource, Role, UserRole, UserRoleAssignment,
};
use chrono::Utc;
use sqlx::{Pool, Postgres};
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

use crate::features::ontology::OntologyService;
use crate::features::rebac::RebacService;

#[derive(Clone)]
pub struct AbacService {
    pool: Pool<Postgres>,
    rebac_service: RebacService,
    ontology_service: OntologyService,
}

impl AbacService {
    pub fn new(
        pool: Pool<Postgres>,
        rebac_service: RebacService,
        ontology_service: OntologyService,
    ) -> Self {
        Self {
            pool,
            rebac_service,
            ontology_service,
        }
    }

    // ==================== ROLES ====================

    pub async fn list_roles(&self) -> Result<Vec<Role>, AbacError> {
        let class = self
            .ontology_service
            .get_system_class("Role")
            .await
            .map_err(|e| AbacError::DatabaseError(e.to_string()))?;

        let entities = self
            .ontology_service
            .list_entities(Some(class.id), None, None)
            .await
            .map_err(|e| AbacError::DatabaseError(e.to_string()))?;

        let roles = entities
            .into_iter()
            .map(|e| Role {
                id: e.id,
                name: e.display_name,
                description: e
                    .attributes
                    .get("description")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                level: e
                    .attributes
                    .get("level")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32,
                tenant_id: e.tenant_id,
                created_at: e.created_at,
            })
            .collect();

        Ok(roles)
    }

    pub async fn get_role_by_name(&self, name: &str) -> Result<Role, AbacError> {
        let class = self
            .ontology_service
            .get_system_class("Role")
            .await
            .map_err(|e| AbacError::DatabaseError(e.to_string()))?;

        let entity = sqlx::query_as::<_, crate::features::ontology::models::Entity>(
            "SELECT * FROM entities WHERE display_name = $1 AND class_id = $2",
        )
        .bind(name)
        .bind(class.id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AbacError::NotFound(format!("Role '{}' not found", name)))?;

        Ok(Role {
            id: entity.id,
            name: entity.display_name,
            description: entity
                .attributes
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            level: entity
                .attributes
                .get("level")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
            tenant_id: entity.tenant_id,
            created_at: entity.created_at,
        })
    }

    pub async fn create_role(
        &self,
        name: &str,
        description: Option<&str>,
    ) -> Result<Role, AbacError> {
        let class = self
            .ontology_service
            .get_system_class("Role")
            .await
            .map_err(|e| AbacError::DatabaseError(e.to_string()))?;

        let entity_input = crate::features::ontology::models::CreateEntityInput {
            class_id: class.id,
            display_name: name.to_string(),
            parent_entity_id: None,
            attributes: Some(serde_json::json!({
                "name": name,
                "description": description,
                "level": 0
            })),
        };

        let entity = self
            .ontology_service
            .create_entity(entity_input, None, None)
            .await
            .map_err(|e| AbacError::DatabaseError(e.to_string()))?;

        Ok(Role {
            id: entity.id,
            name: entity.display_name,
            description: entity
                .attributes
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            level: entity
                .attributes
                .get("level")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32,
            tenant_id: entity.tenant_id,
            created_at: entity.created_at,
        })
    }

    // ==================== RESOURCES ====================

    pub async fn list_resources(&self) -> Result<Vec<Resource>, AbacError> {
        let resources = sqlx::query_as::<_, Resource>(
            "SELECT id, name, resource_type, created_at FROM resources ORDER BY name",
        )
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

    pub async fn get_user_roles(
        &self,
        user_id: &str,
    ) -> Result<Vec<UserRoleAssignment>, AbacError> {
        let user_uuid =
            Uuid::parse_str(user_id).map_err(|e| AbacError::InvalidInput(e.to_string()))?;

        let assignments = self
            .rebac_service
            .list_user_scoped_roles(user_uuid)
            .await
            .map_err(|e| AbacError::DatabaseError(e.to_string()))?;

        let results = assignments
            .into_iter()
            .map(|a| UserRoleAssignment {
                id: a.id,
                user_id: a.user_id,
                role_name: a.role_name,
                resource_id: a.scope_entity_id,
                resource_name: a.scope_entity_name,
            })
            .collect();

        Ok(results)
    }

    pub async fn assign_role(
        &self,
        input: AssignRoleInput,
        granter_id: Option<Uuid>,
    ) -> Result<UserRole, AbacError> {
        // Find the role by name
        let role = self.get_role_by_name(&input.role_name).await?;

        let user_uuid =
            Uuid::parse_str(&input.user_id).map_err(|e| AbacError::InvalidInput(e.to_string()))?;
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
        self.rebac_service
            .assign_scoped_role(scoped_input, granter_id)
            .await
            .map_err(|e| match e {
                crate::features::rebac::service::RebacError::PermissionDenied(msg) => {
                    AbacError::InvalidInput(msg)
                }
                crate::features::rebac::service::RebacError::NotFound(msg) => {
                    AbacError::NotFound(msg)
                }
                _ => AbacError::DatabaseError(e.to_string()),
            })?;

        // In the unified model, we don't insert into user_roles separately.
        // We return a mock/placeholder UserRole for compatibility if needed,
        // but it's better to just return the one from assign_scoped_role.
        // However, the return type matches the legacy UserRole which is problematic.
        // Let's re-fetch the relationship as a UserRole.

        let assignments = self.get_user_roles(user_uuid.to_string().as_str()).await?;
        let user_role = assignments
            .into_iter()
            .next()
            .ok_or_else(|| AbacError::DatabaseError("Failed to fetch assigned role".to_string()))?;

        // This is a bit hacky because UserRole is different from UserRoleAssignment.
        // I'll just return a new UserRole struct.
        Ok(UserRole {
            id: user_role.id,
            user_id: user_role.user_id,
            role_id: role.id,
            resource_id: user_role.resource_id,
            created_at: Utc::now(),
        })
    }

    pub async fn remove_role(&self, user_role_id: &str) -> Result<(), AbacError> {
        let ur_uuid =
            Uuid::parse_str(user_role_id).map_err(|e| AbacError::InvalidInput(e.to_string()))?;
        self.rebac_service
            .revoke_scoped_role(ur_uuid, None, None)
            .await
            .map_err(|e| AbacError::DatabaseError(e.to_string()))
    }

    // ==================== PERMISSIONS ====================

    pub async fn get_role_permissions(&self, role_id: &str) -> Result<Vec<Permission>, AbacError> {
        let role_uuid =
            Uuid::parse_str(role_id).map_err(|e| AbacError::InvalidInput(e.to_string()))?;

        // Find relationship type for grants_permission
        let rel_types = self
            .rebac_service
            .list_relationship_types()
            .await
            .map_err(|e| AbacError::DatabaseError(e.to_string()))?;
        let rel_type = rel_types
            .into_iter()
            .find(|t| t.name == "grants_permission")
            .ok_or_else(|| {
                AbacError::DatabaseError(
                    "Relationship type 'grants_permission' not found".to_string(),
                )
            })?;

        let rels = sqlx::query_as::<_, crate::features::ontology::models::Relationship>(
            "SELECT * FROM relationships WHERE source_entity_id = $1 AND relationship_type_id = $2",
        )
        .bind(role_uuid)
        .bind(rel_type.id)
        .fetch_all(&self.pool)
        .await?;

        let mut results = Vec::new();
        for rel in rels {
            let perm_entity = self
                .ontology_service
                .get_entity(rel.target_entity_id)
                .await
                .map_err(|e| AbacError::DatabaseError(e.to_string()))?;

            results.push(Permission {
                id: rel.id,
                role_id: role_uuid,
                action: perm_entity.display_name,
                created_at: rel.created_at,
            });
        }

        Ok(results)
    }

    pub async fn add_permission(
        &self,
        role_id: &str,
        action: &str,
    ) -> Result<Permission, AbacError> {
        let role_uuid =
            Uuid::parse_str(role_id).map_err(|e| AbacError::InvalidInput(e.to_string()))?;
        self.rebac_service
            .add_permission_to_role(role_uuid, action, None)
            .await
            .map_err(|e| AbacError::DatabaseError(e.to_string()))?;

        let permissions = self.get_role_permissions(role_id).await?;
        permissions
            .into_iter()
            .find(|p| p.action == action)
            .ok_or_else(|| {
                AbacError::DatabaseError("Failed to verify added permission".to_string())
            })
    }

    pub async fn remove_permission(&self, permission_id: &str) -> Result<(), AbacError> {
        let perm_uuid =
            Uuid::parse_str(permission_id).map_err(|e| AbacError::InvalidInput(e.to_string()))?;

        let rel = sqlx::query_as::<_, crate::features::ontology::models::Relationship>(
            "SELECT * FROM relationships WHERE id = $1",
        )
        .bind(perm_uuid)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AbacError::NotFound("Permission mapping not found".to_string()))?;

        let perm_entity = self
            .ontology_service
            .get_entity(rel.target_entity_id)
            .await
            .map_err(|e| AbacError::DatabaseError(e.to_string()))?;

        self.rebac_service
            .remove_permission_from_role(rel.source_entity_id, &perm_entity.display_name)
            .await
            .map_err(|e| AbacError::DatabaseError(e.to_string()))
    }

    /// Check if a user has a specific permission for a resource
    /// Delegates to the new integrated ReBAC/Policy engine
    /// Now supports optional tenant_id and field_name for Phase 2c
    pub async fn check_permission(
        &self,
        user_uuid: Uuid,
        action: &str,
        resource_id: Option<Uuid>,
        tenant_id: Option<Uuid>,
        field_name: Option<&str>,
    ) -> Result<bool, AbacError> {
        // 0. Firefighter Mode Check (Break-glass bypass)
        if self
            .rebac_service
            .has_firefighter_active(user_uuid)
            .await
            .map_err(|e| AbacError::DatabaseError(e.to_string()))?
        {
            tracing::info!(
                "Firefighter mode active for user {}, granting global ABAC access for '{}'",
                user_uuid,
                action
            );

            // Log the bypass
            let _ = self
                .rebac_service
                .audit_service
                .log(
                    user_uuid,
                    &format!("firefighter.abac.{}", action),
                    "global",
                    resource_id,
                    None,
                    None,
                    Some(serde_json::json!({
                        "permission": action,
                        "resource_id": resource_id,
                        "is_break_glass": true
                    })),
                )
                .await;

            return Ok(true);
        }

        match resource_id {
            Some(entity_id) => {
                // Entity-level check: use full integrated ReBAC + Cron + Policies
                // Propagate tenant_id and field_name to the integrated checker
                self.rebac_service
                    .check_permission_integrated(
                        user_uuid, entity_id, action, tenant_id, field_name, None,
                    )
                    .await
                    .map_err(|e| AbacError::DatabaseError(e.to_string()))
            }
            None => {
                // Global check: use ontology relationships instead of legacy tables

                // Get relationship type IDs
                let has_role_type_id = sqlx::query_scalar::<_, Uuid>(
                    "SELECT id FROM relationship_types WHERE name = 'has_role' LIMIT 1",
                )
                .fetch_one(&self.pool)
                .await?;

                let grants_perm_type_id = sqlx::query_scalar::<_, Uuid>(
                    "SELECT id FROM relationship_types WHERE name = 'grants_permission' LIMIT 1",
                )
                .fetch_one(&self.pool)
                .await?;

                // Query: User -> Role -> Permission through ontology relationships
                let has_permission = sqlx::query_scalar::<_, bool>(
                    r#"
                    SELECT EXISTS (
                        SELECT 1
                        FROM relationships user_role
                        JOIN relationships role_perm ON role_perm.source_entity_id = user_role.target_entity_id
                        JOIN entities perm_entity ON perm_entity.id = role_perm.target_entity_id
                        WHERE user_role.source_entity_id = $1
                          AND user_role.relationship_type_id = $2
                          AND user_role.metadata->>'scope_entity_id' IS NULL  -- Global roles only
                          AND role_perm.relationship_type_id = $3
                          AND (perm_entity.display_name = $4 OR perm_entity.display_name = '*')
                    )
                    "#
                )
                .bind(user_uuid)
                .bind(has_role_type_id)
                .bind(grants_perm_type_id)
                .bind(action)
                .fetch_one(&self.pool)
                .await?;

                Ok(has_permission)
            }
        }
    }
}
