use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Optional device/login tracking and preferences
    #[sqlx(default)]
    pub last_login_ip: Option<String>,
    #[sqlx(default)]
    pub last_user_agent: Option<String>,
    #[sqlx(default)]
    pub last_login_at: Option<DateTime<Utc>>,
    #[sqlx(default)]
    pub notification_preferences: Option<JsonValue>,
    pub tenant_id: Option<Uuid>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct AuditLog {
    pub id: Uuid,
    pub user_id: Uuid,
    pub action: String,
    pub target_type: String,
    pub target_id: Option<Uuid>,
    pub before_state: Option<JsonValue>,
    pub after_state: Option<JsonValue>,
    pub metadata: Option<JsonValue>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct RefreshToken {
    pub token_id: String,
    pub user_id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
    pub metadata: Option<JsonValue>,
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
    pub is_current: bool,
}

#[derive(Debug, Serialize, FromRow)]
pub struct AdminSessionResponse {
    pub id: String, // from token_id
    #[sqlx(try_from = "Uuid")]
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Validate, Clone)]
pub struct RegisterUser {
    #[validate(length(min = 3, message = "Username must be at least 3 characters"))]
    pub username: String,

    #[validate(email(message = "Email must be valid"))]
    pub email: String,

    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, Validate, Clone)]
pub struct LoginUser {
    #[validate(length(
        min = 3,
        message = "Identifier (email or username) must be at least 3 characters"
    ))]
    pub identifier: String,

    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,

    pub remember_me: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
    pub remember_me: bool,
    pub mfa_required: bool,
    pub mfa_token: Option<String>,
    pub user_id: Uuid,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct TokenClaims {
    pub sub: String,
    pub username: String,
    pub email: String,
    pub exp: i64,
    pub iat: i64,
}
