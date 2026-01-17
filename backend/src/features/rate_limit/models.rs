use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RateLimitRule {
    pub id: Uuid,
    pub name: String,
    pub endpoint_pattern: String,
    pub max_requests: i64,
    pub window_seconds: i64,
    pub strategy: RateLimitStrategy,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
pub enum RateLimitStrategy {
    #[sqlx(rename = "IP")]
    IP,
    #[sqlx(rename = "User")]
    User,
    #[sqlx(rename = "Global")]
    Global,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BypassToken {
    pub id: Uuid,
    pub token: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_by: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateRateLimitRule {
    pub name: Option<String>,
    pub max_requests: Option<i64>,
    pub window_seconds: Option<i64>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateBypassToken {
    pub description: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}
