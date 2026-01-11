use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

// ============================================================================
// POLICY MODEL
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "VARCHAR", rename_all = "UPPERCASE")]
pub enum PolicyEffect {
    #[serde(rename = "ALLOW")]
    Allow,
    #[serde(rename = "DENY")]
    Deny,
}

impl From<String> for PolicyEffect {
    fn from(s: String) -> Self {
        match s.to_uppercase().as_str() {
            "ALLOW" => PolicyEffect::Allow,
            _ => PolicyEffect::Deny,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Policy {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub effect: String,
    pub priority: i32,
    pub target_class_id: Option<Uuid>,
    pub target_permissions: Vec<String>,
    pub conditions: JsonValue,
    pub scope_entity_id: Option<Uuid>,
    pub tenant_id: Option<Uuid>,
    pub is_active: bool,
    pub valid_from: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
    pub updated_at: Option<DateTime<Utc>>,
    pub updated_by: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePolicyInput {
    pub name: String,
    pub description: Option<String>,
    pub effect: String,
    pub priority: Option<i32>,
    pub target_class_id: Option<Uuid>,
    pub target_permissions: Vec<String>,
    pub conditions: JsonValue,
    pub scope_entity_id: Option<Uuid>,
    pub is_active: Option<bool>,
    pub valid_from: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePolicyInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub effect: Option<String>,
    pub priority: Option<i32>,
    pub target_class_id: Option<Uuid>,
    pub target_permissions: Option<Vec<String>>,
    pub conditions: Option<JsonValue>,
    pub scope_entity_id: Option<Uuid>,
    pub is_active: Option<bool>,
    pub valid_from: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,
}

// ============================================================================
// EVALUATION CONTEXT
// ============================================================================

/// Context for policy evaluation containing all available attributes
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EvaluationContext {
    /// Entity attributes (entity.status, entity.classification, etc.)
    pub entity: HashMap<String, JsonValue>,
    /// User attributes (user.clearance_level, user.department, etc.)
    pub user: HashMap<String, JsonValue>,
    /// Environment (env.time_of_day, env.day_of_week, etc.)
    pub env: HashMap<String, JsonValue>,
    /// Request context (request.permission, request.method)
    pub request: HashMap<String, JsonValue>,
}

impl EvaluationContext {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_entity(mut self, key: &str, value: JsonValue) -> Self {
        self.entity.insert(key.to_string(), value);
        self
    }

    pub fn with_user(mut self, key: &str, value: JsonValue) -> Self {
        self.user.insert(key.to_string(), value);
        self
    }

    pub fn with_env(mut self, key: &str, value: JsonValue) -> Self {
        self.env.insert(key.to_string(), value);
        self
    }

    /// Get value by dot-notation path (e.g., "entity.status")
    pub fn get(&self, path: &str) -> Option<&JsonValue> {
        let parts: Vec<&str> = path.splitn(2, '.').collect();
        if parts.len() != 2 {
            return None;
        }
        
        match parts[0] {
            "entity" => self.entity.get(parts[1]),
            "user" => self.user.get(parts[1]),
            "env" => self.env.get(parts[1]),
            "request" => self.request.get(parts[1]),
            _ => None,
        }
    }
}

// ============================================================================
// CONDITION DSL
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Condition {
    pub attribute: String,
    pub operator: String,
    pub value: JsonValue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionGroup {
    #[serde(default)]
    pub all: Vec<Condition>,
    #[serde(default)]
    pub any: Vec<Condition>,
}

// ============================================================================
// EVALUATION RESULT
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub enum PolicyResult {
    Allowed { policy_name: String },
    Denied { policy_name: String },
    NoMatch,
}

impl PolicyResult {
    pub fn is_allowed(&self) -> bool {
        matches!(self, PolicyResult::Allowed { .. } | PolicyResult::NoMatch)
    }
    
    pub fn is_denied(&self) -> bool {
        matches!(self, PolicyResult::Denied { .. })
    }

    pub fn policy_name(&self) -> Option<&str> {
        match self {
            PolicyResult::Allowed { policy_name } => Some(policy_name),
            PolicyResult::Denied { policy_name } => Some(policy_name),
            PolicyResult::NoMatch => None,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct FullPermissionCheckResult {
    pub allowed: bool,
    pub rebac_result: bool,
    pub policy_result: PolicyResult,
    pub reason: String,
}

// ============================================================================
// POLICY TESTING
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct TestPolicyRequest {
    pub policy: CreatePolicyInput,
    pub context: EvaluationContext,
    pub permission: String,
}

#[derive(Debug, Serialize)]
pub struct TestPolicyResponse {
    pub would_match: bool,
    pub effect: String,
    pub condition_results: Vec<ConditionTestResult>,
}

#[derive(Debug, Serialize)]
pub struct ConditionTestResult {
    pub attribute: String,
    pub operator: String,
    pub expected_value: JsonValue,
    pub actual_value: Option<JsonValue>,
    pub passed: bool,
}
