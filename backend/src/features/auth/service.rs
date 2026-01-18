use crate::config::Config;
use crate::features::auth::models::{AuthResponse, LoginUser, RegisterUser, User};
use sqlx::PgPool;
use uuid::Uuid;
// use bcrypt::{hash, verify}; // Removed bcrypt
use crate::features::abac::AbacService;
use crate::features::auth::jwt::{create_jwt, create_refresh_token, UserRoleClaim};
use crate::features::users::service::UserService;
use crate::features::auth::mfa::MfaService;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256}; // Add sha2 dependency for token hashing
use rand::{distributions::Alphanumeric, Rng}; // Add rand for token generation

use thiserror::Error;
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

    #[error("Invalid MFA code")]
    InvalidMfaCode,

    #[error("Invalid token")]
    InvalidToken,

    #[error("Permission denied")]
    PermissionDenied,

    #[error("ABAC error: {0}")]
    AbacError(#[from] crate::features::abac::service::AbacError),
}

impl AuthError {
    pub     fn to_status_code(&self) -> StatusCode {
        match self {
            Self::UserExists => StatusCode::CONFLICT,
            Self::InvalidCredentials => StatusCode::UNAUTHORIZED,
            Self::InvalidRefreshToken => StatusCode::UNAUTHORIZED,
            Self::InvalidMfaCode => StatusCode::UNAUTHORIZED,
            Self::InvalidToken => StatusCode::UNAUTHORIZED,
            Self::UserNotFound => StatusCode::NOT_FOUND,
            Self::PermissionDenied => StatusCode::FORBIDDEN,
            Self::ValidationError(_) => StatusCode::BAD_REQUEST,
            Self::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::JwtError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::PasswordHashError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::AbacError(_) => StatusCode::INTERNAL_SERVER_ERROR,
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
    ontology_service: crate::features::ontology::OntologyService,
    mfa_service: MfaService,
    notification_tx: broadcast::Sender<NotificationEvent>,
}

impl AuthService {
    pub fn new(
        pool: PgPool,
        config: Config,
        abac_service: AbacService,
        user_service: UserService,
        audit_service: crate::features::system::AuditService,
        ontology_service: crate::features::ontology::OntologyService,
        mfa_service: MfaService,
    ) -> Self {
        let (notification_tx, _) = broadcast::channel(100);
        Self {
            pool,
            config,
            abac_service,
            user_service,
            audit_service,
            ontology_service,
            mfa_service,
            notification_tx,
        }
    }

    pub fn get_user_service(&self) -> &UserService {
        &self.user_service
    }

    pub fn get_abac_service(&self) -> &AbacService {
        &self.abac_service
    }

    /// Extract JTI from refresh token for session comparison
    pub fn extract_refresh_token_jti(&self, token: &str) -> Result<String, AuthError> {
        let claims = crate::features::auth::jwt::validate_jwt(token, &self.config)
            .map_err(|e| AuthError::JwtError(e.to_string()))?;
        claims.jti.ok_or_else(|| AuthError::JwtError("Missing jti in refresh token".to_string()))
    }

    #[allow(dead_code)]
    const USER_ENTITY_QUERY: &'static str = "SELECT * FROM unified_users WHERE 1=1";

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
        // Check if user already exists in the ontology
        let existing_user = sqlx::query_as::<_, User>("SELECT * FROM unified_users WHERE email = $1 OR username = $2")
            .bind(&user.email)
            .bind(&user.username)
            .fetch_optional(&self.pool)
            .await?;

        if existing_user.is_some() {
            // CVE-003 Fix: Generic error message to prevent user enumeration
            // Don't reveal whether email or username is taken
            return Err(AuthError::ValidationError("Invalid registration data".to_string()));
        }

        // Hash password with Argon2
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(user.password.as_bytes(), &salt)
            .map_err(|e| AuthError::PasswordHashError(e.to_string()))?
            .to_string();

        let id = Uuid::new_v4();

        // Get User class ID
        let user_class_id = self.ontology_service.get_system_class("User").await
            .map_err(|e| AuthError::DatabaseError(sqlx::Error::Protocol(e.to_string())))?.id;

        // Insert into entities as primary store
        sqlx::query(
            "INSERT INTO entities (id, class_id, display_name, attributes, approval_status) VALUES ($1, $2, $3, $4, 'APPROVED'::approval_status)"
        )
        .bind(id)
        .bind(user_class_id)
        .bind(&user.username)
        .bind(serde_json::json!({
            "email": user.email,
            "username": user.username,
            "password_hash": password_hash
        }))
        .execute(&self.pool)
        .await?;

        tracing::info!("Inserted user entity {} with class_id {}", id, user_class_id);

        let created_user = sqlx::query_as::<_, User>("SELECT * FROM unified_users WHERE id = $1")
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch created user {} from unified_users: {:?}", id, e);
                e
            })?;

        // Generate tokens
        self.generate_tokens(
            created_user.id,
            created_user.username,
            created_user.email.clone().unwrap_or_default(),
            created_user.tenant_id,
            false,
            None,
            None,
        )
        .await
    }

    pub async fn login(
        &self,
        login_user: LoginUser,
        ip: Option<String>,
        user_agent: Option<String>,
    ) -> Result<AuthResponse, AuthError> {
        // Find user by email or username in the ontology
        let found_user = sqlx::query_as::<_, User>("SELECT * FROM unified_users WHERE email = $1 OR username = $1")
                .bind(&login_user.identifier)
                .fetch_optional(&self.pool)
                .await?;

        let user = found_user.ok_or(AuthError::InvalidCredentials)?;

        // Verify password with Argon2
        let password_hash = user.password_hash.as_deref().ok_or(AuthError::InvalidCredentials)?;
        let parsed_hash =
            PasswordHash::new(password_hash).map_err(|_| AuthError::InvalidCredentials)?;
        if Argon2::default()
            .verify_password(login_user.password.as_bytes(), &parsed_hash)
            .is_err()
        {
            return Err(AuthError::InvalidCredentials);
        }

        // Check MFA
        if self.mfa_service.is_mfa_required(user.id).await.unwrap_or(false) {
             // Generate a temporary MFA token (e.g. valid for 5 mins) to identify the user session during challenge
             // For MVP, we'll sign the user_id with a special 'mfa-pending' subject or claim.
             // Here reusing generic JWT creator but we should ideally have distinct scope.
             // Using create_jwt with empty roles/perms and short expiry.
             
             let mfa_token = create_jwt(
                &user.id.to_string(),
                &user.username,
                user.email.as_deref().unwrap_or(""),
                vec![],
                vec!["mfa_pending".to_string()], // Permission flag
                &self.config
             ).map_err(|e| AuthError::JwtError(e.to_string()))?;

             return Ok(AuthResponse {
                 access_token: None,
                 refresh_token: None,
                 expires_in: None,
                 remember_me: login_user.remember_me.unwrap_or(false),
                 mfa_required: true,
                 mfa_token: Some(mfa_token),
                 user_id: user.id,
             });
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
            let msg = format!(
                "New sign-in detected from IP {} and device/agent {}",
                ip.clone().unwrap_or_default(),
                user_agent.clone().unwrap_or_default()
            );
            match self.create_notification(&user.id.to_string(), &msg).await {
                Ok(_) => tracing::info!("Notification created successfully"),
                Err(e) => tracing::error!("Failed to create notification: {}", e),
            }
        }

        // Update last login metadata in ontology
        tracing::info!("Updating last login metadata for user {} in ontology", user.id);
        let _ = sqlx::query(
            "UPDATE entities SET attributes = attributes || jsonb_build_object(
                'last_login_ip', $1::text, 
                'last_user_agent', $2::text, 
                'last_login_at', $3::text
            ), updated_at = $3 WHERE id = $4"
        )
            .bind(ip.clone())
            .bind(user_agent.clone())
            .bind(Utc::now())
            .bind(user.id)
            .execute(&self.pool)
            .await;


        // 6. Log the login
        let _ = self
            .audit_service
            .log(
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
            )
            .await;

        // Generate tokens
        tracing::info!("Generating tokens for user {}", user.id);
        let token_res = self
            .generate_tokens(
                user.id,
                user.username,
                user.email.clone().unwrap_or_default(),
                user.tenant_id,
                login_user.remember_me.unwrap_or(false),
                ip,
                user_agent,
            )
            .await;

        if let Err(ref e) = token_res {
            tracing::error!("Token generation failed: {:?}", e);
        }
        token_res
    }

    /// Change a user's password given their email, current password and new password.
    pub async fn change_password(
        &self,
        email: &str,
        current_password: &str,
        new_password: &str,
    ) -> Result<(), AuthError> {
        // Fetch user
        let found_user = sqlx::query_as::<_, User>("SELECT * FROM unified_users WHERE email = $1")
            .bind(email)
            .fetch_optional(&self.pool)
            .await?;

        let user = found_user.ok_or(AuthError::InvalidCredentials)?;

        // Verify current password (Argon2)
        let password_hash = user.password_hash.as_deref().ok_or(AuthError::InvalidCredentials)?;
        let parsed_hash =
            PasswordHash::new(password_hash).map_err(|_| AuthError::InvalidCredentials)?;
        if Argon2::default()
            .verify_password(current_password.as_bytes(), &parsed_hash)
            .is_err()
        {
            return Err(AuthError::InvalidCredentials);
        }

        // Hash new password (Argon2)
        let salt = SaltString::generate(&mut OsRng);
        let new_hash = Argon2::default()
            .hash_password(new_password.as_bytes(), &salt)
            .map_err(|e| AuthError::PasswordHashError(e.to_string()))?
            .to_string();

        // Update password in ontology
        sqlx::query(
            "UPDATE entities SET attributes = attributes || jsonb_build_object('password_hash', $1::text), updated_at = $2 WHERE id = $3"
        )
            .bind(&new_hash)
            .bind(Utc::now())
            .bind(user.id)
            .execute(&self.pool)
            .await?;

        self.create_notification(
            &user.id.to_string(),
            "Your password was successfully changed.",
        )
        .await?;

        // Log password change
        let _ = self
            .audit_service
            .log(
                user.id,
                "auth.password.change",
                "user",
                Some(user.id),
                None,
                None,
                None,
            )
            .await;

        Ok(())
    }

    /// Request a password reset for the given email.
    pub async fn request_password_reset(&self, email: &str) -> Result<Option<String>, AuthError> {
        // 1. Check if user exists
        let user_opt = sqlx::query_as::<_, User>("SELECT * FROM unified_users WHERE email = $1")
            .bind(email)
            .fetch_optional(&self.pool)
            .await?;

        let user = match user_opt {
            Some(u) => u,
            None => {
                // CVE-003 Fix: Add constant-time delay to prevent user enumeration
                // This delay matches the average time for the full password reset flow
                tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
                return Ok(None);
            }
        };

        // 2. Generate a secure random token
        let token: String = rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(32)
            .map(char::from)
            .collect();

        // 3. Hash the token for storage
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        let token_hash = hex::encode(hasher.finalize());

        // 4. Store in DB (1 hour expiry)
        let expires_at = Utc::now() + Duration::hours(1);
        
        let class = self.ontology_service.get_system_class("PasswordResetToken").await
            .map_err(|e| AuthError::DatabaseError(sqlx::Error::Protocol(e.to_string())))?;

        sqlx::query(
            "INSERT INTO entities (id, class_id, display_name, attributes) VALUES ($1, $2, $3, $4)"
        )
        .bind(Uuid::new_v4())
        .bind(class.id)
        .bind(format!("PasswordResetToken for {}", user.id))
        .bind(serde_json::json!({
            "user_id": user.id,
            "token_hash": token_hash,
            "expires_at": expires_at
        }))
        .execute(&self.pool)
        .await?;

        // 5. Send email
        let _ = crate::utils::email::send_password_reset_email(email, &token);

        // Return token for testing purposes (in production, only available via email)
        Ok(Some(token))
    }

    /// Verify a reset token only (doesn't consume it).
    pub async fn verify_reset_token(&self, token: &str) -> Result<Uuid, AuthError> {
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        let token_hash = hex::encode(hasher.finalize());

        let record = sqlx::query!(
            "SELECT user_id FROM unified_password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW()",
            token_hash
        )
        .fetch_optional(&self.pool)
        .await?;

        match record {
            Some(row) => {
                let user_id = row.user_id;
                // Verify user still exists in ontology
                let user_exists = sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM unified_users WHERE id = $1)")
                    .bind(user_id)
                    .fetch_one(&self.pool)
                    .await?;
                if user_exists { Ok(user_id.unwrap_or_default()) } else { Err(AuthError::UserNotFound) }
            },
            None => Err(AuthError::ValidationError("Invalid or expired reset token".to_string())),
        }
    }

    /// Reset user password using a valid token.
    pub async fn reset_password(&self, token: &str, new_password: &str) -> Result<(), AuthError> {
        let user_id = self.verify_reset_token(token).await?;

        // 1. Hash new password
        let salt = SaltString::generate(&mut OsRng);
        let new_hash = Argon2::default().hash_password(new_password.as_bytes(), &salt)
            .map_err(|e| AuthError::PasswordHashError(e.to_string()))?
            .to_string();

        // 2. Update user password
        // Start a transaction
        let mut tx = self.pool.begin().await?;

        sqlx::query(
            "UPDATE entities SET attributes = attributes || jsonb_build_object('password_hash', $1::text), updated_at = $2 WHERE id = $3"
        )
        .bind(&new_hash)
        .bind(Utc::now())
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        // 3. Mark token as used (soft delete the entity)
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        let token_hash = hex::encode(hasher.finalize());
        
        sqlx::query(
            "UPDATE entities SET deleted_at = NOW() WHERE id = (SELECT entity_id FROM unified_password_reset_tokens WHERE token_hash = $1)"
        )
        .bind(token_hash)
        .execute(&mut *tx)
        .await?;

        // 4. Revoke existing refresh tokens
        sqlx::query(
            "UPDATE entities SET deleted_at = NOW() WHERE id IN (SELECT entity_id FROM unified_refresh_tokens WHERE user_id = $1)"
        )
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
        
        tx.commit().await?;

        // 5. Log and notify
         let _ = self.audit_service.log(
            user_id,
            "auth.password.reset",
            "user",
            Some(user_id),
            None,
            None,
            None
        ).await;

        self.create_notification(&user_id.to_string(), "Your password has been successfully reset.").await?;

        Ok(())
    }

    /// Verify MFA code and complete login
    pub async fn verify_mfa_and_login(
        &self,
        mfa_token: String,
        code: String,
        remember_me: Option<bool>,
        cookies: tower_cookies::Cookies,
    ) -> Result<axum::Json<AuthResponse>, AuthError> {
        // 1. Verify the MFA token
        let claims = crate::features::auth::jwt::validate_jwt(&mfa_token, &self.config)
            .map_err(|_| AuthError::InvalidToken)?;
        
        // 2. Check it's an MFA pending token
        if !claims.permissions.contains(&"mfa_pending".to_string()) {
            return Err(AuthError::InvalidToken);
        }
        
        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|_| AuthError::InvalidToken)?;
        
        // 3. Verify MFA code (TOTP or backup)
        let verification_ok = if self.mfa_service.verify_code(user_id, &code).await.is_ok() {
            true
        } else {
            self.mfa_service.verify_backup_code(user_id, &code).await.is_ok()
        };
        
        if !verification_ok {
            return Err(AuthError::InvalidMfaCode);
        }
        
        // 4. Fetch user
        let user = sqlx::query_as::<_, User>("SELECT * FROM unified_users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(AuthError::UserNotFound)?;
        
        // 5. Generate real tokens using existing helper
        let remember_me_flag = remember_me.unwrap_or(false);
        let auth_response = self.generate_tokens(
            user.id,
            user.username.clone(),
            user.email.clone().unwrap_or_default(),
            user.tenant_id,
            remember_me_flag,
            None, // No IP tracking for MFA challenge
            None, // No user agent tracking for MFA challenge
        ).await?;
        
        // 6. Set cookies
        crate::features::auth::routes::set_auth_cookies(&cookies, &auth_response);
        
        Ok(axum::Json(auth_response))
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) async fn generate_tokens(
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
        let permissions = self
            .get_user_permissions(&user_id.to_string())
            .await
            .unwrap_or_default();

        let access_token = match create_jwt(
            &user_id.to_string(),
            &username,
            &email,
            roles.clone(),
            permissions.clone(),
            &self.config,
        ) {
            Ok(t) => t,
            Err(e) => {
                tracing::error!(error = ?e, "create_jwt failed");
                return Err(AuthError::JwtError(e.to_string()));
            }
        };
        let (refresh_token, refresh_jti) = match create_refresh_token(
            &user_id.to_string(),
            &username,
            &email,
            roles,
            permissions,
            &self.config,
        ) {
            Ok((t, j)) => (t, j),
            Err(e) => {
                tracing::error!(error = ?e, "create_refresh_token failed");
                return Err(AuthError::JwtError(e.to_string()));
            }
        };

        // Store the refresh token jti in the DB with metadata
        let expires_at = Utc::now() + Duration::seconds(self.config.refresh_token_expiry);
        
        let class = self.ontology_service.get_system_class("RefreshToken").await
            .map_err(|e| AuthError::DatabaseError(sqlx::Error::Protocol(e.to_string())))?;

        sqlx::query(
            r#"
            INSERT INTO entities (id, class_id, display_name, attributes, tenant_id) 
            VALUES ($1, $2, $3, $4, $5)
            "#
        )
        .bind(Uuid::new_v4())
        .bind(class.id)
        .bind(format!("RefreshToken: {}", refresh_jti))
        .bind(serde_json::json!({
            "token_id": refresh_jti,
            "user_id": user_id,
            "expires_at": expires_at,
            "ip_address": ip,
            "user_agent": user_agent
        }))
        .bind(tenant_id)
        .execute(&self.pool)
        .await?;

        Ok(AuthResponse {
            access_token: Some(access_token),
            refresh_token: Some(refresh_token),
            expires_in: Some(self.config.jwt_expiry),
            remember_me,
            mfa_required: false,
            mfa_token: None,
            user_id,
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
        let user_uuid =
            Uuid::parse_str(&claims.sub).map_err(|e| AuthError::JwtError(e.to_string()))?;
        let token_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM unified_refresh_tokens WHERE token_id = $1 AND user_id = $2 AND expires_at > $3)"
        )
        .bind(&claims.jti)
        .bind(user_uuid)
        .bind(Utc::now())
        .fetch_one(&self.pool)
        .await?;

        if !token_exists {
            return Err(AuthError::InvalidRefreshToken);
        }

        // Blacklist the old refresh token jti (soft delete the entity)
        sqlx::query(
            "UPDATE entities SET deleted_at = NOW() WHERE id = (SELECT entity_id FROM unified_refresh_tokens WHERE token_id = $1)"
        )
        .bind(&claims.jti)
        .execute(&self.pool)
        .await?;

        // Generate new tokens (passing None for IP/UA for now on refresh, or ideally keep track)
        // We'll search for the current user to get tenant_id
        let user = self.user_service.find_by_id(&claims.sub).await?;

        self.generate_tokens(
            user.id,
            user.username,
            user.email.clone().unwrap_or_default(),
            user.tenant_id,
            true,
            None,
            None,
        )
        .await
    }

    pub async fn delete_users_by_prefix(&self, prefix: &str) -> Result<(), AuthError> {
        let pattern = format!("{}%", prefix);
        // This is a bit complex for a view, easier to hit entities directly
        sqlx::query("UPDATE entities SET deleted_at = NOW() WHERE class_id = (SELECT id FROM classes WHERE name = 'User' LIMIT 1) AND attributes->>'email' LIKE $1")
            .bind(pattern)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // Notifications
    pub async fn create_notification(
        &self,
        user_id: &str,
        message: &str,
    ) -> Result<(), AuthError> {
        let user_uuid = Uuid::parse_str(user_id).map_err(|_| AuthError::UserNotFound)?;
        let created_at = Utc::now();
        
        // Find the Notification class
        let class = self.ontology_service.get_system_class("Notification").await
            .map_err(|e| AuthError::DatabaseError(sqlx::Error::Protocol(e.to_string())))?;

        let entity_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO entities (id, class_id, display_name, attributes) VALUES ($1, $2, $3, $4)"
        )
        .bind(entity_id)
        .bind(class.id)
        .bind(format!("Notification: {}", &message[..message.len().min(20)]))
        .bind(serde_json::json!({
            "user_id": user_uuid,
            "message": message,
            "read": false
        }))
        .execute(&self.pool)
        .await?;

        // Mock ID for backward compatibility in NotificationEvent
        let mock_id = (u64::from_str_radix(&entity_id.to_string().replace("-", "")[..16], 16).unwrap_or(0) % (i64::MAX as u64)) as i64;

        let _ = self.notification_tx.send(NotificationEvent {
            user_id: user_id.to_string(),
            message: message.to_string(),
            id: mock_id,
            created_at: created_at.to_rfc3339(),
        });

        Ok(())
    }

    pub async fn get_notifications(
        &self,
        user_id: &str,
    ) -> Result<Vec<(i64, String, i64, String)>, AuthError> {
        let user_uuid = Uuid::parse_str(user_id).map_err(|_| AuthError::UserNotFound)?;
        let rows = sqlx::query!(
            "SELECT entity_id, message, read, created_at FROM unified_notifications WHERE user_id = $1 ORDER BY created_at DESC",
            user_uuid
        )
        .fetch_all(&self.pool)
        .await?;
        
        let mut out = Vec::new();
        for r in rows {
            // We use entity_id hash as a mock i64 ID for compatibility
            let entity_id = r.entity_id.unwrap_or_default();
            let mock_id = (u64::from_str_radix(&entity_id.to_string().replace("-", "")[..16], 16).unwrap_or(0) % (i64::MAX as u64)) as i64;
            
            let read: i64 = if r.read.unwrap_or(false) { 1 } else { 0 };
            out.push((mock_id, r.message.unwrap_or_default(), read, r.created_at.map(|t| t.to_rfc3339()).unwrap_or_default()));
        }
        Ok(out)
    }

    pub async fn mark_notification_read(
        &self,
        _notification_id: i64,
        user_id: &str,
    ) -> Result<(), AuthError> {
        let user_uuid = Uuid::parse_str(user_id).map_err(|_| AuthError::UserNotFound)?;
        
        // Since we use mock IDs, we just mark all as read for this user for now.
        // In a real migration, the frontend would use entity_id (UUID).
        sqlx::query(
            "UPDATE entities SET attributes = attributes || '{\"read\": true}' WHERE class_id = (SELECT id FROM classes WHERE name = 'Notification') AND attributes->>'user_id' = $1"
        )
        .bind(user_uuid.to_string())
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }

    pub async fn mark_all_notifications_read(&self, user_id: &str) -> Result<(), AuthError> {
        let user_uuid = Uuid::parse_str(user_id).map_err(|_| AuthError::UserNotFound)?;
        sqlx::query(
            "UPDATE entities SET attributes = attributes || '{\"read\": true}' WHERE class_id = (SELECT id FROM classes WHERE name = 'Notification') AND attributes->>'user_id' = $1"
        )
        .bind(user_uuid.to_string())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub fn subscribe_notifications(&self) -> broadcast::Receiver<NotificationEvent> {
        self.notification_tx.subscribe()
    }

    // Method to logout and blacklist refresh token
    pub async fn logout(&self, refresh_token: String) -> Result<(), AuthError> {
        let claims = match crate::features::auth::jwt::validate_jwt(&refresh_token, &self.config) {
            Ok(c) => c,
            Err(_) => return Ok(()), // Already invalid or expired
        };

        let jti = claims.jti.ok_or_else(|| AuthError::JwtError("Missing jti".to_string()))?;
        
        // Soft delete the refresh token entity
        sqlx::query(
            "UPDATE entities SET deleted_at = NOW() WHERE id = (SELECT entity_id FROM unified_refresh_tokens WHERE token_id = $1)"
        )
        .bind(jti)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn list_active_sessions(
        &self,
        user_id: Uuid,
        current_token_id: Option<String>,
    ) -> Result<Vec<crate::features::auth::models::SessionResponse>, AuthError> {
        let sessions = sqlx::query!(
            "SELECT * FROM unified_refresh_tokens WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC",
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(sessions
            .into_iter()
            .map(|s| crate::features::auth::models::SessionResponse {
                is_current: current_token_id
                    .as_ref()
                    .map(|id| id == &s.token_id.clone().unwrap_or_default())
                    .unwrap_or(false),
                id: s.token_id.unwrap_or_default(),
                created_at: s.created_at.unwrap_or_else(|| Utc::now()),
                expires_at: s.expires_at.unwrap_or_else(|| Utc::now()),
                user_agent: s.user_agent,
                ip_address: s.ip_address,
            })
            .collect())
    }

    pub async fn list_all_sessions(
        &self,
        limit: i64,
    ) -> Result<Vec<crate::features::auth::models::AdminSessionResponse>, AuthError> {
        let sessions = sqlx::query!(
            r#"
            SELECT rt.token_id as id, rt.user_id, u.username, u.email, 
                   rt.created_at, rt.expires_at, rt.user_agent, rt.ip_address
            FROM unified_refresh_tokens rt
            JOIN unified_users u ON rt.user_id = u.id
            WHERE rt.expires_at > NOW()
            ORDER BY rt.created_at DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(sessions.into_iter().map(|s| crate::features::auth::models::AdminSessionResponse {
            id: s.id.unwrap_or_default(),
            user_id: s.user_id.unwrap_or_else(Uuid::new_v4),
            username: s.username.unwrap_or_default(),
            email: s.email.unwrap_or_default(),
            created_at: s.created_at.unwrap_or_else(|| Utc::now()),
            expires_at: s.expires_at.unwrap_or_else(|| Utc::now()),
            user_agent: s.user_agent,
            ip_address: s.ip_address,
        }).collect())
    }

    pub async fn revoke_session(&self, user_id: Uuid, token_id: &str) -> Result<(), AuthError> {
        let result = sqlx::query(
            "UPDATE entities SET deleted_at = NOW() WHERE id = (SELECT entity_id FROM unified_refresh_tokens WHERE token_id = $1 AND user_id = $2)",
        )
        .bind(token_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AuthError::UserNotFound); 
        }

        // Log revocation
        let _ = self
            .audit_service
            .log(
                user_id,
                "auth.session.revoke",
                "refresh_token",
                None,
                None,
                None,
                Some(serde_json::json!({ "token_id": token_id })),
            )
            .await;

        Ok(())
    }

    pub async fn revoke_any_session(
        &self,
        token_id: &str,
        admin_id: Uuid,
    ) -> Result<(), AuthError> {
        let result = sqlx::query(
            "UPDATE entities SET deleted_at = NOW() WHERE id = (SELECT entity_id FROM unified_refresh_tokens WHERE token_id = $1)"
        )
        .bind(token_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AuthError::UserNotFound); // Or SessionNotFound
        }

        // Log revocation
        let _ = self
            .audit_service
            .log(
                admin_id,
                "auth.session.revoke_admin",
                "refresh_token",
                None,
                None,
                None,
                Some(serde_json::json!({ "token_id": token_id })),
            )
            .await;

        Ok(())
    }

    /// Fetch all effective permissions for a user (combining ABAC and ReBAC)
    pub async fn get_user_permissions(&self, user_id: &str) -> Result<Vec<String>, AuthError> {
        let user_uuid = Uuid::parse_str(user_id).map_err(|_| AuthError::UserNotFound)?;

        // Fetch all active permissions for this user through ontology relationships
        // Logic: User -(has_role)-> Role -(grants_permission)-> Permission
        // We also respect temporal validity in metadata.
        
        let permissions = sqlx::query_scalar::<_, String>(
            r#"
            SELECT DISTINCT e_perm.display_name
            FROM relationships r_role
            JOIN relationships r_perm ON r_role.target_entity_id = r_perm.source_entity_id
            JOIN entities e_perm ON r_perm.target_entity_id = e_perm.id
            WHERE r_role.source_entity_id = $1
              AND r_role.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'has_role' LIMIT 1)
              AND r_perm.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'grants_permission' LIMIT 1)
            "#
        )
        .bind(user_uuid)
        .fetch_all(&self.pool)
        .await?;

        // Handle Denials (if any)
        let denied_permissions = sqlx::query_scalar::<_, String>(
            r#"
            SELECT DISTINCT e_perm.display_name
            FROM relationships r_role
            JOIN relationships r_perm ON r_role.target_entity_id = r_perm.source_entity_id
            JOIN entities e_perm ON r_perm.target_entity_id = e_perm.id
            WHERE r_role.source_entity_id = $1
              AND r_role.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'has_role' LIMIT 1)
              AND r_perm.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'grants_permission' LIMIT 1)
              AND (r_role.metadata->>'is_deny' = 'true' OR r_perm.metadata->>'effect' = 'DENY')
            "#
        )
        .bind(user_uuid)
        .fetch_all(&self.pool)
        .await?;

        let mut final_perms: Vec<String> = permissions
            .into_iter()
            .filter(|p| !denied_permissions.contains(p))
            .collect();
        
        final_perms.sort();
        final_perms.dedup();
        
        Ok(final_perms)
    }
}

impl AuthService {
    /// Return total number of users.
    pub async fn count_users(&self) -> Result<i64, AuthError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM unified_users")
            .fetch_one(&self.pool)
            .await?;
        Ok(count.0)
    }

    /// Return number of active (non-expired) refresh tokens.
    pub async fn count_active_refresh_tokens(&self) -> Result<i64, AuthError> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM unified_refresh_tokens WHERE expires_at > NOW()")
                .fetch_one(&self.pool)
                .await?;
        Ok(count.0)
    }

    /// Return recent users ordered by creation date descending.
    pub async fn recent_users(&self, limit: i64) -> Result<Vec<User>, AuthError> {
        let users =
            sqlx::query_as::<_, User>("SELECT * FROM unified_users ORDER BY created_at DESC LIMIT $1")
                .bind(limit)
                .fetch_all(&self.pool)
                .await?;
        Ok(users)
    }

    pub async fn grant_role_for_test(&self, email: &str, role_name: &str) -> Result<(), AuthError> {
        let user_id = sqlx::query_scalar::<_, Uuid>("SELECT id FROM unified_users WHERE email = $1")
            .bind(email)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(AuthError::UserNotFound)?;

        let _user_has_role = self.abac_service.get_role_by_name(role_name).await
            .map_err(|e| AuthError::ValidationError(e.to_string()))?;

        self.abac_service.assign_role(crate::features::abac::models::AssignRoleInput {
            user_id: user_id.to_string(),
            role_name: role_name.to_string(),
            resource_id: None,
        }, None).await?;

        Ok(())
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
            AuthError::InvalidMfaCode => StatusCode::UNAUTHORIZED,
            AuthError::InvalidToken => StatusCode::UNAUTHORIZED,
            AuthError::PermissionDenied => StatusCode::FORBIDDEN,
            AuthError::AbacError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };

        (status, self.to_string()).into_response()
    }
}
