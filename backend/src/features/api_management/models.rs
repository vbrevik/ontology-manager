use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct ApiKey {
    pub id: Uuid,
    pub name: String,
    pub prefix: String,
    #[serde(skip_serializing)] 
    pub hash: String, 
    pub scopes: Vec<String>,
    pub status: String, // active, revoked
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateApiKeyRequest {
    pub name: String,
    pub scopes: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct CreateApiKeyResponse {
    pub id: Uuid,
    pub name: String,
    pub prefix: String,
    pub secret: String, // Only returned once
    pub scopes: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct WebhookEndpoint {
    pub id: Uuid,
    pub url: String,
    pub events: Vec<String>,
    pub status: String, // active, inactive, failing
    #[serde(skip_serializing)] 
    pub secret: String, 
    pub failure_count: i32,
    pub last_delivery_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateWebhookRequest {
    pub url: String,
    pub events: Vec<String>,
}
