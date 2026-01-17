use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Clone)]
pub struct SystemMetricsResponse {
    pub status: String,
    pub hostname: String,
    pub os_name: String,
    pub os_version: String,
    pub kernel_version: String,
    pub uptime: u64,
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub disk: DiskMetrics,
    pub network: NetworkMetrics,
}

#[derive(Debug, Serialize, Clone)]
pub struct CpuMetrics {
    pub usage_percent: f32, // Global CPU usage
    pub cores: usize,
    pub load_avg: LoadAvg,
}

#[derive(Debug, Serialize, Clone)]
pub struct LoadAvg {
    pub one: f64,
    pub five: f64,
    pub fifteen: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct MemoryMetrics {
    pub total: u64,
    pub used: u64,
    pub free: u64,
    pub usage_percent: f32,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiskMetrics {
    pub total: u64,
    pub used: u64,
    pub free: u64,
    pub usage_percent: f32,
}

#[derive(Debug, Serialize, Clone)]
pub struct NetworkMetrics {
    pub received_bytes: u64,
    pub transmitted_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct GeneratedReport {
    pub id: Uuid,
    pub name: String,
    pub report_type: String,
    pub status: String,
    pub file_url: Option<String>,
    pub size_bytes: Option<i64>,
    pub generated_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReportRequest {
    pub report_type: String, // ACCESS_AUDIT, USER_ACTIVITY, etc.
}
