use super::models::{FirefighterSession, FirefighterStatus};
use crate::features::auth::models::User;
use crate::features::auth::service::AuthError;
use crate::features::ontology::service::OntologyService;
use crate::features::system::AuditService;
use argon2::{password_hash::PasswordHash, Argon2, PasswordVerifier};
use chrono::{Duration, Utc};
use sqlx::PgPool;
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum FirefighterError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Authentication error: {0}")]
    AuthError(#[from] AuthError),

    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Session not found")]
    NotFound,
}

#[derive(Clone)]
pub struct FirefighterService {
    pool: PgPool,
    audit_service: AuditService,
    ontology_service: OntologyService,
}

impl FirefighterService {
    pub fn new(
        pool: PgPool,
        audit_service: AuditService,
        ontology_service: OntologyService,
    ) -> Self {
        Self {
            pool,
            audit_service,
            ontology_service,
        }
    }

    /// Request firefighter mode (with password verification)
    pub async fn request_elevation(
        &self,
        user_id: Uuid,
        password: &str,
        justification: String,
        duration_minutes: Option<i32>,
        ip: Option<String>,
        user_agent: Option<String>,
    ) -> Result<FirefighterSession, FirefighterError> {
        // 1. Find user and verify password
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(&self.pool)
            .await?;

        let parsed_hash = PasswordHash::new(&user.password_hash)
            .map_err(|_| FirefighterError::InvalidCredentials)?;

        if Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_err()
        {
            return Err(FirefighterError::InvalidCredentials);
        }

        // 2. Find superadmin role entity ID
        let role_class = self
            .ontology_service
            .get_system_class("Role")
            .await
            .map_err(|e| FirefighterError::Forbidden(format!("Ontology error: {}", e)))?;

        let superadmin_role = sqlx::query_as::<_, crate::features::ontology::models::Entity>(
            "SELECT * FROM entities WHERE display_name = 'superadmin' AND class_id = $1",
        )
        .bind(role_class.id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| FirefighterError::Forbidden("Superadmin role not found".to_string()))?;

        // 3. Create session
        let activated_at = Utc::now();
        let duration = duration_minutes.unwrap_or(60).clamp(15, 480);
        let expires_at = activated_at + Duration::minutes(duration as i64);

        let session = sqlx::query_as::<_, FirefighterSession>(
            r#"
            INSERT INTO firefighter_sessions 
                (user_id, elevated_role_id, justification, activated_at, expires_at, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#
        )
        .bind(user_id)
        .bind(superadmin_role.id)
        .bind(justification.clone())
        .bind(activated_at)
        .bind(expires_at)
        .bind(ip.clone())
        .bind(user_agent.clone())
        .fetch_one(&self.pool)
        .await?;

        // 4. Audit Log
        let _ = self
            .audit_service
            .log(
                user_id,
                "firefighter.activated",
                "firefighter_session",
                Some(session.id),
                None,
                Some(serde_json::json!({
                    "justification": justification,
                    "duration_minutes": duration,
                    "ip": ip,
                    "user_agent": user_agent,
                })),
                None,
            )
            .await;

        Ok(session)
    }

    /// Check if user has active firefighter session
    pub async fn get_active_session(
        &self,
        user_id: Uuid,
    ) -> Result<Option<FirefighterSession>, FirefighterError> {
        let session = sqlx::query_as::<_, FirefighterSession>(
            r#"
            SELECT * FROM firefighter_sessions 
            WHERE user_id = $1 
              AND deactivated_at IS NULL 
              AND expires_at > NOW()
            ORDER BY activated_at DESC
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(session)
    }

    /// Get current status
    pub async fn get_status(&self, user_id: Uuid) -> Result<FirefighterStatus, FirefighterError> {
        let session = self.get_active_session(user_id).await?;
        Ok(FirefighterStatus {
            is_active: session.is_some(),
            session,
        })
    }

    /// Deactivate firefighter mode
    pub async fn deactivate(
        &self,
        user_id: Uuid,
        reason: Option<String>,
    ) -> Result<(), FirefighterError> {
        let session = self
            .get_active_session(user_id)
            .await?
            .ok_or(FirefighterError::NotFound)?;

        let now = Utc::now();
        sqlx::query(
            "UPDATE firefighter_sessions SET deactivated_at = $1, deactivation_reason = $2 WHERE id = $3"
        )
        .bind(now)
        .bind(reason.clone())
        .bind(session.id)
        .execute(&self.pool)
        .await?;

        // Audit Log
        let _ = self
            .audit_service
            .log(
                user_id,
                "firefighter.deactivated",
                "firefighter_session",
                Some(session.id),
                None,
                Some(serde_json::json!({ "reason": reason })),
                None,
            )
            .await;

        Ok(())
    }

    /// List sessions (admin/audit view)
    pub async fn list_sessions(
        &self,
        user_id: Option<Uuid>,
        active_only: bool,
        limit: i64,
    ) -> Result<Vec<FirefighterSession>, FirefighterError> {
        let mut query = String::from("SELECT * FROM firefighter_sessions WHERE 1=1");
        if let Some(uid) = user_id {
            query.push_str(&format!(" AND user_id = '{}'", uid));
        }
        if active_only {
            query.push_str(" AND deactivated_at IS NULL AND expires_at > NOW()");
        }
        query.push_str(" ORDER BY activated_at DESC LIMIT $1");

        let sessions = sqlx::query_as::<_, FirefighterSession>(&query)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?;

        Ok(sessions)
    }
}
