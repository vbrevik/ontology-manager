use super::models::{TestModeSession, TestModeStatus};
use crate::features::system::AuditService;
use chrono::{Duration, Utc};
use sqlx::PgPool;
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum TestModeError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Test mode already active")]
    AlreadyActive,

    #[error("No active test mode session")]
    NotActive,

    #[error("Invalid duration: {0}")]
    InvalidDuration(String),
}

#[derive(Clone)]
pub struct TestModeService {
    pool: PgPool,
    audit_service: AuditService,
}

impl TestModeService {
    pub fn new(pool: PgPool, audit_service: AuditService) -> Self {
        Self { pool, audit_service }
    }

    /// Activate test mode for a user
    pub async fn activate(
        &self,
        user_id: Uuid,
        test_suite: Option<String>,
        test_run_id: Option<String>,
        justification: String,
        duration_minutes: Option<i32>,
        ip: Option<String>,
        user_agent: Option<String>,
    ) -> Result<TestModeSession, TestModeError> {
        // Check if already active
        if self.is_active(user_id).await? {
            return Err(TestModeError::AlreadyActive);
        }

        // Validate and clamp duration (15 min to 8 hours, default 2 hours)
        let duration = duration_minutes.unwrap_or(120).clamp(15, 480);
        
        let activated_at = Utc::now();
        let expires_at = activated_at + Duration::minutes(duration as i64);
        let suite = test_suite.unwrap_or_else(|| "manual".to_string());

        // Create session
        let session = sqlx::query_as::<_, TestModeSession>(
            r#"
            INSERT INTO test_mode_sessions 
                (user_id, test_suite, test_run_id, justification, activated_at, expires_at, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#
        )
        .bind(user_id)
        .bind(&suite)
        .bind(test_run_id.as_deref())
        .bind(&justification)
        .bind(activated_at)
        .bind(expires_at)
        .bind(ip.as_deref())
        .bind(user_agent.as_deref())
        .fetch_one(&self.pool)
        .await?;

        // Audit log is handled by trigger

        Ok(session)
    }

    /// Deactivate test mode for a user
    pub async fn deactivate(&self, user_id: Uuid) -> Result<TestModeSession, TestModeError> {
        let session = sqlx::query_as::<_, TestModeSession>(
            r#"
            UPDATE test_mode_sessions
            SET ended_at = NOW()
            WHERE user_id = $1
            AND ended_at IS NULL
            AND expires_at > NOW()
            RETURNING *
            "#
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(TestModeError::NotActive)?;

        // Audit log is handled by trigger

        Ok(session)
    }

    /// Check if user has active test mode session
    pub async fn is_active(&self, user_id: Uuid) -> Result<bool, TestModeError> {
        let is_active = sqlx::query_scalar::<_, bool>(
            "SELECT is_in_test_mode($1)"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(is_active)
    }

    /// Get test mode status for a user
    pub async fn get_status(&self, user_id: Uuid) -> Result<TestModeStatus, TestModeError> {
        let session = sqlx::query_as::<_, TestModeSession>(
            r#"
            SELECT *
            FROM test_mode_sessions
            WHERE user_id = $1
            AND ended_at IS NULL
            AND expires_at > NOW()
            ORDER BY activated_at DESC
            LIMIT 1
            "#
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        let is_active = session.is_some();
        let minutes_remaining = session.as_ref().map(|s| {
            let remaining = s.expires_at - Utc::now();
            remaining.num_seconds() as f64 / 60.0
        });

        Ok(TestModeStatus {
            is_active,
            session,
            minutes_remaining,
        })
    }

    /// Get active session for a user (for context setting)
    pub async fn get_active_session(&self, user_id: Uuid) -> Result<Option<TestModeSession>, TestModeError> {
        let session = sqlx::query_as::<_, TestModeSession>(
            r#"
            SELECT *
            FROM test_mode_sessions
            WHERE user_id = $1
            AND ended_at IS NULL
            AND expires_at > NOW()
            ORDER BY activated_at DESC
            LIMIT 1
            "#
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(session)
    }

    /// List all active test mode sessions (admin only)
    pub async fn list_active_sessions(&self) -> Result<Vec<TestModeSession>, TestModeError> {
        let sessions = sqlx::query_as::<_, TestModeSession>(
            r#"
            SELECT *
            FROM test_mode_sessions
            WHERE ended_at IS NULL
            AND expires_at > NOW()
            ORDER BY activated_at DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(sessions)
    }

    /// End expired sessions (maintenance task)
    pub async fn end_expired_sessions(&self) -> Result<Vec<Uuid>, TestModeError> {
        let ended_ids = sqlx::query_scalar::<_, Uuid>(
            "SELECT ended_session_id FROM end_expired_test_mode_sessions()"
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(ended_ids)
    }

    /// Mark an entity as test data in the context of a session
    pub async fn mark_entity_in_session(
        &self,
        entity_id: Uuid,
        session_id: Uuid,
        test_name: Option<&str>,
    ) -> Result<(), TestModeError> {
        sqlx::query(
            "SELECT mark_entity_in_test_session($1, $2, $3, $4)"
        )
        .bind(entity_id)
        .bind(session_id)
        .bind("manual")
        .bind(test_name)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Set test mode context for current transaction
    /// This enables auto-marking of entities created in this transaction
    pub async fn set_test_mode_context(
        &self,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        user_id: Uuid,
        session_id: Uuid,
        test_suite: &str,
    ) -> Result<(), TestModeError> {
        sqlx::query(&format!(
            "SET LOCAL app.test_mode_user_id = '{}'; \
             SET LOCAL app.test_mode_session_id = '{}'; \
             SET LOCAL app.test_suite = '{}'",
            user_id, session_id, test_suite
        ))
        .execute(&mut **transaction)
        .await?;

        Ok(())
    }
}
