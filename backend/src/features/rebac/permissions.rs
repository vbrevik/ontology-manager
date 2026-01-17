use super::models::*;
use super::service::{RebacError, RebacService};
use crate::features::rebac::policy_models::PolicyResult;
use chrono::Utc;
use sqlx::Row;
use uuid::Uuid;

impl RebacService {
    // ========================================================================
    // PERMISSION TYPES
    // ========================================================================

    pub async fn list_permission_types(&self) -> Result<Vec<PermissionType>, RebacError> {
        let class = self
            .ontology_service
            .get_system_class("Permission")
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))?;

        let entities = self
            .ontology_service
            .list_entities(Some(class.id), None, None)
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))?;

        let perms = entities
            .into_iter()
            .map(|e| PermissionType {
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
                created_at: e.created_at,
            })
            .collect();

        Ok(perms)
    }

    pub async fn create_permission_type(
        &self,
        input: CreatePermissionTypeInput,
    ) -> Result<PermissionType, RebacError> {
        let class = self
            .ontology_service
            .get_system_class("Permission")
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))?;

        let entity_input = crate::features::ontology::models::CreateEntityInput {
            class_id: class.id,
            display_name: input.name.clone(),
            parent_entity_id: None,
            attributes: Some(serde_json::json!({
                "name": input.name,
                "description": input.description,
                "level": input.level
            })),
        };

        let entity = self
            .ontology_service
            .create_entity(entity_input, None, None)
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))?;

        Ok(PermissionType {
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
            created_at: entity.created_at,
        })
    }

    pub async fn update_permission_type(
        &self,
        id: Uuid,
        input: UpdatePermissionTypeInput,
    ) -> Result<PermissionType, RebacError> {
        let mut attributes = serde_json::Map::new();
        if let Some(desc) = input.description {
            attributes.insert("description".to_string(), serde_json::json!(desc));
        }
        if let Some(level) = input.level {
            attributes.insert("level".to_string(), serde_json::json!(level));
        }

        let entity_input = crate::features::ontology::models::UpdateEntityInput {
            display_name: None,
            parent_entity_id: None,
            attributes: Some(serde_json::Value::Object(attributes)),
        };

        let entity = self
            .ontology_service
            .update_entity(id, entity_input, None)
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))?;

        Ok(PermissionType {
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
            created_at: entity.created_at,
        })
    }

    pub async fn delete_permission_type(&self, id: Uuid) -> Result<(), RebacError> {
        self.ontology_service
            .delete_entity(id, None)
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))
    }

    // ========================================================================
    // PERMISSION CHECKS (Core ReBAC Logic)
    // ========================================================================

    pub async fn check_permission(
        &self,
        user_id: Uuid,
        entity_id: Uuid,
        permission: &str,
        tenant_id: Option<Uuid>,
        field_name: Option<&str>,
    ) -> Result<PermissionCheckResult, RebacError> {
        if self.has_firefighter_active(user_id).await? {
            tracing::info!(
                "Firefighter mode active for user {}, granting global ReBAC access for '{}'",
                user_id,
                permission
            );
            let _ = self
                .audit_service
                .log(
                    user_id,
                    &format!("firefighter.access.{}", permission),
                    "entity",
                    Some(entity_id),
                    None,
                    None,
                    Some(serde_json::json!({
                        "permission": permission,
                        "field_name": field_name,
                        "tenant_id": tenant_id,
                        "is_break_glass": true
                    })),
                )
                .await;

            return Ok(PermissionCheckResult {
                has_permission: true,
                granted_via_entity_id: None,
                granted_via_role: Some("firefighter".to_string()),
                is_inherited: Some(false),
                is_denied: Some(false),
            });
        }

        if field_name.is_none() {
            let cache_key = (user_id, entity_id, permission.to_string(), tenant_id);
            if let Some(cached) = self.permission_cache.get(&cache_key).await {
                return Ok(cached);
            }

            let row = sqlx::query(
                "SELECT has_permission, granted_via_entity_id, granted_via_role, is_inherited, is_denied FROM check_entity_permission($1, $2, $3, $4)",
            )
            .bind(user_id)
            .bind(entity_id)
            .bind(permission)
            .bind(tenant_id)
            .fetch_one(&self.pool)
            .await?;

            let result = PermissionCheckResult {
                has_permission: row.try_get::<Option<bool>, _>("has_permission")?.unwrap_or(false),
                granted_via_entity_id: row.try_get::<Option<Uuid>, _>("granted_via_entity_id")?,
                granted_via_role: row.try_get::<Option<String>, _>("granted_via_role")?,
                is_inherited: row.try_get::<Option<bool>, _>("is_inherited")?,
                is_denied: row.try_get::<Option<bool>, _>("is_denied")?,
            };

            self.permission_cache
                .insert(cache_key, result.clone())
                .await;
            return Ok(result);
        }

        let field = field_name.unwrap();
        let has_field_perm =
            sqlx::query_scalar::<_, bool>("SELECT check_field_permission($1, $2, $3, $4, $5)")
                .bind(user_id)
                .bind(entity_id)
                .bind(field)
                .bind(permission)
                .bind(tenant_id)
                .fetch_one(&self.pool)
                .await?;

        Ok(PermissionCheckResult {
            has_permission: has_field_perm,
            granted_via_entity_id: None,
            granted_via_role: None,
            is_inherited: None,
            is_denied: None,
        })
    }

    pub async fn has_permission(
        &self,
        user_id: Uuid,
        entity_id: Uuid,
        permission: &str,
        tenant_id: Option<Uuid>,
    ) -> Result<bool, RebacError> {
        let result = self
            .check_permission(user_id, entity_id, permission, tenant_id, None)
            .await?;
        Ok(result.has_permission)
    }

    pub async fn require_permission(
        &self,
        user_id: Uuid,
        entity_id: Uuid,
        permission: &str,
        tenant_id: Option<Uuid>,
        field_name: Option<&str>,
    ) -> Result<(), RebacError> {
        let result = self
            .check_permission(user_id, entity_id, permission, tenant_id, field_name)
            .await?;

        if !result.has_permission {
            let reason = if result.is_denied.unwrap_or(false) {
                "Access explicitly denied"
            } else {
                "No permission granted"
            };
            return Err(RebacError::PermissionDenied(reason.to_string()));
        }
        Ok(())
    }

    pub async fn check_multiple_permissions(
        &self,
        user_id: Uuid,
        entity_ids: Vec<Uuid>,
        permission: &str,
        tenant_id: Option<Uuid>,
    ) -> Result<Vec<(Uuid, bool, bool)>, RebacError> {
        if self.has_firefighter_active(user_id).await? {
            // For bulk check, return all as allowed
            tracing::info!(
                "Firefighter mode active for user {}, granting bulk ReBAC access for '{}'",
                user_id,
                permission
            );
            return Ok(entity_ids.iter().map(|id| (*id, true, false)).collect());
        }

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

    pub async fn get_user_entity_permissions(
        &self,
        user_id: Uuid,
        entity_id: Uuid,
    ) -> Result<Vec<EntityPermission>, RebacError> {
        let perms = sqlx::query_as::<_, EntityPermission>(
            "SELECT * FROM get_user_entity_permissions($1, $2)",
        )
        .bind(user_id)
        .bind(entity_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(perms)
    }

    pub async fn has_firefighter_active(&self, user_id: Uuid) -> Result<bool, RebacError> {
        let has_active = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM firefighter_sessions WHERE user_id = $1 AND deactivated_at IS NULL AND expires_at > NOW())"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;
        Ok(has_active)
    }

    pub async fn check_permission_integrated(
        &self,
        user_id: Uuid,
        entity_id: Uuid,
        permission: &str,
        tenant_id: Option<Uuid>,
        field_name: Option<&str>,
        custom_context: Option<serde_json::Map<String, serde_json::Value>>,
    ) -> Result<bool, RebacError> {
        if self.has_firefighter_active(user_id).await? {
            // ... firefighter ...
            return Ok(true);
        }

        let rebac_result = self
            .check_permission(user_id, entity_id, permission, tenant_id, field_name)
            .await?;

        let mut final_has_permission = rebac_result.has_permission;
        let is_rebac_denied = rebac_result.is_denied.unwrap_or(false);

        if final_has_permission && !is_rebac_denied {
            let active_roles = self
                .get_active_grant_roles(user_id, entity_id, permission, tenant_id)
                .await?;
            if !active_roles.iter().any(Self::is_role_active) {
                tracing::debug!("Permission check failed cron schedule validation");
                final_has_permission = false;
            }
        }

        let context = self
            .build_evaluation_context(user_id, entity_id, permission, custom_context)
            .await?;

        let entity_class_id =
            sqlx::query_scalar::<_, Uuid>("SELECT class_id FROM entities WHERE id = $1")
                .bind(entity_id)
                .fetch_one(&self.pool)
                .await?;

        let policies = self
            .policy_service
            .get_applicable_policies(entity_id, permission, Some(entity_class_id))
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))?;

        let policy_decision = self.policy_service.evaluate_policies(&policies, &context);

        let final_result = match policy_decision {
            PolicyResult::Denied { .. } => false,
            PolicyResult::Allowed { .. } => true,
            PolicyResult::NoMatch => final_has_permission && !is_rebac_denied,
        };

        let _ = self
            .policy_service
            .log_evaluation(
                user_id,
                entity_id,
                permission,
                final_has_permission,
                &policy_decision,
                final_result,
                &context,
            )
            .await;

        Ok(final_result)
    }

    pub async fn get_active_grant_roles(
        &self,
        user_id: Uuid,
        entity_id: Uuid,
        permission: &str,
        tenant_id: Option<Uuid>,
    ) -> Result<Vec<ScopedUserRole>, RebacError> {
        let perm_class = self
            .ontology_service
            .get_system_class("Permission")
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))?;

        let has_role_type =
            sqlx::query_as::<_, crate::features::ontology::models::RelationshipType>(
                "SELECT * FROM relationship_types WHERE name = 'has_role'",
            )
            .fetch_one(&self.pool)
            .await?;

        let grant_perm_type =
            sqlx::query_as::<_, crate::features::ontology::models::RelationshipType>(
                "SELECT * FROM relationship_types WHERE name = 'grants_permission'",
            )
            .fetch_one(&self.pool)
            .await?;

        let rels = sqlx::query_as::<_, crate::features::ontology::models::Relationship>(
            r#"
            WITH RECURSIVE graph_path AS (
                SELECT id FROM entities WHERE id = $1 AND deleted_at IS NULL AND ($4::uuid IS NULL OR tenant_id = $4)
                UNION ALL
                SELECT e.id FROM graph_path gp 
                JOIN entities e ON e.id = (SELECT parent_entity_id FROM entities WHERE id = gp.id) 
                WHERE e.deleted_at IS NULL AND ($4::uuid IS NULL OR e.tenant_id = $4)
            )
            SELECT r_hr.* FROM relationships r_hr
            JOIN relationships r_gp ON r_hr.target_entity_id = r_gp.source_entity_id
            JOIN entities e_p ON r_gp.target_entity_id = e_p.id
            WHERE r_hr.source_entity_id = $2
              AND r_hr.relationship_type_id = $5
              AND r_gp.relationship_type_id = $6
              AND (r_hr.metadata->>'scope_entity_id' IS NULL OR (r_hr.metadata->>'scope_entity_id')::uuid IN (SELECT id FROM graph_path))
              AND (e_p.display_name = $3 OR (e_p.attributes->>'level')::int >= (SELECT (attributes->>'level')::int FROM entities WHERE display_name = $3 AND class_id = $7) OR e_p.display_name = 'admin')
            "#
        )
        .bind(entity_id)
        .bind(user_id)
        .bind(permission)
        .bind(tenant_id)
        .bind(has_role_type.id)
        .bind(grant_perm_type.id)
        .bind(perm_class.id)
        .fetch_all(&self.pool)
        .await?;

        let roles = rels
            .into_iter()
            .map(|rel| {
                let metadata = rel.metadata.unwrap_or_default();
                ScopedUserRole {
                    id: rel.id,
                    user_id,
                    role_id: rel.target_entity_id,
                    scope_entity_id: metadata
                        .get("scope_entity_id")
                        .and_then(|v| v.as_str())
                        .and_then(|s| Uuid::parse_str(s).ok()),
                    valid_from: metadata
                        .get("valid_from")
                        .and_then(|v| v.as_str())
                        .and_then(|s| {
                            chrono::DateTime::parse_from_rfc3339(s)
                                .ok()
                                .map(|d| d.with_timezone(&chrono::Utc))
                        }),
                    valid_until: metadata
                        .get("valid_until")
                        .and_then(|v| v.as_str())
                        .and_then(|s| {
                            chrono::DateTime::parse_from_rfc3339(s)
                                .ok()
                                .map(|d| d.with_timezone(&chrono::Utc))
                        }),
                    schedule_cron: metadata
                        .get("schedule_cron")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    is_deny: metadata
                        .get("is_deny")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                    granted_by: metadata
                        .get("granted_by")
                        .and_then(|v| v.as_str())
                        .and_then(|s| Uuid::parse_str(s).ok()),
                    granted_at: rel.created_at,
                    revoked_at: metadata
                        .get("revoked_at")
                        .and_then(|v| v.as_str())
                        .and_then(|s| {
                            chrono::DateTime::parse_from_rfc3339(s)
                                .ok()
                                .map(|d| d.with_timezone(&chrono::Utc))
                        }),
                    revoked_by: metadata
                        .get("revoked_by")
                        .and_then(|v| v.as_str())
                        .and_then(|s| Uuid::parse_str(s).ok()),
                    revoke_reason: metadata
                        .get("revoke_reason")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                }
            })
            .collect();

        Ok(roles)
    }

    pub async fn get_accessible_entities(
        &self,
        user_id: Uuid,
        permission: &str,
    ) -> Result<Vec<AccessibleEntity>, RebacError> {
        let entities =
            sqlx::query_as::<_, AccessibleEntity>("SELECT * FROM get_accessible_entities($1, $2)")
                .bind(user_id)
                .bind(permission)
                .fetch_all(&self.pool)
                .await?;
        Ok(entities)
    }

    pub async fn get_active_user_roles_batch(
        &self,
        user_ids: Vec<Uuid>,
    ) -> Result<std::collections::HashMap<Uuid, Vec<String>>, RebacError> {
        if user_ids.is_empty() {
            return Ok(std::collections::HashMap::new());
        }

        // [UNIFIED] Batch role retrieval now uses ontology relationships exclusively.
        // We query has_role relationships for the given users.
        let rel_type_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM relationship_types WHERE name = 'has_role' LIMIT 1"
        )
        .fetch_one(&self.pool)
        .await?;

        let roles_with_details = sqlx::query!(
            r#"
            SELECT r.source_entity_id as user_id, r.target_entity_id as role_id, 
                   e_role.display_name as role_name,
                   r.metadata->>'scope_entity_id' as scope_entity_id,
                   r.metadata->>'valid_from' as valid_from,
                   r.metadata->>'valid_until' as valid_until,
                   r.metadata->>'schedule_cron' as schedule_cron,
                   r.metadata->>'is_deny' as is_deny,
                   r.created_at as granted_at
            FROM relationships r
            JOIN entities e_role ON r.target_entity_id = e_role.id
            WHERE r.source_entity_id = ANY($1) 
              AND r.relationship_type_id = $2
              AND (r.metadata->>'revoked_at' IS NULL)
            "#,
            &user_ids,
            rel_type_id
        )
        .fetch_all(&self.pool)
        .await?;

        let mut result: std::collections::HashMap<Uuid, Vec<String>> =
            std::collections::HashMap::new();

        for uid in &user_ids {
            result.insert(*uid, Vec::new());
        }

        let now = Utc::now();
        for row in roles_with_details {
            let mut is_active = true;

            // Temporal & Deny Check
            if let Some(valid_from_str) = &row.valid_from {
                if let Ok(valid_from) = chrono::DateTime::parse_from_rfc3339(valid_from_str) {
                    if now < valid_from.with_timezone(&Utc) {
                        is_active = false;
                    }
                }
            }
            if let Some(valid_until_str) = &row.valid_until {
                if let Ok(valid_until) = chrono::DateTime::parse_from_rfc3339(valid_until_str) {
                    if now >= valid_until.with_timezone(&Utc) {
                        is_active = false;
                    }
                }
            }

            if is_active && row.is_deny.and_then(|v| v.parse::<bool>().ok()).unwrap_or(false) {
                is_active = false; // Simple batch skip for denys for now
            }

            if is_active {
                if let Some(cron) = row.schedule_cron {
                    if !cron.is_empty() {
                        if let Ok(cron_active) = Self::is_within_cron_schedule(&cron) {
                            if !cron_active {
                                is_active = false;
                            }
                        } else {
                            is_active = false;
                        }
                    }
                }
            }

            if is_active {
                if let Some(list) = result.get_mut(&row.user_id) {
                    list.push(row.role_name);
                }
            }
        }

        for list in result.values_mut() {
            list.sort();
            list.dedup();
        }

        Ok(result)
    }


    pub async fn get_full_role_permission_matrix(
        &self,
        tenant_id: Option<Uuid>,
    ) -> Result<RolePermissionMatrix, RebacError> {
        let perm_types = self.list_permission_types().await?;
        let roles = self.list_roles(tenant_id).await?;

        // Format: RoleID -> [PermissionName]
        let mut role_perms: std::collections::HashMap<Uuid, Vec<String>> =
            std::collections::HashMap::new();
            
        // Pre-fill roles
        for role in &roles {
            role_perms.insert(role.id, Vec::new());
        }

        // Fetch all mappings in one query
        let mappings = sqlx::query!(
            r#"
            SELECT target_entity_id as permission_type_id, source_entity_id as role_id 
            FROM relationships 
            WHERE relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'grants_permission')
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        // Map permission_type_id to name
        let perm_id_to_name: std::collections::HashMap<Uuid, String> = perm_types
            .iter()
            .map(|pt| (pt.id, pt.name.clone()))
            .collect();

        for m in mappings {
            if let Some(p_name) = perm_id_to_name.get(&m.permission_type_id) {
                if let Some(list) = role_perms.get_mut(&m.role_id) {
                    list.push(p_name.clone());
                }
            }
        }

        let matrix_entries = roles
            .into_iter()
            .map(|role| RolePermissionMatrixEntry {
                role_id: role.id,
                role_name: role.name,
                permissions: role_perms.remove(&role.id).unwrap_or_default(),
            })
            .collect();

        Ok(RolePermissionMatrix {
            roles: matrix_entries,
            permission_types: perm_types,
        })
    }

    pub async fn batch_update_role_permissions(
        &self,
        input: BatchUpdateRolePermissionsInput,
    ) -> Result<(), RebacError> {
        let mut tx = self.pool.begin().await?;

        for update in input.updates {
            // Find permission type id first
            let perm_type = sqlx::query_as::<_, crate::features::ontology::models::Entity>(
                "SELECT * FROM entities WHERE display_name = $1 AND class_id = (SELECT id FROM classes WHERE name = 'Permission')"
            )
            .bind(&update.permission)
            .fetch_optional(&mut *tx)
            .await
            .map_err(RebacError::from)?;

            let perm_type_id = match perm_type {
                Some(pt) => pt.id,
                None => return Err(RebacError::NotFound(format!("Permission '{}' not found", update.permission))),
            };

            if update.grant {
                // Determine effect (allow/deny) - Defaulting to 'allow' for simple matrix
                let effect = "ALLOW";
                
                sqlx::query(
                    r#"
                    INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata)
                    VALUES ($1, $2, (SELECT id FROM relationship_types WHERE name = 'grants_permission'), $3)
                    ON CONFLICT (source_entity_id, target_entity_id, relationship_type_id) 
                    DO UPDATE SET metadata = relationships.metadata || $3
                    "#
                )
                .bind(update.role_id)
                .bind(perm_type_id)
                .bind(serde_json::json!({"effect": effect}))
                .execute(&mut *tx)
                .await
                .map_err(RebacError::from)?;
            } else {
                sqlx::query(
                    "DELETE FROM relationships WHERE source_entity_id = $1 AND target_entity_id = $2 AND relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'grants_permission')"
                )
                .bind(update.role_id)
                .bind(perm_type_id)
                .execute(&mut *tx)
                .await
                .map_err(RebacError::from)?;
            }
        }

        tx.commit().await.map_err(RebacError::from)?;
        Ok(())
    }
}
