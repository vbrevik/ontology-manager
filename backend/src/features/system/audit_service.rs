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
        let log = sqlx::query_as::<_, AuditLog>(
            r#"
            INSERT INTO audit_logs (user_id, action, target_type, target_id, before_state, after_state, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#
        )
        .bind(user_id)
        .bind(action)
        .bind(target_type)
        .bind(target_id)
        .bind(before_state)
        .bind(after_state)
        .bind(metadata.clone())
        .fetch_one(&self.pool)
        .await?;

        // Ontology Sync (Shadow Event)
        // We do this in a separate block to ensure the main log always succeeds even if this fails, 
        // or we could log the error. For now, we'll try to do it and log error if fails.
        let pool = self.pool.clone();
        let user_id_copy = user_id;
        let action_copy = action.to_string();
        let target_id_copy = target_id;
        let metadata_copy = metadata.clone();

        tokio::spawn(async move {
            if let Err(e) = Self::sync_to_ontology(&pool, user_id_copy, action_copy, target_id_copy, metadata_copy).await {
                tracing::error!("Failed to sync security event to ontology: {}", e);
            }
        });

        Ok(log)
    }

    async fn sync_to_ontology(
        pool: &PgPool,
        user_id: Uuid,
        action: String,
        target_id: Option<Uuid>,
        metadata: Option<serde_json::Value>,
    ) -> Result<(), sqlx::Error> {
        // 1. Get Class IDs
        let class_ids = sqlx::query!(
            r#"
            SELECT id, name FROM classes 
            WHERE name IN ('SecurityEvent', 'User') 
            AND version_id = (SELECT id FROM ontology_versions WHERE is_system = TRUE LIMIT 1)
            "#
        )
        .fetch_all(pool)
        .await?;

        let sec_event_class = class_ids.iter().find(|c| c.name == "SecurityEvent").map(|c| c.id);
        
        if let (Some(sec_event_cid), Some(_)) = (sec_event_class, class_ids.iter().find(|c| c.name == "User")) {
             // 2. Create SecurityEvent Entity
             let details = metadata.unwrap_or(serde_json::json!({}));
             let attributes = serde_json::json!({
                 "action": action,
                 "severity": "MEDIUM", // Default, could be refined
                 "details": details,
                 // IP/UA could be extracted from details if passed
             });

             let event_id = Uuid::new_v4();
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
             .execute(pool)
             .await?;

             // 3. Create initiated_by relationship (Event -> User)
             // We need relationship type id
             let rel_types = sqlx::query!(
                 "SELECT id, name FROM relationship_types WHERE name IN ('initiated_by', 'affected_target')"
             )
             .fetch_all(pool)
             .await?;
             
             if let Some(init_type) = rel_types.iter().find(|r| r.name == "initiated_by") {
                  // We need the User entity ID. 
                  // The user_id passed is the AUTH User ID. 
                  // The User ENTITY has a property `user_id` matching this, OR (in legacy) the ID matches.
                  // Migration `bridge_identity_ontology` made User Entity ID == Auth User ID where possible 
                  // BUT also added `user_id` property.
                  // Let's assume User Entity ID == Auth User ID for simplicity if ported, 
                  // or we check if an entity with this ID exists.
                  let user_entity_exists = sqlx::query_scalar!(
                      "SELECT EXISTS(SELECT 1 FROM entities WHERE id = $1)",
                      user_id
                  )
                  .fetch_one(pool)
                  .await?
                  .unwrap_or(false);

                  if user_entity_exists {
                       sqlx::query!(
                           r#"
                           INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id)
                           VALUES ($1, $2, $3)
                           ON CONFLICT DO NOTHING
                           "#,
                           event_id,
                           user_id,
                           init_type.id
                       )
                       .execute(pool)
                       .await?;
                  }
             }

             // 4. Create affected_target relationship (Event -> Entity)
             if let Some(tid) = target_id {
                 if let Some(target_type_rel) = rel_types.iter().find(|r| r.name == "affected_target") {
                     // Verify target is an entity
                     let target_exists = sqlx::query_scalar!(
                         "SELECT EXISTS(SELECT 1 FROM entities WHERE id = $1)",
                         tid
                     )
                     .fetch_one(pool)
                     .await?
                     .unwrap_or(false);

                     if target_exists {
                         sqlx::query!(
                             r#"
                             INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id)
                             VALUES ($1, $2, $3)
                             ON CONFLICT DO NOTHING
                             "#,
                             event_id,
                             tid,
                             target_type_rel.id
                         )
                         .execute(pool)
                         .await?;
                     }
                 }
             }
        }
        
        Ok(())
    }

    pub async fn get_logs(&self) -> Result<Vec<AuditLog>, AuthError> {
        let logs = sqlx::query_as::<_, AuditLog>(
            "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(logs)
    }
}
