use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TestModeSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub test_suite: String,
    pub test_run_id: Option<String>,
    pub justification: String,
    pub activated_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub entities_marked: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestModeStatus {
    pub is_active: bool,
    pub session: Option<TestModeSession>,
    pub minutes_remaining: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ActivateTestModeRequest {
    pub test_suite: Option<String>,
    pub test_run_id: Option<String>,
    pub justification: String,
    pub duration_minutes: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActivateTestModeResponse {
    pub session: TestModeSession,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeactivateTestModeResponse {
    pub message: String,
    pub entities_marked: i32,
    pub duration_minutes: f64,
}
