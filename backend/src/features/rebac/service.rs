use sqlx::{Pool, Postgres, Row};
use uuid::Uuid;
use chrono::Utc;
use serde_json;
use moka::future::Cache;
use std::time::Duration;
use super::models::*;

#[derive(Debug)]
pub enum RebacError {
    DatabaseError(String),
    NotFound(String),
    InvalidInput(String),
    PermissionDenied(String),
}

impl std::fmt::Display for RebacError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            Self::NotFound(msg) => write!(f, "Not found: {}", msg),
            Self::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            Self::PermissionDenied(msg) => write!(f, "Permission denied: {}", msg),
        }
    }
}

impl From<sqlx::Error> for RebacError {
    fn from(err: sqlx::Error) -> Self {
        RebacError::DatabaseError(err.to_string())
    }
}

use super::policy_service::PolicyService;
use super::policy_models::{EvaluationContext, PolicyResult};

#[derive(Clone)]
pub struct RebacService {
    pub pool: Pool<Postgres>,
    #[allow(dead_code)]
    policy_service: PolicyService,
    // Cache for (user_id, entity_id, permission, tenant_id) -> PermissionCheckResult
    permission_cache: Cache<(Uuid, Uuid, String, Option<Uuid>), PermissionCheckResult>,
}

impl RebacService {
    pub fn new(pool: Pool<Postgres>) -> Self {
        let policy_service = PolicyService::new(pool.clone());
        let permission_cache = Cache::builder()
            .max_capacity(10_000)
            .time_to_live(Duration::from_secs(30)) // Short TTL for security
            .build();
            
        Self { 
            pool, 
            policy_service,
            permission_cache 
        }
    }

    // ========================================================================
    // PERMISSION TYPES
    // ========================================================================

    pub async fn list_permission_types(&self) -> Result<Vec<PermissionType>, RebacError> {
        let types = sqlx::query_as::<_, PermissionType>(
            "SELECT * FROM permission_types ORDER BY level"
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(types)
    }

    pub async fn create_permission_type(&self, input: CreatePermissionTypeInput) -> Result<PermissionType, RebacError> {
        let pt = sqlx::query_as::<_, PermissionType>(
            "INSERT INTO permission_types (name, description, level) VALUES ($1, $2, $3) RETURNING *"
        )
        .bind(input.name)
        .bind(input.description)
        .bind(input.level)
        .fetch_one(&self.pool)
        .await?;
        Ok(pt)
    }

    pub async fn update_permission_type(&self, id: Uuid, input: UpdatePermissionTypeInput) -> Result<PermissionType, RebacError> {
        let pt = sqlx::query_as::<_, PermissionType>(
            r#"
            UPDATE permission_types 
            SET description = COALESCE($2, description),
                level = COALESCE($3, level)
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(id)
        .bind(input.description)
        .bind(input.level)
        .fetch_one(&self.pool)
        .await?;
        Ok(pt)
    }

    pub async fn delete_permission_type(&self, id: Uuid) -> Result<(), RebacError> {
        sqlx::query("DELETE FROM permission_types WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ========================================================================
    // RELATIONSHIP TYPES
    // ========================================================================

    pub async fn list_relationship_types(&self) -> Result<Vec<RelationshipType>, RebacError> {
        let types = sqlx::query_as::<_, RelationshipType>(
            "SELECT * FROM relationship_types ORDER BY name"
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(types)
    }

    pub async fn create_relationship_type(&self, input: CreateRelationshipTypeInput) -> Result<RelationshipType, RebacError> {
        let rt = sqlx::query_as::<_, RelationshipType>(
            "INSERT INTO relationship_types (name, description, grants_permission_inheritance) VALUES ($1, $2, $3) RETURNING *"
        )
        .bind(input.name)
        .bind(input.description)
        .bind(input.grants_permission_inheritance)
        .fetch_one(&self.pool)
        .await?;
        Ok(rt)
    }

    pub async fn update_relationship_type(&self, id: Uuid, input: UpdateRelationshipTypeInput) -> Result<RelationshipType, RebacError> {
        let rt = sqlx::query_as::<_, RelationshipType>(
            r#"
            UPDATE relationship_types 
            SET description = COALESCE($2, description),
                grants_permission_inheritance = COALESCE($3, grants_permission_inheritance)
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(id)
        .bind(input.description)
        .bind(input.grants_permission_inheritance)
        .fetch_one(&self.pool)
        .await?;
        Ok(rt)
    }

    pub async fn delete_relationship_type(&self, id: Uuid) -> Result<(), RebacError> {
        sqlx::query("DELETE FROM relationship_types WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ========================================================================
    // ROLE HIERARCHY & DELEGATION RULES
    // ========================================================================

    pub async fn list_roles(&self, tenant_id: Option<Uuid>) -> Result<Vec<crate::features::abac::models::Role>, RebacError> {
        let roles = sqlx::query_as::<_, crate::features::abac::models::Role>(
            "SELECT * FROM roles WHERE ($1::uuid IS NULL OR tenant_id = $1) ORDER BY level DESC, name"
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(roles)
    }

    pub async fn update_role_level(&self, role_id: Uuid, level: i32) -> Result<(), RebacError> {
        sqlx::query("UPDATE roles SET level = $2 WHERE id = $1")
            .bind(role_id)
            .bind(level)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn list_delegation_rules(&self, tenant_id: Option<Uuid>) -> Result<Vec<crate::features::abac::models::RoleDelegationRule>, RebacError> {
        let rules = sqlx::query_as::<_, crate::features::abac::models::RoleDelegationRule>(
            "SELECT * FROM role_delegation_rules WHERE ($1::uuid IS NULL OR tenant_id = $1)"
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rules)
    }

    pub async fn add_delegation_rule(
        &self, 
        granter_role_id: Uuid, 
        grantee_role_id: Uuid,
        can_grant: bool,
        can_modify: bool,
        can_revoke: bool,
        tenant_id: Option<Uuid>
    ) -> Result<crate::features::abac::models::RoleDelegationRule, RebacError> {
        let rule = sqlx::query_as::<_, crate::features::abac::models::RoleDelegationRule>(
            r#"
            INSERT INTO role_delegation_rules 
                (granter_role_id, grantee_role_id, can_grant, can_modify, can_revoke, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (granter_role_id, grantee_role_id, tenant_id) 
            DO UPDATE SET 
                can_grant = EXCLUDED.can_grant,
                can_modify = EXCLUDED.can_modify,
                can_revoke = EXCLUDED.can_revoke
            RETURNING *
            "#
        )
        .bind(granter_role_id)
        .bind(grantee_role_id)
        .bind(can_grant)
        .bind(can_modify)
        .bind(can_revoke)
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await?;
        Ok(rule)
    }

    pub async fn remove_delegation_rule(&self, rule_id: Uuid) -> Result<(), RebacError> {
        sqlx::query("DELETE FROM role_delegation_rules WHERE id = $1")
            .bind(rule_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ========================================================================
    // ROLE PERMISSIONS
    // ========================================================================

    pub async fn get_role_permissions(&self, role_id: Uuid) -> Result<Vec<String>, RebacError> {
        let perms = sqlx::query_scalar::<_, String>(
            r#"
            SELECT pt.name
            FROM role_permission_types rpt
            JOIN permission_types pt ON rpt.permission_type_id = pt.id
            WHERE rpt.role_id = $1
            ORDER BY pt.level
            "#
        )
        .bind(role_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(perms)
    }

    pub async fn get_role_permission_mappings(&self, role_id: Uuid) -> Result<Vec<RolePermissionType>, RebacError> {
        let mappings = sqlx::query_as::<_, RolePermissionType>(
            r#"
            SELECT * FROM role_permission_types WHERE role_id = $1
            "#
        )
        .bind(role_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(mappings)
    }

    pub async fn add_permission_to_role(&self, role_id: Uuid, permission_name: &str, field_name: Option<String>) -> Result<(), RebacError> {
        sqlx::query(
            r#"
            INSERT INTO role_permission_types (role_id, permission_type_id, field_name)
            SELECT $1, id, $3 FROM permission_types WHERE name = $2
            ON CONFLICT (role_id, permission_type_id) DO UPDATE SET field_name = EXCLUDED.field_name
            "#
        )
        .bind(role_id)
        .bind(permission_name)
        .bind(field_name)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn remove_permission_from_role(&self, role_id: Uuid, permission_name: &str) -> Result<(), RebacError> {
        sqlx::query(
            r#"
            DELETE FROM role_permission_types 
            WHERE role_id = $1 
              AND permission_type_id = (SELECT id FROM permission_types WHERE name = $2)
            "#
        )
        .bind(role_id)
        .bind(permission_name)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    // ========================================================================
    // SCOPED USER ROLES
    // ========================================================================

    pub async fn list_user_scoped_roles(&self, user_id: Uuid) -> Result<Vec<ScopedUserRoleWithDetails>, RebacError> {
        let roles = sqlx::query_as::<_, ScopedUserRoleWithDetails>(
            r#"
            SELECT sur.id, sur.user_id, sur.role_id, r.name as role_name,
                   sur.scope_entity_id, e.display_name as scope_entity_name,
                   sur.valid_from, sur.valid_until, sur.schedule_cron,
                   sur.is_deny, sur.granted_at
            FROM scoped_user_roles sur
            JOIN roles r ON sur.role_id = r.id
            LEFT JOIN entities e ON sur.scope_entity_id = e.id
            WHERE sur.user_id = $1 AND sur.revoked_at IS NULL
            ORDER BY sur.granted_at DESC
            "#
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(roles)
    }

    /// Assign a scoped role to a user
    /// Updated for Phase 2d: Added delegation guard with granular rules
    pub async fn assign_scoped_role(
        &self, 
        input: AssignScopedRoleInput, 
        granted_by: Option<Uuid>
    ) -> Result<ScopedUserRole, RebacError> {
        // Find role by name
        let role_id: Uuid = sqlx::query_scalar("SELECT id FROM roles WHERE name = $1")
            .bind(&input.role_name)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| RebacError::NotFound(format!("Role '{}' not found", input.role_name)))?;

        // Enforce delegation guard if granted_by is provided
        if let Some(granter_id) = granted_by {
            // 1. Check if granter has 'delegate' permission on the scope
            let has_delegate_perm = if let Some(scope_id) = input.scope_entity_id {
                self.has_permission(granter_id, scope_id, "delegate", None).await?
            } else {
                // Global delegation check
                sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS (
                        SELECT 1 FROM scoped_user_roles sur
                        JOIN role_permission_types rpt ON sur.role_id = rpt.role_id
                        JOIN permission_types pt ON rpt.permission_type_id = pt.id
                        WHERE sur.user_id = $1 AND pt.name = 'delegate' AND sur.scope_entity_id IS NULL AND sur.revoked_at IS NULL
                    )"
                )
                .bind(granter_id)
                .fetch_one(&self.pool)
                .await?
            };

            if !has_delegate_perm {
                return Err(RebacError::PermissionDenied("You do not have 'delegate' permission to grant roles in this scope".to_string()));
            }

            // 2. Check granular delegation rules: Does one of granter's roles allow granting the target role?
            let can_grant = sqlx::query_scalar::<_, bool>(
                r#"
                SELECT EXISTS (
                    SELECT 1 FROM role_delegation_rules rdr
                    JOIN scoped_user_roles sur ON sur.role_id = rdr.granter_role_id
                    WHERE sur.user_id = $1 
                      AND rdr.grantee_role_id = $2
                      AND rdr.can_grant = true
                      AND sur.revoked_at IS NULL
                      AND (sur.scope_entity_id IS NULL OR sur.scope_entity_id = $3)
                ) OR EXISTS (
                    -- Fallback: Superadmins can grant anything if their level is high enough
                    SELECT 1 FROM roles r_granter
                    JOIN scoped_user_roles sur ON sur.role_id = r_granter.id
                    JOIN roles r_grantee ON r_grantee.id = $2
                    WHERE sur.user_id = $1
                      AND (r_granter.name = 'superadmin' OR r_granter.level > r_grantee.level)
                      AND sur.revoked_at IS NULL
                )"#
            )
            .bind(granter_id)
            .bind(role_id)
            .bind(input.scope_entity_id)
            .fetch_one(&self.pool)
            .await?;

            if !can_grant {
                return Err(RebacError::PermissionDenied(format!("Your roles do not permit granting the '{}' role", input.role_name)));
            }
        }

        let role = sqlx::query_as::<_, ScopedUserRole>(
            r#"
            INSERT INTO scoped_user_roles 
                (user_id, role_id, scope_entity_id, valid_from, valid_until, 
                 schedule_cron, is_deny, granted_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#
        )
        .bind(input.user_id)
        .bind(role_id)
        .bind(input.scope_entity_id)
        .bind(input.valid_from)
        .bind(input.valid_until)
        .bind(&input.schedule_cron)
        .bind(input.is_deny.unwrap_or(false))
        .bind(granted_by)
        .fetch_one(&self.pool)
        .await?;

        Ok(role)
    }

    pub async fn revoke_scoped_role(&self, role_assignment_id: Uuid, revoked_by: Option<Uuid>, reason: Option<String>) -> Result<(), RebacError> {
        let result = sqlx::query(
            r#"
            UPDATE scoped_user_roles 
            SET revoked_at = NOW(), revoked_by = $2, revoke_reason = $3
            WHERE id = $1 AND revoked_at IS NULL
            "#
        )
        .bind(role_assignment_id)
        .bind(revoked_by)
        .bind(reason)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(RebacError::NotFound("Role assignment not found or already revoked".to_string()));
        }
        Ok(())
    }

    // ========================================================================
    // PERMISSION CHECKS (Core ReBAC Logic)
    // ========================================================================

    /// Check if a user has a specific permission on an entity
    /// Uses the database function which handles:
    /// - Graph traversal (inheritance from parent entities)
    /// - DENY overrides ALLOW
    /// - Temporal checks (valid_from/valid_until)
    /// - Multi-tenancy isolation
    /// - Hierarchy levels
    /// Check a single permission via the database function
    /// Updated for Phase 2c/2d: Added tenant_id, field_name support and caching
    pub async fn check_permission(
        &self, 
        user_id: Uuid, 
        entity_id: Uuid, 
        permission: &str,
        tenant_id: Option<Uuid>,
        field_name: Option<&str>
    ) -> Result<PermissionCheckResult, RebacError> {
        // If field_name is NOT provided, we can use the cache (field checks are too granular for this cache key)
        if field_name.is_none() {
            let cache_key = (user_id, entity_id, permission.to_string(), tenant_id);
            if let Some(cached) = self.permission_cache.get(&cache_key).await {
                return Ok(cached);
            }

            // Standard entity-level check
            let result = sqlx::query_as::<_, PermissionCheckResult>(
                "SELECT * FROM check_entity_permission($1, $2, $3, $4)"
            )
            .bind(user_id)
            .bind(entity_id)
            .bind(permission)
            .bind(tenant_id)
            .fetch_one(&self.pool)
            .await?;

            self.permission_cache.insert(cache_key, result.clone()).await;
            return Ok(result);
        }

        // If field_name is provided, use the specialized field check (no cache for now)
        let field = field_name.unwrap();
        let has_field_perm = sqlx::query_scalar::<_, bool>(
            "SELECT check_field_permission($1, $2, $3, $4, $5)"
        )
        .bind(user_id)
        .bind(entity_id)
        .bind(field)
        .bind(permission)
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(PermissionCheckResult {
            has_permission: Some(has_field_perm),
            granted_via_entity_id: None,
            granted_via_role: None,
            is_inherited: None,
            is_denied: None,
        })
    }

    /// Check permission and return a simple boolean
    pub async fn has_permission(&self, user_id: Uuid, entity_id: Uuid, permission: &str, tenant_id: Option<Uuid>) -> Result<bool, RebacError> {
        let result = self.check_permission(user_id, entity_id, permission, tenant_id, None).await?;
        Ok(result.has_permission.unwrap_or(false))
    }

    /// Requires a permission - returns error if denied
    pub async fn require_permission(
        &self, 
        user_id: Uuid, 
        entity_id: Uuid, 
        permission: &str,
        tenant_id: Option<Uuid>,
        field_name: Option<&str>
    ) -> Result<(), RebacError> {
        let result = self.check_permission(user_id, entity_id, permission, tenant_id, field_name).await?;
        
        if !result.has_permission.unwrap_or(false) {
            let reason = if result.is_denied.unwrap_or(false) {
                "Access explicitly denied"
            } else {
                "No permission granted"
            };
            return Err(RebacError::PermissionDenied(reason.to_string()));
        }
        Ok(())
    }

    /// Check permissions for multiple entities at once (Phase 2d)
    pub async fn check_multiple_permissions(
        &self,
        user_id: Uuid,
        entity_ids: Vec<Uuid>,
        permission: &str,
        tenant_id: Option<Uuid>,
    ) -> Result<Vec<(Uuid, bool, bool)>, RebacError> {
        let results = sqlx::query_as::<_, (Uuid, bool, bool)>(
            "SELECT entity_id, has_permission, is_denied FROM check_multiple_entities_permission($1, $2, $3, $4)"
        )
        .bind(user_id)
        .bind(&entity_ids)
        .bind(permission)
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await?;
        
        Ok(results)
    }

    /// Get all permissions a user has on an entity
    pub async fn get_user_entity_permissions(&self, user_id: Uuid, entity_id: Uuid) -> Result<Vec<EntityPermission>, RebacError> {
        let perms = sqlx::query_as::<_, EntityPermission>(
            "SELECT * FROM get_user_entity_permissions($1, $2)"
        )
        .bind(user_id)
        .bind(entity_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(perms)
    }

    /// INTEGRATED PERMISSION CHECK (Phase 2b Goal)
    /// Combines ReBAC, Cron Schedules, and Dynamic Policies
    pub async fn check_permission_integrated(
        &self, 
        user_id: Uuid, 
        entity_id: Uuid, 
        permission: &str,
        tenant_id: Option<Uuid>,
        field_name: Option<&str>
    ) -> Result<bool, RebacError> {
        // 1. Base ReBAC check (Database function)
        // Handles graph traversal, role assignments, levels, and multitenancy
        let rebac_result = self.check_permission(user_id, entity_id, permission, tenant_id, field_name).await?;
        let mut final_has_permission = rebac_result.has_permission.unwrap_or(false);
        let is_rebac_denied = rebac_result.is_denied.unwrap_or(false);

        // 2. Cron Schedule Check (Rust logic)
        // If rebac says ALLOW, we must ensure at least one granting role is currently active via cron
        if final_has_permission && !is_rebac_denied {
            // Find all roles that grant this permission
            let active_roles = self.get_active_grant_roles(user_id, entity_id, permission, tenant_id).await?;
            
            // If none of the granting roles satisfy their cron schedule, we deny
            if !active_roles.iter().any(|r| Self::is_role_active(r)) {
                tracing::debug!("Permission check failed cron schedule validation");
                final_has_permission = false;
            }
        }

        // 3. Dynamic Policy Engine (ABAC)
        // Build context and evaluate policies
        let context = self.build_evaluation_context(user_id, entity_id, permission).await?;
        
        // Fetch applicable policies (matches permission + entity class)
        let entity_class_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT class_id FROM entities WHERE id = $1"
        )
        .bind(entity_id)
        .fetch_one(&self.pool).await?;
            
        let policies = self.policy_service.get_applicable_policies(
            entity_id, 
            permission, 
            Some(entity_class_id)
        ).await.map_err(|e| RebacError::DatabaseError(e.to_string()))?;

        let policy_decision = self.policy_service.evaluate_policies(&policies, &context);
        
        let final_result = match policy_decision {
            PolicyResult::Denied { .. } => false,
            PolicyResult::Allowed { .. } => true, // Explicit policy allow overrides ReBAC (if not denied)
            PolicyResult::NoMatch => final_has_permission && !is_rebac_denied,
        };

        // 4. Audit Logging
        let _ = self.policy_service.log_evaluation(
            user_id, 
            entity_id, 
            permission, 
            final_has_permission, 
            &policy_decision, 
            final_result, 
            &context
        ).await;

        Ok(final_result)
    }

    /// Helper to find all role assignments that could grant a permission to a user on an entity
    async fn get_active_grant_roles(&self, user_id: Uuid, entity_id: Uuid, permission: &str, tenant_id: Option<Uuid>) -> Result<Vec<ScopedUserRole>, RebacError> {
        // This query mimics the check_entity_permission recursion to find applicable roles
        let roles = sqlx::query_as::<_, ScopedUserRole>(
            r#"
            WITH RECURSIVE graph_path AS (
                SELECT id FROM entities WHERE id = $1 AND deleted_at IS NULL AND ($4::uuid IS NULL OR tenant_id = $4)
                UNION ALL
                SELECT e.id FROM graph_path gp 
                JOIN entities e ON e.id = (SELECT parent_entity_id FROM entities WHERE id = gp.id) 
                WHERE e.deleted_at IS NULL AND ($4::uuid IS NULL OR e.tenant_id = $4)
            )
            SELECT sur.* FROM scoped_user_roles sur
            JOIN role_permission_types rpt ON sur.role_id = rpt.role_id
            JOIN permission_types pt ON rpt.permission_type_id = pt.id
            WHERE sur.user_id = $2
              AND sur.revoked_at IS NULL
              AND (sur.scope_entity_id IS NULL OR sur.scope_entity_id IN (SELECT id FROM graph_path))
              AND (pt.name = $3 OR pt.level >= (SELECT level FROM permission_types WHERE name = $3) OR pt.name = 'admin')
            "#
        )
        .bind(entity_id)
        .bind(user_id)
        .bind(permission)
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(roles)
    }

    /// Helper to build EvaluationContext with entity/user attributes
    async fn build_evaluation_context(&self, user_id: Uuid, entity_id: Uuid, permission: &str) -> Result<EvaluationContext, RebacError> {

        // Fetch entity attributes
        let entity_row = sqlx::query(
            "SELECT display_name, attributes FROM entities WHERE id = $1",
        )
        .bind(entity_id)
        .fetch_one(&self.pool).await?;
        
        let display_name: String = entity_row.get(0);
        let attributes: serde_json::Value = entity_row.get(1);

        // Fetch user data
        let email: String = sqlx::query_scalar(
            "SELECT email FROM users WHERE id = $1",
        )
        .bind(user_id)
        .fetch_one(&self.pool).await?;

        let mut context = EvaluationContext::new();

        // 1. Entity attributes
        if let Some(obj) = attributes.as_object() {
            for (k, v) in obj {
                context.entity.insert(k.clone(), v.clone());
            }
        }
        context.entity.insert("id".to_string(), serde_json::Value::String(entity_id.to_string()));
        context.entity.insert("display_name".to_string(), serde_json::Value::String(display_name));

        // 2. User attributes
        context.user.insert("id".to_string(), serde_json::Value::String(user_id.to_string()));
        context.user.insert("email".to_string(), serde_json::Value::String(email));
        // TODO: Join with a user_attributes table if we add one

        // 3. Environment attributes
        context.env.insert("now".to_string(), serde_json::Value::String(Utc::now().to_rfc3339()));
        
        // 4. Request attributes
        context.request.insert("permission".to_string(), serde_json::Value::String(permission.to_string()));

        Ok(context)
    }

    /// Get all entities a user can access with a specific permission
    pub async fn get_accessible_entities(&self, user_id: Uuid, permission: &str) -> Result<Vec<AccessibleEntity>, RebacError> {
        let entities = sqlx::query_as::<_, AccessibleEntity>(
            "SELECT * FROM get_accessible_entities($1, $2)"
        )
        .bind(user_id)
        .bind(permission)
        .fetch_all(&self.pool)
        .await?;
        Ok(entities)
    }

    // ========================================================================
    // TEMPORAL / CRON HELPERS
    // ========================================================================

    /// Validate a cron expression
    pub fn validate_cron(cron_expression: &str) -> Result<(), RebacError> {
        use std::str::FromStr;
        cron::Schedule::from_str(cron_expression)
            .map(|_| ())
            .map_err(|e| RebacError::InvalidInput(format!("Invalid cron expression: {}", e)))
    }

    /// Check if current time matches a cron schedule
    pub fn is_within_cron_schedule(cron_expression: &str) -> Result<bool, RebacError> {
        use std::str::FromStr;
        use chrono::{Duration, Utc};
        
        let schedule = cron::Schedule::from_str(cron_expression)
            .map_err(|e| RebacError::InvalidInput(format!("Invalid cron expression: {}", e)))?;
        
        let now = Utc::now();
        
        // Check if current time is within an active window
        // We consider the schedule "active" if the last occurrence was within 1 minute
        // or the next occurrence is within 1 minute
        if let Some(prev) = schedule.after(&(now - Duration::minutes(1))).next() {
            if prev <= now && (now - prev).num_seconds() < 60 {
                return Ok(true);
            }
        }
        
        // Alternative: check if we're between a "start" and potential "end" of a window
        // For business hours pattern, we need to check if NOW falls within the pattern
        // The cron library doesn't directly support "is now matching", so we approximate:
        // If the previous scheduled time is very recent (within 1 min), we're in the window
        let upcoming: Vec<_> = schedule.after(&(now - Duration::minutes(2))).take(2).collect();
        if !upcoming.is_empty() {
            // If there are occurrences in the last 2 minutes, consider it active
            for occurrence in &upcoming {
                if *occurrence <= now && (now - *occurrence).num_seconds() < 120 {
                    return Ok(true);
                }
            }
        }
        
        Ok(false)
    }

    /// Check if a role assignment is currently active (temporal check including cron)
    pub fn is_role_active(role: &ScopedUserRole) -> bool {
        let now = Utc::now();
        
        // Check if revoked
        if role.revoked_at.is_some() {
            return false;
        }
        
        // Check valid_from
        if let Some(valid_from) = role.valid_from {
            if now < valid_from {
                return false;
            }
        }
        
        // Check valid_until
        if let Some(valid_until) = role.valid_until {
            if now >= valid_until {
                return false;
            }
        }
        
        // Check schedule_cron for scheduled access windows
        if let Some(ref cron_expr) = role.schedule_cron {
            if !cron_expr.is_empty() {
                match Self::is_within_cron_schedule(cron_expr) {
                    Ok(is_active) => {
                        if !is_active {
                            return false;
                        }
                    }
                    Err(_) => {
                        // Invalid cron expression - treat as inactive for safety
                        return false;
                    }
                }
            }
        }
        
        true
    }

    /// Update the schedule_cron for an existing role assignment
    pub async fn update_role_schedule(&self, role_assignment_id: Uuid, schedule_cron: Option<String>) -> Result<ScopedUserRole, RebacError> {
        // Validate the cron expression first
        if let Some(ref expr) = schedule_cron {
            if !expr.is_empty() {
                Self::validate_cron(expr)?;
            }
        }

        let role = sqlx::query_as::<_, ScopedUserRole>(
            r#"
            UPDATE scoped_user_roles 
            SET schedule_cron = $2
            WHERE id = $1 AND revoked_at IS NULL
            RETURNING *
            "#
        )
        .bind(role_assignment_id)
        .bind(&schedule_cron)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| RebacError::NotFound("Role assignment not found or already revoked".to_string()))?;

        Ok(role)
    }

    /// Get common cron schedule presets
    pub fn get_schedule_presets() -> Vec<CronPreset> {
        vec![
            CronPreset {
                name: "Business Hours (Mon-Fri 9am-5pm)".to_string(),
                cron: "0 9-17 * * 1-5".to_string(),
                description: "Active during weekday business hours".to_string(),
            },
            CronPreset {
                name: "Weekends Only".to_string(),
                cron: "0 * * * 0,6".to_string(),
                description: "Active on Saturday and Sunday".to_string(),
            },
            CronPreset {
                name: "After Hours (6pm-8am)".to_string(),
                cron: "0 18-23,0-8 * * *".to_string(),
                description: "Active outside business hours".to_string(),
            },
            CronPreset {
                name: "Monthly First Week".to_string(),
                cron: "0 * 1-7 * *".to_string(),
                description: "Active during the first week of each month".to_string(),
            },
            CronPreset {
                name: "Quarterly Review (Last Day)".to_string(),
                cron: "0 * L 3,6,9,12 *".to_string(),
                description: "Active on the last day of each quarter".to_string(),
            },
        ]
    }

    /// Get active roles for a batch of users
    /// Returns a map of UserID -> List of Role Names
    pub async fn get_active_user_roles_batch(&self, user_ids: Vec<Uuid>) -> Result<std::collections::HashMap<Uuid, Vec<String>>, RebacError> {
        if user_ids.is_empty() {
            return Ok(std::collections::HashMap::new());
        }

        // 1. Fetch Legacy Rules (always active)
        let legacy_rows = sqlx::query(
            r#"
            SELECT ur.user_id, r.name 
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = ANY($1)
            "#
        )
        .bind(&user_ids)
        .fetch_all(&self.pool)
        .await?;

        // 2. Fetch Scoped Roles (need validation)
        let scoped_roles = sqlx::query_as::<_, ScopedUserRoleWithDetails>(
            r#"
            SELECT sur.id, sur.user_id, sur.role_id, r.name as role_name,
                   sur.scope_entity_id, e.display_name as scope_entity_name,
                   sur.valid_from, sur.valid_until, sur.schedule_cron,
                   sur.is_deny, sur.granted_at
            FROM scoped_user_roles sur
            JOIN roles r ON sur.role_id = r.id
            LEFT JOIN entities e ON sur.scope_entity_id = e.id
            WHERE sur.user_id = ANY($1) AND sur.revoked_at IS NULL
            "#
        )
        .bind(&user_ids)
        .fetch_all(&self.pool)
        .await?;

        // 3. Process and merge
        let mut result: std::collections::HashMap<Uuid, Vec<String>> = std::collections::HashMap::new();

        // Initialize map for all requested users (ensure empty list if no roles)
        for uid in &user_ids {
            result.insert(*uid, Vec::new());
        }

        // Add legacy roles
        for row in legacy_rows {
            let uid: Uuid = row.get("user_id");
            let role_name: String = row.get("name");
            if let Some(list) = result.get_mut(&uid) {
                list.push(role_name);
            }
        }

        // Add active scoped roles
        let now = Utc::now();
        for sr in scoped_roles {
            let mut is_active = true;
            
            if let Some(valid_from) = sr.valid_from {
                if now < valid_from { is_active = false; }
            }
            if let Some(valid_until) = sr.valid_until {
                if now >= valid_until { is_active = false; }
            }
            
            if is_active {
                if let Some(ref cron) = sr.schedule_cron {
                    if !cron.is_empty() {
                         if let Ok(cron_active) = Self::is_within_cron_schedule(cron) {
                             if !cron_active { is_active = false; }
                         } else {
                             is_active = false;
                         }
                    }
                }
            }

            if is_active {
                if let Some(list) = result.get_mut(&sr.user_id) {
                    list.push(sr.role_name);
                }
            }
        }

        // Deduplicate
        for list in result.values_mut() {
            list.sort();
            list.dedup();
        }

        Ok(result)
    }
}
