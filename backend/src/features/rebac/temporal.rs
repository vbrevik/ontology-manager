use super::models::*;
use super::service::{RebacError, RebacService};
use chrono::Utc;
use uuid::Uuid;

impl RebacService {
    // ========================================================================
    // SCOPED USER ROLES
    // ========================================================================

    pub async fn list_user_scoped_roles(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<ScopedUserRoleWithDetails>, RebacError> {
        let rel_type = sqlx::query_as::<_, crate::features::ontology::models::RelationshipType>(
            "SELECT * FROM relationship_types WHERE name = 'has_role'",
        )
        .fetch_one(&self.pool)
        .await?;

        let rels = sqlx::query_as::<_, crate::features::ontology::models::Relationship>(
            "SELECT * FROM relationships WHERE source_entity_id = $1 AND relationship_type_id = $2",
        )
        .bind(user_id)
        .bind(rel_type.id)
        .fetch_all(&self.pool)
        .await?;

        let mut results = Vec::new();
        for rel in rels {
            let role_entity = self
                .ontology_service
                .get_entity(rel.target_entity_id)
                .await
                .map_err(|e| RebacError::DatabaseError(e.to_string()))?;

            let metadata = rel.metadata.unwrap_or_default();
            let scope_id = metadata
                .get("scope_entity_id")
                .and_then(|v| v.as_str())
                .and_then(|s| Uuid::parse_str(s).ok());
            let mut scope_name = None;
            if let Some(sid) = scope_id {
                if let Ok(e) = self.ontology_service.get_entity(sid).await {
                    scope_name = Some(e.display_name);
                }
            }

            results.push(ScopedUserRoleWithDetails {
                id: rel.id,
                user_id,
                role_id: rel.target_entity_id,
                role_name: role_entity.display_name,
                scope_entity_id: scope_id,
                scope_entity_name: scope_name,
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
                granted_at: rel.created_at,
            });
        }

        Ok(results)
    }

    pub async fn assign_scoped_role(
        &self,
        input: AssignScopedRoleInput,
        granted_by: Option<Uuid>,
    ) -> Result<ScopedUserRole, RebacError> {
        let role_class = self
            .ontology_service
            .get_system_class("Role")
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))?;

        let role_entity = sqlx::query_as::<_, crate::features::ontology::models::Entity>(
            "SELECT * FROM entities WHERE display_name = $1 AND class_id = $2",
        )
        .bind(&input.role_name)
        .bind(role_class.id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| RebacError::NotFound(format!("Role '{}' not found", input.role_name)))?;

        let rel_type = sqlx::query_as::<_, crate::features::ontology::models::RelationshipType>(
            "SELECT * FROM relationship_types WHERE name = 'has_role'",
        )
        .fetch_one(&self.pool)
        .await?;

        if let Some(granter_id) = granted_by {
            let can_delegate_type =
                sqlx::query_as::<_, crate::features::ontology::models::RelationshipType>(
                    "SELECT * FROM relationship_types WHERE name = 'can_delegate'",
                )
                .fetch_one(&self.pool)
                .await?;

            let is_authorized = sqlx::query_scalar::<_, bool>(
                r#"
                SELECT EXISTS (
                    SELECT 1 FROM relationships r_hr
                    JOIN relationships r_cd ON r_hr.target_entity_id = r_cd.source_entity_id
                    WHERE r_hr.source_entity_id = $1
                      AND r_hr.relationship_type_id = $2
                      AND r_cd.target_entity_id = $3
                      AND r_cd.relationship_type_id = $4
                      AND (r_cd.metadata->>'can_grant')::boolean = true
                ) OR EXISTS (
                    SELECT 1 FROM relationships r_hr
                    JOIN entities e_r ON r_hr.target_entity_id = e_r.id
                    WHERE r_hr.source_entity_id = $1
                      AND r_hr.relationship_type_id = $2
                      AND e_r.display_name = 'admin'
                )
                "#,
            )
            .bind(granter_id)
            .bind(rel_type.id)
            .bind(role_entity.id)
            .bind(can_delegate_type.id)
            .fetch_one(&self.pool)
            .await?;

            if !is_authorized {
                return Err(RebacError::PermissionDenied(
                    "You do not have authority to delegate this role".to_string(),
                ));
            }
        }

        let metadata = serde_json::json!({
            "scope_entity_id": input.scope_entity_id,
            "valid_from": input.valid_from,
            "valid_until": input.valid_until,
            "schedule_cron": input.schedule_cron,
            "is_deny": input.is_deny.unwrap_or(false),
            "granted_by": granted_by
        });

        let rel = sqlx::query_as::<_, crate::features::ontology::models::Relationship>(
            r#"
            INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (source_entity_id, target_entity_id, relationship_type_id) 
            DO UPDATE SET metadata = EXCLUDED.metadata
            RETURNING *
            "#
        )
        .bind(input.user_id)
        .bind(role_entity.id)
        .bind(rel_type.id)
        .bind(metadata)
        .fetch_one(&self.pool)
        .await?;

        Ok(ScopedUserRole {
            id: rel.id,
            user_id: input.user_id,
            role_id: role_entity.id,
            scope_entity_id: input.scope_entity_id,
            valid_from: input.valid_from,
            valid_until: input.valid_until,
            schedule_cron: input.schedule_cron,
            is_deny: input.is_deny.unwrap_or(false),
            granted_by,
            granted_at: rel.created_at,
            revoked_at: None,
            revoked_by: None,
            revoke_reason: None,
        })
    }

    pub async fn revoke_scoped_role(
        &self,
        role_assignment_id: Uuid,
        revoked_by: Option<Uuid>,
        reason: Option<String>,
    ) -> Result<(), RebacError> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE relationships 
            SET metadata = metadata || jsonb_build_object('revoked_at', $2, 'revoked_by', $3, 'revoke_reason', $4)
            WHERE id = $1
            "#
        )
        .bind(role_assignment_id)
        .bind(now)
        .bind(revoked_by)
        .bind(reason)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(RebacError::NotFound(
                "Role assignment not found".to_string(),
            ));
        }
        Ok(())
    }

    // ========================================================================
    // TEMPORAL / CRON HELPERS
    // ========================================================================

    pub fn validate_cron(cron_expression: &str) -> Result<(), RebacError> {
        use std::str::FromStr;
        cron::Schedule::from_str(cron_expression)
            .map(|_| ())
            .map_err(|e| RebacError::InvalidInput(format!("Invalid cron expression: {}", e)))
    }

    pub fn is_within_cron_schedule(cron_expression: &str) -> Result<bool, RebacError> {
        use chrono::Duration;
        use std::str::FromStr;

        let schedule = cron::Schedule::from_str(cron_expression)
            .map_err(|e| RebacError::InvalidInput(format!("Invalid cron expression: {}", e)))?;

        let now = Utc::now();

        if let Some(prev) = schedule.after(&(now - Duration::minutes(1))).next() {
            if prev <= now && (now - prev).num_seconds() < 60 {
                return Ok(true);
            }
        }

        let upcoming: Vec<_> = schedule
            .after(&(now - Duration::minutes(2)))
            .take(2)
            .collect();
        if !upcoming.is_empty() {
            for occurrence in &upcoming {
                if *occurrence <= now && (now - *occurrence).num_seconds() < 120 {
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }

    pub fn is_role_active(role: &ScopedUserRole) -> bool {
        let now = Utc::now();
        if role.revoked_at.is_some() {
            return false;
        }
        if let Some(valid_from) = role.valid_from {
            if now < valid_from {
                return false;
            }
        }
        if let Some(valid_until) = role.valid_until {
            if now >= valid_until {
                return false;
            }
        }
        if let Some(ref cron_expr) = role.schedule_cron {
            if !cron_expr.is_empty() {
                match Self::is_within_cron_schedule(cron_expr) {
                    Ok(is_active) => {
                        if !is_active {
                            return false;
                        }
                    }
                    Err(_) => {
                        return false;
                    }
                }
            }
        }
        true
    }

    pub async fn update_role_schedule(
        &self,
        role_assignment_id: Uuid,
        schedule_cron: Option<String>,
    ) -> Result<ScopedUserRole, RebacError> {
        if let Some(ref expr) = schedule_cron {
            if !expr.is_empty() {
                Self::validate_cron(expr)?;
            }
        }

        let rel = sqlx::query_as::<_, crate::features::ontology::models::Relationship>(
            r#"
            UPDATE relationships 
            SET metadata = metadata || jsonb_build_object('schedule_cron', $2)
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(role_assignment_id)
        .bind(&schedule_cron)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| RebacError::NotFound("Role assignment not found".to_string()))?;

        let metadata = rel.metadata.unwrap_or_default();
        Ok(ScopedUserRole {
            id: rel.id,
            user_id: rel.source_entity_id,
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
        })
    }

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
}
