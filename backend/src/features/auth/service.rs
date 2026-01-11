use crate::features::auth::models::{User, RegisterUser, LoginUser, AuthResponse};
use crate::config::Config;
use sqlx::{Row, PgPool};
use uuid::Uuid;
// use bcrypt::{hash, verify}; // Removed bcrypt
use argon2::{
    password_hash::{
        rand_core::OsRng,
        PasswordHash, PasswordHasher, PasswordVerifier, SaltString
    },
    Argon2
};
use chrono::{Utc, DateTime, Duration};
use crate::features::auth::jwt::{create_jwt, create_refresh_token, UserRoleClaim};
use crate::features::abac::AbacService;
use crate::features::users::service::UserService;
use thiserror::Error;
use axum::response::IntoResponse;
use axum::http::StatusCode;
use serde::{Serialize, Deserialize};
use tokio::sync::broadcast;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct NotificationEvent {
    pub user_id: String,
    pub message: String,
    pub id: i64,
    pub created_at: String,
}

#[derive(Error, Debug)]
pub enum AuthError {
    #[error("User already exists")]
    UserExists,

    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("JWT error: {0}")]
    JwtError(String),

    #[error("Password hash error: {0}")]
    PasswordHashError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),
    
    #[error("Refresh token not found or invalid")]
    InvalidRefreshToken,

    #[error("User not found")]
    UserNotFound,
}

impl AuthError {
    pub fn to_status_code(&self) -> StatusCode {
        match self {
            Self::UserExists => StatusCode::CONFLICT,
            Self::InvalidCredentials => StatusCode::UNAUTHORIZED,
            Self::InvalidRefreshToken => StatusCode::UNAUTHORIZED,
            Self::UserNotFound => StatusCode::NOT_FOUND,
            Self::ValidationError(_) => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Clone)]
pub struct AuthService {
    pool: PgPool,
    config: Config,
    abac_service: AbacService,
    pub user_service: UserService,
    pub audit_service: crate::features::system::AuditService,
    notification_tx: broadcast::Sender<NotificationEvent>,
}

impl AuthService {
    pub fn new(pool: PgPool, config: Config, abac_service: AbacService, user_service: UserService, audit_service: crate::features::system::AuditService) -> Self {
        let (notification_tx, _) = broadcast::channel(100);
        Self { pool, config, abac_service, user_service, audit_service, notification_tx }
    }

    pub fn get_user_service(&self) -> &UserService {
        &self.user_service
    }

    pub fn get_abac_service(&self) -> &AbacService {
        &self.abac_service
    }

    /// Fetch user roles from ABAC and convert to claims format
    async fn get_user_role_claims(&self, user_id: &str) -> Vec<UserRoleClaim> {
        self.abac_service
            .get_user_roles(user_id)
            .await
            .map(|assignments| {
                assignments
                    .into_iter()
                    .map(|a| UserRoleClaim {
                        role_name: a.role_name,
                        resource_id: a.resource_id.map(|id| id.to_string()),
                    })
                    .collect()
            })
            .unwrap_or_default() // On error, return empty roles
    }

    pub async fn register(&self, user: RegisterUser) -> Result<AuthResponse, AuthError> {
        // Check if user already exists
        let existing_user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
            .bind(&user.email)
            .fetch_optional(&self.pool)
            .await?;

        if existing_user.is_some() {
            return Err(AuthError::UserExists);
        }

        // Hash password with Argon2
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2.hash_password(user.password.as_bytes(), &salt)
            .map_err(|e| AuthError::PasswordHashError(e.to_string()))?
            .to_string();

        let id = Uuid::new_v4();

        // Insert user
        let created_user = sqlx::query_as::<_, User>(
            "INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *"
        )
        .bind(id)
        .bind(&user.username)
        .bind(&user.email)
        .bind(&password_hash)
        .bind(Utc::now())
        .bind(Utc::now())
        .fetch_one(&self.pool)
        .await?;

        // Generate tokens
        self.generate_tokens(created_user.id, created_user.username, created_user.email, created_user.tenant_id, false, None, None).await
    }

    pub async fn login(&self, login_user: LoginUser, ip: Option<String>, user_agent: Option<String>) -> Result<AuthResponse, AuthError> {
        // Find user by email or username
        let found_user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1 OR username = $1")
            .bind(&login_user.identifier)
            .fetch_optional(&self.pool)
            .await?;

        let user = found_user.ok_or(AuthError::InvalidCredentials)?;

        // Verify password with Argon2
        let parsed_hash = PasswordHash::new(&user.password_hash).map_err(|_| AuthError::InvalidCredentials)?;
        if Argon2::default().verify_password(login_user.password.as_bytes(), &parsed_hash).is_err() {
             return Err(AuthError::InvalidCredentials);
        }

        // Device / new IP detection: compare stored last_login_ip and user_agent
        let mut is_new_device = false;
        if let Some(stored_ip) = &user.last_login_ip {
            if let Some(current_ip) = &ip {
                if stored_ip != current_ip {
                    is_new_device = true;
                }
            }
        } else if ip.is_some() {
            is_new_device = true;
        }

        if let Some(stored_ua) = &user.last_user_agent {
            if let Some(current_ua) = &user_agent {
                if stored_ua != current_ua {
                    is_new_device = true;
                }
            }
        } else if user_agent.is_some() {
            is_new_device = true;
        }

        // If new device/IP detected, create an in-app notification and (optionally) email
        if is_new_device {
            tracing::info!("New device detected for user {}", user.id);
            let msg = format!("New sign-in detected from IP {} and device/agent {}", ip.clone().unwrap_or_default(), user_agent.clone().unwrap_or_default());
            match self.create_notification(&user.id.to_string(), &msg).await {
                Ok(_) => tracing::info!("Notification created successfully"),
                Err(e) => tracing::error!("Failed to create notification: {}", e),
            }
        }

        // Update last login metadata
        tracing::info!("Updating last login metadata for user {}", user.id);
        let _ = sqlx::query("UPDATE users SET last_login_ip = $1, last_user_agent = $2, last_login_at = $3, updated_at = $4 WHERE id = $5")
            .bind(ip.clone())
            .bind(user_agent.clone())
            .bind(Utc::now())
            .bind(Utc::now())
            .bind(&user.id)
            .execute(&self.pool)
            .await;

        // 6. Log the login
        let _ = self.audit_service.log(
            user.id,
            "auth.login",
            "user",
            Some(user.id),
            None,
            None,
            Some(serde_json::json!({ 
                "ip": ip, 
                "user_agent": user_agent, 
                "new_device": is_new_device 
            })),
        ).await;

        // Generate tokens
        tracing::info!("Generating tokens for user {}", user.id);
        let token_res = self.generate_tokens(
            user.id, 
            user.username, 
            user.email, 
            user.tenant_id, 
            login_user.remember_me.unwrap_or(false),
            ip,
            user_agent
        ).await;
        
        if let Err(ref e) = token_res {
             tracing::error!("Token generation failed: {:?}", e);
        }
        token_res
    }

    /// Change a user's password given their email, current password and new password.
    pub async fn change_password(&self, email: &str, current_password: &str, new_password: &str) -> Result<(), AuthError> {
        // Fetch user
        let found_user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
            .bind(email)
            .fetch_optional(&self.pool)
            .await?;

        let user = found_user.ok_or(AuthError::InvalidCredentials)?;

        // Verify current password (Argon2)
        let parsed_hash = PasswordHash::new(&user.password_hash).map_err(|_| AuthError::InvalidCredentials)?;
        if Argon2::default().verify_password(current_password.as_bytes(), &parsed_hash).is_err() {
             return Err(AuthError::InvalidCredentials);
        }

        // Hash new password (Argon2)
        let salt = SaltString::generate(&mut OsRng);
        let new_hash = Argon2::default().hash_password(new_password.as_bytes(), &salt)
            .map_err(|e| AuthError::PasswordHashError(e.to_string()))?
            .to_string();

        // Update password in DB
        sqlx::query(
            "UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3"
        )
        .bind(&new_hash)
        .bind(Utc::now())
        .bind(&user.id)
        .execute(&self.pool)
        .await?;

        self.create_notification(&user.id.to_string(), "Your password was successfully changed.").await?;

        // Log password change
        let _ = self.audit_service.log(
            user.id,
            "auth.password.change",
            "user",
            Some(user.id),
            None,
            None,
            None,
        ).await;

        Ok(())
    }

    async fn generate_tokens(
        &self, 
        user_id: Uuid, 
        username: String, 
        email: String, 
        tenant_id: Option<Uuid>,
        remember_me: bool,
        ip: Option<String>,
        user_agent: Option<String>,
    ) -> Result<AuthResponse, AuthError> {
        // Fetch user roles and permissions
        let roles = self.get_user_role_claims(&user_id.to_string()).await;
        let permissions = self.get_user_permissions(&user_id.to_string()).await.unwrap_or_default();
        
        let access_token = match create_jwt(&user_id.to_string(), &username, &email, roles.clone(), permissions.clone(), &self.config) {
            Ok(t) => t,
            Err(e) => {
                tracing::error!(error = ?e, "create_jwt failed");
                return Err(AuthError::JwtError(e.to_string()));
            }
        };
        let (refresh_token, refresh_jti) = match create_refresh_token(&user_id.to_string(), &username, &email, roles, permissions, &self.config) {
            Ok((t, j)) => (t, j),
            Err(e) => {
                tracing::error!(error = ?e, "create_refresh_token failed");
                return Err(AuthError::JwtError(e.to_string()));
            }
        };

        // Store the refresh token jti in the DB with metadata
        let expires_at = Utc::now() + Duration::seconds(self.config.refresh_token_expiry);
        sqlx::query(
            r#"
            INSERT INTO refresh_tokens (token_id, user_id, tenant_id, expires_at, ip_address, user_agent, created_at) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#
        )
        .bind(&refresh_jti)
        .bind(user_id)
        .bind(tenant_id)
        .bind(expires_at)
        .bind(ip)
        .bind(user_agent)
        .bind(Utc::now())
        .execute(&self.pool)
        .await?;

        Ok(AuthResponse {
            access_token,
            refresh_token,
            expires_in: self.config.jwt_expiry,
            remember_me,
        })
    }

    pub async fn refresh_token(&self, refresh_token: String) -> Result<AuthResponse, AuthError> {
        // Validate the refresh token
        let claims = crate::features::auth::jwt::validate_jwt(&refresh_token, &self.config)
            .map_err(|e| AuthError::JwtError(e.to_string()))?;

        // Determine if this was a remembered session by checking if we have an existing refresh token jti
        // Note: For simplicity, we'll assume if they have a valid refresh token, we should maintain the "remembered" state if it was already there.
        // In a more complex system, you might store this in the token or DB.
        // For now, let's keep it simple: refresh always returns remember_me=true if called with a valid cookie.

        // Check if refresh token jti exists in database (not blacklisted)
        let user_uuid = Uuid::parse_str(&claims.sub).map_err(|e| AuthError::JwtError(e.to_string()))?;
        let token_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM refresh_tokens WHERE token_id = $1 AND user_id = $2 AND expires_at > $3)"
        )
        .bind(&claims.jti)
        .bind(user_uuid)
        .bind(Utc::now())
        .fetch_one(&self.pool)
        .await?;

        if !token_exists {
            return Err(AuthError::InvalidRefreshToken);
        }

        // Blacklist the old refresh token jti
        sqlx::query(
            "UPDATE refresh_tokens SET revoked_at = $1 WHERE token_id = $2"
        )
        .bind(Utc::now())
        .bind(&claims.jti)
        .execute(&self.pool)
        .await?;

        // Generate new tokens (passing None for IP/UA for now on refresh, or ideally keep track)
        // We'll search for the current user to get tenant_id
        let user = self.user_service.find_by_id(&claims.sub).await?;
        
        self.generate_tokens(
            user.id, 
            user.username, 
            user.email, 
            user.tenant_id, 
            true, 
            None, 
            None
        ).await
    }

    pub async fn delete_users_by_prefix(&self, prefix: &str) -> Result<(), AuthError> {
        let pattern = format!("{}%", prefix);
        sqlx::query("DELETE FROM users WHERE email LIKE $1")
            .bind(pattern)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
    
    // Notifications
    pub async fn create_notification(&self, user_id: &str, message: &str) -> Result<(), AuthError> {
        let user_uuid = Uuid::parse_str(user_id).map_err(|_| AuthError::UserNotFound)?;
        let created_at = Utc::now();
        let id: i32 = sqlx::query_scalar("INSERT INTO notifications (user_id, message, read, created_at) VALUES ($1, $2, FALSE, $3) RETURNING id")
            .bind(user_uuid)
            .bind(message)
            .bind(Utc::now())
            .fetch_one(&self.pool)
            .await?;

        let _ = self.notification_tx.send(NotificationEvent {
            user_id: user_id.to_string(),
            message: message.to_string(),
            id: id as i64,
            created_at: created_at.to_rfc3339(),
        });

        Ok(())
    }

    pub async fn get_notifications(&self, user_id: &str) -> Result<Vec<(i64, String, i64, String)>, AuthError> {
        let user_uuid = Uuid::parse_str(user_id).map_err(|_| AuthError::UserNotFound)?;
        let rows = sqlx::query("SELECT id, message, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC")
            .bind(user_uuid)
            .fetch_all(&self.pool)
            .await?;
        let mut out = Vec::new();
        for r in rows {
            let id: i32 = r.try_get("id")?;
            let message: String = r.try_get("message")?;
            // Cast boolean to i64 for compatibility if needed, or change return type.
            // But preserving signature:
            let read_bool: bool = r.try_get("read")?;
            let read: i64 = if read_bool { 1 } else { 0 };
            let created_at: DateTime<Utc> = r.try_get("created_at")?; // Timestamptz to DateTime
            out.push((id as i64, message, read, created_at.to_rfc3339()));
        }
        Ok(out)
    }

    pub async fn mark_notification_read(&self, notification_id: i64, user_id: &str) -> Result<(), AuthError> {
        let user_uuid = Uuid::parse_str(user_id).map_err(|_| AuthError::UserNotFound)?;
        sqlx::query("UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2")
            .bind(notification_id as i32)
            .bind(user_uuid)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn mark_all_notifications_read(&self, user_id: &str) -> Result<(), AuthError> {
        let user_uuid = Uuid::parse_str(user_id).map_err(|_| AuthError::UserNotFound)?;
        sqlx::query("UPDATE notifications SET read = TRUE WHERE user_id = $1")
            .bind(user_uuid)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub fn subscribe_notifications(&self) -> broadcast::Receiver<NotificationEvent> {
        self.notification_tx.subscribe()
    }
    
    // Method to logout and blacklist refresh token
    pub async fn logout(&self, refresh_token: String) -> Result<(), AuthError> {
        sqlx::query(
            "UPDATE refresh_tokens SET revoked_at = $1 WHERE token_id = $2"
        )
        .bind(Utc::now())
        .bind(&refresh_token)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_active_sessions(&self, user_id: Uuid, current_token_id: Option<String>) -> Result<Vec<crate::features::auth::models::SessionResponse>, AuthError> {
        let sessions = sqlx::query_as::<_, crate::features::auth::models::RefreshToken>(
            "SELECT * FROM refresh_tokens WHERE user_id = $1 AND (revoked_at IS NULL AND expires_at > $2) ORDER BY created_at DESC"
        )
        .bind(user_id)
        .bind(Utc::now())
        .fetch_all(&self.pool)
        .await?;

        Ok(sessions.into_iter().map(|s| {
            crate::features::auth::models::SessionResponse {
                is_current: current_token_id.as_ref().map(|id| id == &s.token_id).unwrap_or(false),
                id: s.token_id,
                created_at: s.created_at,
                expires_at: s.expires_at,
                user_agent: s.user_agent,
                ip_address: s.ip_address,
            }
        }).collect())
    }

    pub async fn list_all_sessions(&self, limit: i64) -> Result<Vec<crate::features::auth::models::AdminSessionResponse>, AuthError> {
        let sessions = sqlx::query_as::<_, crate::features::auth::models::AdminSessionResponse>(
            r#"
            SELECT rt.token_id as id, rt.user_id, u.username, u.email, 
                   rt.created_at, rt.expires_at, rt.user_agent, rt.ip_address
            FROM refresh_tokens rt
            JOIN users u ON rt.user_id = u.id
            WHERE rt.revoked_at IS NULL AND rt.expires_at > $1
            ORDER BY rt.created_at DESC
            LIMIT $2
            "#
        )
        .bind(Utc::now())
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(sessions)
    }

    pub async fn revoke_session(&self, user_id: Uuid, token_id: &str) -> Result<(), AuthError> {
        let result = sqlx::query(
            "UPDATE refresh_tokens SET revoked_at = $1 WHERE token_id = $2 AND user_id = $3"
        )
        .bind(Utc::now())
        .bind(token_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AuthError::UserNotFound); // Or a more specific SessionNotFound
        }

        // Log revocation
        let _ = self.audit_service.log(
            user_id,
            "auth.session.revoke",
            "refresh_token",
            None,
            None,
            None,
            Some(serde_json::json!({ "token_id": token_id })),
        ).await;

        Ok(())
    }

    pub async fn revoke_any_session(&self, token_id: &str, admin_id: Uuid) -> Result<(), AuthError> {
        let result = sqlx::query(
            "UPDATE refresh_tokens SET revoked_at = $1 WHERE token_id = $2"
        )
        .bind(Utc::now())
        .bind(token_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AuthError::UserNotFound); // Or SessionNotFound
        }

        // Log revocation
        let _ = self.audit_service.log(
            admin_id,
            "auth.session.revoke_admin",
            "refresh_token",
            None,
            None,
            None,
            Some(serde_json::json!({ "token_id": token_id })),
        ).await;

        Ok(())
    }

    /// Fetch all effective permissions for a user (combining ABAC and ReBAC)
    pub async fn get_user_permissions(&self, user_id: &str) -> Result<Vec<String>, AuthError> {
        let user_uuid = Uuid::parse_str(user_id).map_err(|_| AuthError::UserNotFound)?;
        
        let v_now = Utc::now();
        let legacy_roles = sqlx::query_scalar::<_, Uuid>(
            "SELECT role_id FROM user_roles 
             WHERE user_id = $1 
             AND (valid_from IS NULL OR valid_from <= $2) 
             AND (valid_until IS NULL OR valid_until > $2)"
        )
        .bind(user_uuid)
        .bind(v_now)
        .fetch_all(&self.pool)
        .await?;

        // Scoped User Roles (check validity)
        // We fetch struct to check active status in Rust
        let scoped_roles = sqlx::query_as::<_, crate::features::rebac::models::ScopedUserRole>(
            "SELECT * FROM scoped_user_roles 
             WHERE user_id = $1 
             AND revoked_at IS NULL
             AND (valid_from IS NULL OR valid_from <= $2)
             AND (valid_until IS NULL OR valid_until > $2)"
        )
        .bind(user_uuid)
        .bind(v_now)
        .fetch_all(&self.pool)
        .await?;

        let mut active_role_ids = legacy_roles;
        for role in scoped_roles {
            if crate::features::rebac::RebacService::is_role_active(&role) {
                active_role_ids.push(role.role_id);
            }
        }

        if active_role_ids.is_empty() {
            return Ok(Vec::new());
        }

        // Deduplicate
        active_role_ids.sort();
        active_role_ids.dedup();

        // 2. Fetch permissions for these roles
        let mut all_perms: Vec<(String, String)> = Vec::new();

        // Legacy actions
        let legacy_actions = sqlx::query_as::<_, (String, String)>(
            "SELECT action, effect FROM permissions WHERE role_id = ANY($1)"
        )
        .bind(&active_role_ids)
        .fetch_all(&self.pool)
        .await?;
        all_perms.extend(legacy_actions);

        // ReBAC permission types
        let rebac_perms = sqlx::query_as::<_, (String, String)>(
            r#"
            SELECT pt.name, rpt.effect 
            FROM role_permission_types rpt
            JOIN permission_types pt ON rpt.permission_type_id = pt.id
            WHERE rpt.role_id = ANY($1)
            "#
        )
        .bind(&active_role_ids)
        .fetch_all(&self.pool)
        .await?;
        all_perms.extend(rebac_perms);

        // Deduplicate and process Deny
        let mut allows = std::collections::HashSet::new();
        let mut denies = std::collections::HashSet::new();

        for (name, effect) in all_perms {
            if effect == "DENY" {
                denies.insert(name);
            } else {
                allows.insert(name);
            }
        }

        // Combined: Allowed minus Denied
        let mut final_permissions: Vec<String> = allows
            .into_iter()
            .filter(|p| !denies.contains(p))
            .collect();

        final_permissions.sort();

        Ok(final_permissions)
    }
}

impl AuthService {
    /// Return total number of users.
    pub async fn count_users(&self) -> Result<i64, AuthError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
            .fetch_one(&self.pool)
            .await?;
        Ok(count.0)
    }

    /// Return number of active (non-expired) refresh tokens.
    pub async fn count_active_refresh_tokens(&self) -> Result<i64, AuthError> {
        let _now = Utc::now().timestamp();
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM refresh_tokens WHERE expires_at > $1",
        )
        .bind(Utc::now())
        .fetch_one(&self.pool)
        .await?;
        Ok(count.0)
    }
    
    /// Return recent users ordered by creation date descending.
    pub async fn recent_users(&self, limit: i64) -> Result<Vec<User>, AuthError> {
        let users = sqlx::query_as::<_, User>(
            "SELECT * FROM users ORDER BY created_at DESC LIMIT $1"
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(users)
    }
}

impl IntoResponse for AuthError {
    fn into_response(self) -> axum::response::Response {
        let status = match self {
            AuthError::UserExists => StatusCode::CONFLICT,
            AuthError::InvalidCredentials => StatusCode::UNAUTHORIZED,
            AuthError::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AuthError::JwtError(_) => StatusCode::UNAUTHORIZED,
            AuthError::PasswordHashError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AuthError::ValidationError(_) => StatusCode::BAD_REQUEST,
            AuthError::InvalidRefreshToken => StatusCode::UNAUTHORIZED,
            AuthError::UserNotFound => StatusCode::NOT_FOUND,
        };

        (status, self.to_string()).into_response()
    }
}

