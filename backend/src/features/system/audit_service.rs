use sqlx::PgPool;
use uuid::Uuid;
use crate::features::auth::models::AuditLog;
use crate::features::auth::service::AuthError;

#[derive(Clone)]
pub struct AuditService {
    pool: PgPool,
}

impl AuditService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

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
        .bind(metadata)
        .fetch_one(&self.pool)
        .await?;

        Ok(log)
    }

    pub async fn get_logs(&self) -> Result<Vec<AuditLog>, AuthError> {
        let logs = sqlx::query_as::<_, AuditLog>(
            "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200"
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(logs)
    }
}
