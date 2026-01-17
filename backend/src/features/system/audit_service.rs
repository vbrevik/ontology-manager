use crate::features::auth::models::AuditLog;
use crate::features::auth::service::AuthError;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct AuditService {
    pool: PgPool,
}

impl AuditService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn log(
        &self,
        user_id: Uuid,
        action: &str,
        target_type: &str,
        target_id: Option<Uuid>,
        before_state: Option<serde_json::Value>,
        after_state: Option<serde_json::Value>,
        metadata: Option<serde_json::Value>,
    ) -> Result<AuditLog, AuthError> {
        // [UNIFIED] Audit logging is now Ontology-first.
        // We create a SecurityEvent entity and establish relationships.
        
        // 1. Get Class IDs
        let class_ids = sqlx::query!(
            r#"
            SELECT id, name FROM classes 
            WHERE name IN ('SecurityEvent', 'User') 
            AND version_id = (SELECT id FROM ontology_versions WHERE is_system = TRUE LIMIT 1)
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let sec_event_cid = class_ids.iter().find(|c| c.name == "SecurityEvent").map(|c| c.id)
            .ok_or_else(|| AuthError::DatabaseError(sqlx::Error::Protocol("SecurityEvent class not found".to_string())))?;

        // 2. Create SecurityEvent Entity
        let event_id = Uuid::new_v4();
        let attributes = serde_json::json!({
            "action": action,
            "target_type": target_type,
            "severity": "MEDIUM",
            "details": metadata.clone().unwrap_or(serde_json::json!({})),
            "before_state": before_state,
            "after_state": after_state
        });

        let mut tx = self.pool.begin().await?;

        sqlx::query!(
            r#"
            INSERT INTO entities (id, class_id, display_name, attributes)
            VALUES ($1, $2, $3, $4)
            "#,
            event_id,
            sec_event_cid,
            format!("SecurityEvent: {}", action),
            attributes
        )
        .execute(&mut *tx)
        .await?;

        // 3. Create initiated_by relationship (Event -> User)
        let init_type_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM relationship_types WHERE name = 'initiated_by' LIMIT 1"
        )
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
            INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            "#,
            event_id,
            user_id,
            init_type_id
        )
        .execute(&mut *tx)
        .await?;

        // 4. Create affected_target relationship (Event -> Entity)
        if let Some(tid) = target_id {
            let target_type_rel_id = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM relationship_types WHERE name = 'affected_target' LIMIT 1"
            )
            .fetch_one(&mut *tx)
            .await?;

            sqlx::query!(
                r#"
                INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
                "#,
                event_id,
                tid,
                target_type_rel_id
            )
            .execute(&mut *tx)
            .await?;
        }

        // 5. Commit and return the unified log record
        let log = sqlx::query_as::<_, AuditLog>(
            "SELECT * FROM unified_audit_logs WHERE id = $1"
        )
        .bind(event_id)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(log)
    }


    pub async fn get_logs(&self) -> Result<Vec<AuditLog>, AuthError> {
        let logs = sqlx::query_as::<_, AuditLog>(
            "SELECT * FROM unified_audit_logs ORDER BY created_at DESC LIMIT 200",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(logs)
    }
}
