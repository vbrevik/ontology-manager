use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;
use serde_json::json;

use super::models::*;
use super::alerts::AlertSystem;
use crate::features::rebac::service::RebacService;

/// Unified Monitoring Service
/// Integrates monitoring with ontology, ABAC, and ReBAC
#[derive(Clone)]
pub struct UnifiedMonitoringService {
    db: PgPool,
    alert_system: Arc<AlertSystem>,
    rebac_service: Option<Arc<RebacService>>,
}

impl UnifiedMonitoringService {
    pub fn new(
        db: PgPool,
        alert_system: Arc<AlertSystem>,
        rebac_service: Option<Arc<RebacService>>,
    ) -> Self {
        Self {
            db,
            alert_system,
            rebac_service,
        }
    }

    /// Log failed auth attempt as ontology entity
    pub async fn log_failed_auth_ontology(
        &self,
        request: CreateFailedAuthAttempt,
    ) -> Result<Uuid, Box<dyn std::error::Error>> {
        // Get FailedAuthAttempt class ID
        let class_id = sqlx::query_scalar!(
            r#"
            SELECT id FROM classes WHERE name = 'FailedAuthAttempt' LIMIT 1
            "#
        )
        .fetch_one(&self.db)
        .await?;

        // Create display name
        let display_name = format!(
            "Failed auth: {} from {}",
            request.attempted_identifier, request.ip_address
        );

        // Prepare attributes
        let attributes = json!({
            "attempted_identifier": request.attempted_identifier,
            "ip_address": request.ip_address,
            "user_agent": request.user_agent,
            "endpoint": request.endpoint,
            "failure_reason": request.failure_reason,
            "metadata": request.metadata.unwrap_or_else(|| json!({})),
            "attempted_at": chrono::Utc::now()
        });

        // Insert as entity
        let entity_id = sqlx::query_scalar!(
            r#"
            INSERT INTO entities (class_id, display_name, attributes)
            VALUES ($1, $2, $3)
            RETURNING id
            "#,
            class_id,
            display_name,
            attributes
        )
        .fetch_one(&self.db)
        .await?;

        // Create relationship to user if known
        if let Some(user_id) = request.user_id {
            let triggered_by_type = sqlx::query_scalar!(
                r#"
                SELECT id FROM relationship_types WHERE name = 'triggered_by' LIMIT 1
                "#
            )
            .fetch_one(&self.db)
            .await?;

            sqlx::query!(
                r#"
                INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
                "#,
                entity_id,
                user_id,
                triggered_by_type
            )
            .execute(&self.db)
            .await?;
        }

        // Also log to legacy table for compatibility
        let _ = sqlx::query!(
            r#"
            INSERT INTO failed_auth_attempts (
                id, attempted_identifier, user_id, ip_address, user_agent, 
                endpoint, failure_reason, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING
            "#,
            entity_id,
            request.attempted_identifier,
            request.user_id,
            request.ip_address,
            request.user_agent,
            request.endpoint,
            request.failure_reason,
            request.metadata.unwrap_or_else(|| json!({}))
        )
        .execute(&self.db)
        .await;

        // Check alerts
        self.check_and_trigger_alerts().await?;

        Ok(entity_id)
    }

    /// Log security event as ontology entity
    pub async fn log_security_event_ontology(
        &self,
        request: CreateSecurityEvent,
    ) -> Result<Uuid, Box<dyn std::error::Error>> {
        // Get SecurityEvent class ID
        let class_id = sqlx::query_scalar!(
            r#"
            SELECT id FROM classes WHERE name = 'SecurityEvent' LIMIT 1
            "#
        )
        .fetch_one(&self.db)
        .await?;

        // Create display name
        let display_name = format!(
            "{}: {}",
            request.event_type,
            request.resource.as_deref().unwrap_or("system")
        );

        // Prepare attributes
        let attributes = json!({
            "event_type": request.event_type,
            "severity": request.severity.as_str(),
            "ip_address": request.ip_address,
            "user_agent": request.user_agent,
            "resource": request.resource,
            "action": request.action,
            "outcome": request.outcome.as_str(),
            "details": request.details.unwrap_or_else(|| json!({})),
            "detected_at": chrono::Utc::now(),
            "alerted": false
        });

        // Insert as entity
        let entity_id = sqlx::query_scalar!(
            r#"
            INSERT INTO entities (class_id, display_name, attributes)
            VALUES ($1, $2, $3)
            RETURNING id
            "#,
            class_id,
            display_name,
            attributes
        )
        .fetch_one(&self.db)
        .await?;

        // Create relationship to user if known
        if let Some(user_id) = request.user_id {
            let triggered_by_type = sqlx::query_scalar!(
                r#"
                SELECT id FROM relationship_types WHERE name = 'triggered_by' LIMIT 1
                "#
            )
            .fetch_one(&self.db)
            .await?;

            sqlx::query!(
                r#"
                INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
                "#,
                entity_id,
                user_id,
                triggered_by_type
            )
            .execute(&self.db)
            .await?;
        }

        // Also log to legacy table for compatibility
        let _ = sqlx::query!(
            r#"
            INSERT INTO security_events (
                id, event_type, severity, user_id, ip_address, user_agent,
                resource, action, outcome, details
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
            "#,
            entity_id,
            request.event_type,
            request.severity.as_str(),
            request.user_id,
            request.ip_address,
            request.user_agent,
            request.resource,
            request.action,
            request.outcome.as_str(),
            request.details.unwrap_or_else(|| json!({}))
        )
        .execute(&self.db)
        .await;

        // If critical, check alerts immediately
        if request.severity == Severity::Critical {
            self.check_and_trigger_alerts().await?;
        }

        Ok(entity_id)
    }

    /// Check if user has permission to view monitoring entity
    pub async fn check_monitoring_permission(
        &self,
        user_id: Uuid,
        entity_id: Uuid,
        permission: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        if let Some(rebac) = &self.rebac_service {
            // Check ReBAC permission
            return rebac
                .check_permission(user_id, entity_id, permission)
                .await
                .map_err(|e| e.into());
        }

        // Fallback: check if user has admin role
        let is_admin = sqlx::query_scalar!(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM relationships r
                JOIN entities role ON role.id = r.target_entity_id
                JOIN classes c ON c.id = role.class_id
                WHERE r.source_entity_id = $1
                  AND c.name = 'Role'
                  AND (role.attributes->>'name' = 'superadmin' OR role.attributes->>'name' = 'admin')
            ) as "exists!"
            "#,
            user_id
        )
        .fetch_one(&self.db)
        .await?;

        Ok(is_admin)
    }

    /// Get failed auth attempts (with ABAC filtering)
    pub async fn get_failed_auth_ontology(
        &self,
        user_id: Uuid,
        limit: i64,
    ) -> Result<Vec<serde_json::Value>, Box<dyn std::error::Error>> {
        // Check if user has view_failed_auth permission
        let can_view = self.check_user_has_permission(user_id, "view_failed_auth").await?;
        
        if !can_view {
            return Ok(vec![]);
        }

        let results = sqlx::query!(
            r#"
            SELECT 
                e.id,
                e.display_name,
                e.attributes,
                e.created_at,
                r.target_entity_id as user_id
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            LEFT JOIN relationships r ON r.source_entity_id = e.id
                AND r.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'triggered_by' LIMIT 1)
            WHERE c.name = 'FailedAuthAttempt'
              AND e.deleted_at IS NULL
            ORDER BY e.created_at DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.db)
        .await?;

        Ok(results
            .into_iter()
            .map(|r| {
                let mut attrs = r.attributes.clone();
                if let Some(obj) = attrs.as_object_mut() {
                    obj.insert("id".to_string(), json!(r.id));
                    obj.insert("display_name".to_string(), json!(r.display_name));
                    obj.insert("user_id".to_string(), json!(r.user_id));
                }
                attrs
            })
            .collect())
    }

    /// Get security events (with ABAC filtering)
    pub async fn get_security_events_ontology(
        &self,
        user_id: Uuid,
        limit: i64,
    ) -> Result<Vec<serde_json::Value>, Box<dyn std::error::Error>> {
        // Check if user has view_security_events permission
        let can_view = self.check_user_has_permission(user_id, "view_security_events").await?;
        
        if !can_view {
            return Ok(vec![]);
        }

        let results = sqlx::query!(
            r#"
            SELECT 
                e.id,
                e.display_name,
                e.attributes,
                e.created_at,
                r.target_entity_id as user_id
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            LEFT JOIN relationships r ON r.source_entity_id = e.id
                AND r.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'triggered_by' LIMIT 1)
            WHERE c.name = 'SecurityEvent'
              AND e.deleted_at IS NULL
            ORDER BY e.created_at DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.db)
        .await?;

        Ok(results
            .into_iter()
            .map(|r| {
                let mut attrs = r.attributes.clone();
                if let Some(obj) = attrs.as_object_mut() {
                    obj.insert("id".to_string(), json!(r.id));
                    obj.insert("display_name".to_string(), json!(r.display_name));
                    obj.insert("user_id".to_string(), json!(r.user_id));
                }
                attrs
            })
            .collect())
    }

    /// Get alert rules (with ABAC filtering)
    pub async fn get_alert_rules_ontology(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<serde_json::Value>, Box<dyn std::error::Error>> {
        // Check if user has view_alert_rules permission
        let can_view = self.check_user_has_permission(user_id, "view_alert_rules").await?;
        
        if !can_view {
            return Ok(vec![]);
        }

        let results = sqlx::query!(
            r#"
            SELECT 
                e.id,
                e.display_name,
                e.attributes,
                e.created_at,
                e.updated_at
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            WHERE c.name = 'AlertRule'
              AND e.deleted_at IS NULL
            ORDER BY (e.attributes->>'total_triggers')::INTEGER DESC NULLS LAST
            "#
        )
        .fetch_all(&self.db)
        .await?;

        Ok(results
            .into_iter()
            .map(|r| {
                let mut attrs = r.attributes.clone();
                if let Some(obj) = attrs.as_object_mut() {
                    obj.insert("id".to_string(), json!(r.id));
                    obj.insert("display_name".to_string(), json!(r.display_name));
                }
                attrs
            })
            .collect())
    }

    /// Check if user has a specific permission
    async fn check_user_has_permission(
        &self,
        user_id: Uuid,
        permission_name: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        // Check via roles and permission relationships
        let has_permission = sqlx::query_scalar!(
            r#"
            SELECT EXISTS(
                -- User has direct permission
                SELECT 1 FROM relationships user_perm
                JOIN entities perm ON perm.id = user_perm.target_entity_id
                JOIN classes pc ON pc.id = perm.class_id
                WHERE user_perm.source_entity_id = $1
                  AND pc.name = 'Permission'
                  AND perm.attributes->>'name' = $2
                  AND user_perm.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'has_permission' LIMIT 1)
                
                UNION ALL
                
                -- User has permission via role
                SELECT 1 FROM relationships user_role
                JOIN entities role ON role.id = user_role.target_entity_id
                JOIN classes rc ON rc.id = role.class_id
                JOIN relationships role_perm ON role_perm.source_entity_id = role.id
                JOIN entities perm ON perm.id = role_perm.target_entity_id
                JOIN classes pc ON pc.id = perm.class_id
                WHERE user_role.source_entity_id = $1
                  AND rc.name = 'Role'
                  AND user_role.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'has_role' LIMIT 1)
                  AND pc.name = 'Permission'
                  AND perm.attributes->>'name' = $2
                  AND role_perm.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'grants_permission' LIMIT 1)
                
                UNION ALL
                
                -- User is superadmin (has all permissions)
                SELECT 1 FROM relationships user_role
                JOIN entities role ON role.id = user_role.target_entity_id
                JOIN classes rc ON rc.id = role.class_id
                WHERE user_role.source_entity_id = $1
                  AND rc.name = 'Role'
                  AND role.attributes->>'name' = 'superadmin'
                  AND user_role.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'has_role' LIMIT 1)
            ) as "exists!"
            "#,
            user_id,
            permission_name
        )
        .fetch_one(&self.db)
        .await?;

        Ok(has_permission)
    }

    /// Check and trigger alerts (reuse from original service)
    async fn check_and_trigger_alerts(&self) -> Result<usize, Box<dyn std::error::Error>> {
        let triggers = sqlx::query!(
            r#"
            SELECT 
                rule_id,
                rule_name,
                event_count,
                should_alert
            FROM check_alert_rules()
            "#
        )
        .fetch_all(&self.db)
        .await?;

        let mut triggered_count = 0;

        for trigger in triggers {
            if trigger.should_alert.unwrap_or(false) {
                // Get rule details from ontology
                let rule = sqlx::query!(
                    r#"
                    SELECT 
                        e.id,
                        e.display_name as rule_name,
                        e.attributes
                    FROM entities e
                    JOIN classes c ON e.class_id = c.id
                    WHERE c.name = 'AlertRule'
                      AND e.id = $1
                    "#,
                    trigger.rule_id
                )
                .fetch_one(&self.db)
                .await?;

                // Convert to AlertRule for alerting
                let alert_rule = super::models::AlertRule {
                    id: rule.id.unwrap(),
                    rule_name: rule.rule_name.unwrap(),
                    description: rule.attributes.get("description").and_then(|v| v.as_str()).map(String::from),
                    enabled: rule.attributes.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
                    event_type: rule.attributes.get("event_type").and_then(|v| v.as_str()).map(String::from),
                    min_severity: rule.attributes.get("min_severity").and_then(|v| v.as_str()).map(String::from),
                    threshold_count: rule.attributes.get("threshold_count").and_then(|v| v.as_i64()).map(|v| v as i32),
                    threshold_window_minutes: rule.attributes.get("threshold_window_minutes").and_then(|v| v.as_i64()).map(|v| v as i32),
                    group_by: rule.attributes.get("group_by").and_then(|v| v.as_str()).map(String::from),
                    alert_channel: rule.attributes.get("alert_channel").and_then(|v| v.as_str()).map(String::from).unwrap_or_else(|| "slack".to_string()),
                    alert_cooldown_minutes: rule.attributes.get("alert_cooldown_minutes").and_then(|v| v.as_i64()).map(|v| v as i32),
                    last_triggered_at: None,
                    total_triggers: 0,
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                };

                // Send alert
                self.alert_system
                    .send_alert(&alert_rule, trigger.event_count.unwrap_or(0))
                    .await
                    .ok();

                // Update rule in ontology
                sqlx::query!(
                    r#"
                    UPDATE entities
                    SET attributes = jsonb_set(
                        jsonb_set(
                            attributes,
                            '{last_triggered_at}',
                            to_jsonb(NOW())
                        ),
                        '{total_triggers}',
                        to_jsonb((COALESCE((attributes->>'total_triggers')::INTEGER, 0) + 1)::INTEGER)
                    ),
                    updated_at = NOW()
                    WHERE id = $1
                    "#,
                    rule.id
                )
                .execute(&self.db)
                .await?;

                triggered_count += 1;
            }
        }

        Ok(triggered_count)
    }

    /// Log security event when monitoring entity is accessed
    pub async fn log_entity_access(
        &self,
        user_id: Uuid,
        entity_id: Uuid,
        action: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Get entity class to determine what was accessed
        let class_name = sqlx::query_scalar!(
            r#"
            SELECT c.name
            FROM entities e
            JOIN classes c ON c.id = e.class_id
            WHERE e.id = $1
            "#,
            entity_id
        )
        .fetch_one(&self.db)
        .await?;

        // Log the access as a security event
        self.log_security_event_ontology(CreateSecurityEvent {
            event_type: "monitoring_access".to_string(),
            severity: Severity::Info,
            user_id: Some(user_id),
            ip_address: None,
            user_agent: None,
            resource: Some(class_name),
            action: Some(action.to_string()),
            outcome: Outcome::Success,
            details: Some(json!({
                "entity_id": entity_id
            })),
        })
        .await?;

        Ok(())
    }
}
