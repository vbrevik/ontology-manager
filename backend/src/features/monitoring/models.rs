use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Failed authentication attempt record
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FailedAuthAttempt {
    pub id: Uuid,
    pub attempted_identifier: String,
    pub user_id: Option<Uuid>,
    pub ip_address: String,
    pub user_agent: Option<String>,
    pub request_id: Option<Uuid>,
    pub endpoint: String,
    pub failure_reason: String,
    pub metadata: sqlx::types::JsonValue,
    pub attempted_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

/// Security event record
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SecurityEvent {
    pub id: Uuid,
    pub event_type: String,
    pub severity: Severity,
    pub user_id: Option<Uuid>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub resource: Option<String>,
    pub action: Option<String>,
    pub outcome: Outcome,
    pub details: sqlx::types::JsonValue,
    pub request_id: Option<Uuid>,
    pub session_id: Option<Uuid>,
    pub detected_at: DateTime<Utc>,
    pub alerted: bool,
    pub alerted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Event severity levels
#[derive(Debug, Clone, Copy, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "text")]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    #[sqlx(rename = "info")]
    Info,
    #[sqlx(rename = "warning")]
    Warning,
    #[sqlx(rename = "critical")]
    Critical,
}

impl Severity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Severity::Info => "info",
            Severity::Warning => "warning",
            Severity::Critical => "critical",
        }
    }
}

/// Event outcome
#[derive(Debug, Clone, Copy, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "text")]
#[serde(rename_all = "lowercase")]
pub enum Outcome {
    #[sqlx(rename = "success")]
    Success,
    #[sqlx(rename = "failure")]
    Failure,
    #[sqlx(rename = "blocked")]
    Blocked,
}

impl Outcome {
    pub fn as_str(&self) -> &'static str {
        match self {
            Outcome::Success => "success",
            Outcome::Failure => "failure",
            Outcome::Blocked => "blocked",
        }
    }
}

/// Alert rule configuration
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AlertRule {
    pub id: Uuid,
    pub rule_name: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub event_type: Option<String>,
    pub min_severity: Option<String>,
    pub threshold_count: Option<i32>,
    pub threshold_window_minutes: Option<i32>,
    pub group_by: Option<String>,
    pub alert_channel: String,
    pub alert_cooldown_minutes: Option<i32>,
    pub last_triggered_at: Option<DateTime<Utc>>,
    pub total_triggers: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Alert trigger result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertTrigger {
    pub rule_id: Uuid,
    pub rule_name: String,
    pub event_count: i64,
    pub should_alert: bool,
}

/// Failed auth summary by IP
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FailedAuthByIp {
    pub ip_address: String,
    pub attempt_count: i64,
    pub unique_identifiers: i64,
    pub endpoints_attempted: Vec<String>,
    pub first_attempt: DateTime<Utc>,
    pub last_attempt: DateTime<Utc>,
    pub duration_minutes: Option<f64>,
}

/// Security event summary
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SecurityEventSummary {
    pub event_type: String,
    pub severity: Severity,
    pub event_count: i64,
    pub unique_users: i64,
    pub unique_ips: i64,
    pub last_occurrence: DateTime<Utc>,
    pub pending_alerts: i64,
}

/// Create failed auth attempt request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFailedAuthAttempt {
    pub attempted_identifier: String,
    pub user_id: Option<Uuid>,
    pub ip_address: String,
    pub user_agent: Option<String>,
    pub endpoint: String,
    pub failure_reason: String,
    pub metadata: Option<serde_json::Value>,
}

/// Create security event request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSecurityEvent {
    pub event_type: String,
    pub severity: Severity,
    pub user_id: Option<Uuid>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub resource: Option<String>,
    pub action: Option<String>,
    pub outcome: Outcome,
    pub details: Option<serde_json::Value>,
}

/// Common event types
pub mod EventType {
    pub const FAILED_LOGIN: &str = "failed_login";
    pub const ADMIN_ACCESS: &str = "admin_access";
    pub const PRIVILEGE_ESCALATION: &str = "privilege_escalation";
    pub const RATE_LIMIT_EXCEEDED: &str = "rate_limit_exceeded";
    pub const RANSOMWARE_DETECTED: &str = "ransomware_detected";
    pub const SUSPICIOUS_QUERY: &str = "suspicious_query";
    pub const FILE_INTEGRITY_VIOLATION: &str = "file_integrity_violation";
    pub const HONEYPOT_TRIGGERED: &str = "honeypot_triggered";
    pub const MFA_BYPASS_ATTEMPT: &str = "mfa_bypass_attempt";
    pub const SESSION_HIJACK_ATTEMPT: &str = "session_hijack_attempt";
}

/// Common failure reasons
pub mod FailureReason {
    pub const INVALID_PASSWORD: &str = "invalid_password";
    pub const INVALID_MFA: &str = "invalid_mfa";
    pub const ACCOUNT_LOCKED: &str = "account_locked";
    pub const RATE_LIMITED: &str = "rate_limited";
    pub const USER_NOT_FOUND: &str = "user_not_found";
    pub const INVALID_TOKEN: &str = "invalid_token";
    pub const EXPIRED_TOKEN: &str = "expired_token";
    pub const MISSING_MFA: &str = "missing_mfa";
}
