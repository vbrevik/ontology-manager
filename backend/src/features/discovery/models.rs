use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ServiceStatus {
    UP,
    DOWN,
    WARNING,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceInstance {
    pub id: String,
    pub name: String,
    pub version: String,
    pub endpoint: String,
    pub status: ServiceStatus,
    pub last_heartbeat: DateTime<Utc>,
    pub metadata: std::collections::HashMap<String, String>,
    pub entity_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterServiceRequest {
    pub name: String,
    pub version: String,
    pub endpoint: String,
    pub metadata: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HeartbeatRequest {
    pub service_id: String,
}
