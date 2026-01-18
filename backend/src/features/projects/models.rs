use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

// Custom deserialization for numeric -> f64
fn deserialize_numeric_to_f64<'de, D>(deserializer: D) -> Result<Option<f64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::Error;
    let value: Option<serde_json::Value> = Option::deserialize(deserializer)?;
    match value {
        None => Ok(None),
        Some(serde_json::Value::Number(n)) => Ok(Some(n.as_f64().ok_or_else(|| Error::custom("Invalid number"))?)),
        Some(serde_json::Value::String(s)) => s.parse::<f64>().map(Some).map_err(Error::custom),
        Some(_) => Err(Error::custom("Expected number or string")),
    }
}

// ============================================================================
// Project Model
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub tenant_id: Option<Uuid>,
    pub owner_id: Option<Uuid>,
    pub parent_project_id: Option<Uuid>,
    #[serde(skip_deserializing)]
    #[sqlx(default)]
    pub permissions: Vec<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateProjectInput {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub parent_project_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateProjectInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub parent_project_id: Option<Uuid>,
}

// ============================================================================
// Task Model
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub start_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub estimated_hours: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub tenant_id: Option<Uuid>,
    pub project_id: Option<Uuid>,
    pub assignee_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateTaskInput {
    #[validate(length(min = 1, max = 200))]
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub estimated_hours: Option<f64>,
    pub assignee_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub estimated_hours: Option<f64>,
    pub assignee_id: Option<Uuid>,
}

// ============================================================================
// Project Member
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMember {
    pub user_id: Uuid,
    pub username: String,
    pub email: Option<String>,
    pub role: String, // "owner" or "member"
}
