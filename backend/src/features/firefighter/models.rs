use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct FirefighterSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub elevated_role_id: Uuid,
    pub justification: String,
    pub activated_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub deactivated_at: Option<DateTime<Utc>>,
    pub deactivated_by: Option<Uuid>,
    pub deactivation_reason: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RequestElevationInput {
    pub password: String,
    pub justification: String,
    pub duration_minutes: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct DeactivateInput {
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FirefighterStatus {
    pub is_active: bool,
    pub session: Option<FirefighterSession>,
}
